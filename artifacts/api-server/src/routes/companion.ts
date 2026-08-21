import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  companionStateTable,
  companionMessagesTable,
  companionObservationsTable,
  companionCommitmentsTable,
  companionNotificationsTable,
  companionChannelPrefsTable,
  matchProposalsTable,
  matchConnectionsTable,
  connectionMessagesTable,
  wellnessInferencesTable,
  postDateNotesTable,
  type CompanionState as CompanionStateRow,
  type CompanionChannelPrefs as CompanionChannelPrefsRow,
} from "@workspace/db";
import {
  GetCompanionResponse,
  SayToCompanionBody,
  SayToCompanionResponse,
  ReviewMessageWithCompanionBody,
  ReviewMessageWithCompanionResponse,
  PulseCompanionResponse,
  ListCompanionNotificationsResponse,
  MarkCompanionNotificationsReadBody,
  MarkCompanionNotificationsReadResponse,
  UpdateCompanionSettingsBody,
  UpdateCompanionSettingsResponse,
  CompleteCompanionCommitmentResponse,
} from "@workspace/api-zod";
import { buildMirrorPortrait, type MirrorPortrait } from "../lib/aiEngine";
import { computeNextActions } from "../lib/readiness";
import {
  computeReadiness,
  computeOutcomeInsightForUser,
  readinessThreshold,
} from "./matching";
import {
  buildCompanionView,
  answerCompanion,
  deriveObservations,
  reviewMessage,
  normalizePersona,
  clampCandor,
  personaLabel,
  buildReaction,
  chooseEchoNextMove,
  type CompanionPersona,
  type MessageDirection,
} from "../lib/companionEngine";
import {
  echoReply,
  echoReviewMessage,
  echoReact,
} from "../lib/companionService";

const router: IRouter = Router();

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// Load the same deterministic portrait the Mirror uses, forcing eligible=false
// in next-action computation so we always surface the single highest-leverage
// lane to deepen, even past the matching threshold.
async function loadPortrait(userId: string): Promise<MirrorPortrait> {
  const readiness = await computeReadiness(userId);
  const outcome = await computeOutcomeInsightForUser(userId);
  const threshold = await readinessThreshold();
  const eligible = readiness.score >= threshold;
  const nextActions = computeNextActions(
    readiness.breakdown,
    false,
    1,
    readiness.weights,
  );
  return buildMirrorPortrait({
    breakdown: readiness.breakdown,
    score: readiness.score,
    eligible,
    threshold,
    nextActions,
    outcome,
  });
}

// The per-lane coverage map (lane key -> derived 0-100 coverage) used as the
// reaction baseline. Holds only derived numbers, never raw content.
function coverageFromPortrait(
  portrait: MirrorPortrait,
): Record<string, number> {
  return Object.fromEntries(portrait.known.map((k) => [k.key, k.coverage]));
}

// Canonical advisory-lock key for a user's reaction baseline. Every pulse
// contends on the SAME key so two concurrent pulses (multiple tabs, rapid
// duplicate requests) read+advance the baseline serially. The loser then reads
// the freshly-advanced baseline and naturally computes moved=false, so one
// readiness move can only ever produce one reaction.
function reactionLockKey(userId: string): string {
  return `companion-reaction:${userId}`;
}

async function getState(userId: string): Promise<CompanionStateRow | null> {
  const [row] = await db
    .select()
    .from(companionStateTable)
    .where(eq(companionStateTable.userId, userId))
    .limit(1);
  return row ?? null;
}

async function getPrefs(
  userId: string,
): Promise<CompanionChannelPrefsRow | null> {
  const [row] = await db
    .select()
    .from(companionChannelPrefsTable)
    .where(eq(companionChannelPrefsTable.userId, userId))
    .limit(1);
  return row ?? null;
}

// A short, derived self-summary Echo keeps so its replies feel like they
// remember you. Built only from aggregate portrait lines, never raw content.
function buildEvolvingSummary(portrait: MirrorPortrait): string {
  const topLanes = portrait.known.slice(0, 2).map((k) => k.label.toLowerCase());
  const seen =
    topLanes.length > 0
      ? `I can see you most clearly through your ${topLanes.join(" and ")}.`
      : "I am still getting to know you; you have fed me very little so far.";
  const gap =
    portrait.blindSpots.length > 0
      ? ` My biggest blind spot on you is your ${portrait.blindSpots[0].label.toLowerCase()}.`
      : "";
  return `${portrait.stageLabel}. ${seen}${gap}`;
}

// Echo "notices" things when a user's score moves. Runs on read, gated on a real
// score change and deduped against recent undismissed notes so polling does not
// spam the feed.
async function refreshObservations(
  userId: string,
  portrait: MirrorPortrait,
  state: CompanionStateRow | null,
): Promise<void> {
  const prevScore = state?.lastSeenScore ?? null;
  const scoreChanged =
    prevScore === null || prevScore !== portrait.readinessScore;

  const summary = buildEvolvingSummary(portrait);
  const now = new Date();

  if (scoreChanged) {
    const derived = deriveObservations({ portrait, previousScore: prevScore });
    if (derived.length > 0) {
      const recent = await db
        .select({
          kind: companionObservationsTable.kind,
          signalId: companionObservationsTable.signalId,
        })
        .from(companionObservationsTable)
        .where(
          and(
            eq(companionObservationsTable.userId, userId),
            isNull(companionObservationsTable.dismissedAt),
            sql`${companionObservationsTable.createdAt} > now() - interval '7 days'`,
          ),
        );
      const existing = new Set(
        recent.map((r) => `${r.kind}:${r.signalId ?? ""}`),
      );
      const fresh = derived.filter(
        (o) => !existing.has(`${o.kind}:${o.signalId ?? ""}`),
      );
      if (fresh.length > 0) {
        await db.insert(companionObservationsTable).values(
          fresh.map((o) => ({
            userId,
            kind: o.kind,
            severity: o.severity,
            body: o.body,
            signalId: o.signalId,
          })),
        );
      }
    }
  }

  // Seed the reaction baseline the first time we ever see this user (row insert,
  // or an existing row whose reaction baseline was never set). We use COALESCE so
  // an established baseline is never overwritten here, which would consume a
  // pending delta before the pulse endpoint could react to it.
  const coverage = coverageFromPortrait(portrait);
  await db
    .insert(companionStateTable)
    .values({
      userId,
      evolvingSummary: summary,
      lastSeenScore: portrait.readinessScore,
      lastSeenAt: now,
      lastReactedScore: portrait.readinessScore,
      lastReactedCoverage: coverage,
      lastReactedAt: now,
      persona: state?.persona ?? "best_friend",
      candor: state?.candor ?? 2,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: companionStateTable.userId,
      set: {
        evolvingSummary: summary,
        lastSeenScore: portrait.readinessScore,
        lastSeenAt: now,
        lastReactedScore: sql`coalesce(${companionStateTable.lastReactedScore}, ${portrait.readinessScore})`,
        lastReactedCoverage: sql`coalesce(${companionStateTable.lastReactedCoverage}, ${JSON.stringify(coverage)}::jsonb)`,
        lastReactedAt: sql`coalesce(${companionStateTable.lastReactedAt}, ${now.toISOString()})`,
        updatedAt: now,
      },
    });
}

async function loadOpenCommitments(userId: string) {
  return db
    .select()
    .from(companionCommitmentsTable)
    .where(
      and(
        eq(companionCommitmentsTable.userId, userId),
        eq(companionCommitmentsTable.status, "open"),
      ),
    )
    .orderBy(desc(companionCommitmentsTable.createdAt))
    .limit(20);
}

function settingsPayload(
  state: CompanionStateRow | null,
  prefs: CompanionChannelPrefsRow | null,
) {
  return {
    persona: normalizePersona(state?.persona) as CompanionPersona,
    candor: clampCandor(state?.candor),
    inApp: prefs?.inApp ?? true,
    email: prefs?.email ?? true,
    sms: prefs?.sms ?? false,
    phone: prefs?.phone ?? null,
  };
}

async function loadEchoJourneyState(userId: string): Promise<{
  pendingProposal: boolean;
  unreadConnection: { id: string; unreadCount: number } | null;
  pendingDebriefConnectionId: string | null;
  pendingLearning: boolean;
}> {
  const [proposal] = await db
    .select({ id: matchProposalsTable.id })
    .from(matchProposalsTable)
    .where(
      and(
        eq(matchProposalsTable.userId, userId),
        eq(matchProposalsTable.status, "proposed"),
      ),
    )
    .orderBy(desc(matchProposalsTable.createdAt))
    .limit(1);

  const [pendingLearning] = await db
    .select({ id: wellnessInferencesTable.id })
    .from(wellnessInferencesTable)
    .where(
      and(
        eq(wellnessInferencesTable.userId, userId),
        eq(wellnessInferencesTable.status, "pending"),
      ),
    )
    .orderBy(desc(wellnessInferencesTable.createdAt))
    .limit(1);

  const connections = await db
    .select({
      id: matchConnectionsTable.id,
      dateCompletedAt: matchConnectionsTable.dateCompletedAt,
    })
    .from(matchConnectionsTable)
    .where(
      and(
        eq(matchConnectionsTable.status, "active"),
        or(
          eq(matchConnectionsTable.userLowId, userId),
          eq(matchConnectionsTable.userHighId, userId),
        ),
      ),
    )
    .orderBy(
      desc(matchConnectionsTable.lastMessageAt),
      desc(matchConnectionsTable.createdAt),
    )
    .limit(50);

  for (const connection of connections) {
    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(connectionMessagesTable)
      .where(
        and(
          eq(connectionMessagesTable.connectionId, connection.id),
          ne(connectionMessagesTable.senderUserId, userId),
          isNull(connectionMessagesTable.readAt),
        ),
      );
    const unreadCount = Number(unread?.count ?? 0);
    if (unreadCount > 0) {
      return {
        pendingProposal: Boolean(proposal),
        unreadConnection: { id: connection.id, unreadCount },
        pendingDebriefConnectionId: null,
        pendingLearning: Boolean(pendingLearning),
      };
    }
  }

  for (const connection of connections) {
    if (!connection.dateCompletedAt) continue;
    const [debrief] = await db
      .select({ id: postDateNotesTable.id })
      .from(postDateNotesTable)
      .where(
        and(
          eq(postDateNotesTable.connectionId, connection.id),
          eq(postDateNotesTable.userId, userId),
          isNull(postDateNotesTable.deletedAt),
          gte(postDateNotesTable.createdAt, connection.dateCompletedAt),
        ),
      )
      .limit(1);
    if (!debrief) {
      return {
        pendingProposal: Boolean(proposal),
        unreadConnection: null,
        pendingDebriefConnectionId: connection.id,
        pendingLearning: Boolean(pendingLearning),
      };
    }
  }

  return {
    pendingProposal: Boolean(proposal),
    unreadConnection: null,
    pendingDebriefConnectionId: null,
    pendingLearning: Boolean(pendingLearning),
  };
}

router.get("/me/companion", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to meet Echo." });
    return;
  }

  const portrait = await loadPortrait(userId);
  const state = await getState(userId);
  await refreshObservations(userId, portrait, state);
  const prefs = await getPrefs(userId);

  const persona = normalizePersona(state?.persona);
  const candor = clampCandor(state?.candor);

  const [openCommitments, journeyState] = await Promise.all([
    loadOpenCommitments(userId),
    loadEchoJourneyState(userId),
  ]);
  const now = Date.now();
  const view = buildCompanionView({
    portrait,
    persona,
    candor,
    openCommitments: openCommitments.map((c) => ({
      body: c.body,
      overdue:
        c.dueAt instanceof Date
          ? c.dueAt.getTime() < now
          : c.dueAt
            ? new Date(c.dueAt).getTime() < now
            : false,
    })),
  });

  const overdueCommitment =
    openCommitments.find((commitment) => {
      if (!commitment.dueAt) return false;
      const dueAt =
        commitment.dueAt instanceof Date
          ? commitment.dueAt.getTime()
          : new Date(commitment.dueAt).getTime();
      return dueAt < now;
    })?.body ?? null;
  const nextMove = chooseEchoNextMove({
    pendingProposal: journeyState.pendingProposal,
    unreadConnection: journeyState.unreadConnection,
    pendingDebriefConnectionId: journeyState.pendingDebriefConnectionId,
    overdueCommitment,
    pendingLearning: journeyState.pendingLearning,
    profileMove: view.oneThing,
  });

  const observations = await db
    .select()
    .from(companionObservationsTable)
    .where(
      and(
        eq(companionObservationsTable.userId, userId),
        isNull(companionObservationsTable.dismissedAt),
      ),
    )
    .orderBy(desc(companionObservationsTable.createdAt))
    .limit(8);

  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companionNotificationsTable)
    .where(
      and(
        eq(companionNotificationsTable.userId, userId),
        isNull(companionNotificationsTable.readAt),
      ),
    );

  res.json(
    GetCompanionResponse.parse({
      personaLabel: personaLabel(persona),
      greeting: view.greeting,
      read: view.read,
      challenge: view.challenge,
      nextMove,
      readinessScore: view.readinessScore,
      threshold: view.threshold,
      eligible: view.eligible,
      observations: observations.map((o) => ({
        id: o.id,
        kind: o.kind,
        severity: o.severity,
        body: o.body,
        signalId: o.signalId,
        createdAt: toIso(o.createdAt),
      })),
      commitments: openCommitments.map((c) => ({
        id: c.id,
        body: c.body,
        status: c.status,
        dueAt: toIsoOrNull(c.dueAt),
        createdAt: toIso(c.createdAt),
        completedAt: toIsoOrNull(c.completedAt),
      })),
      unreadCount: unread?.count ?? 0,
      settings: settingsPayload(state, prefs),
    }),
  );
});

router.post("/me/companion/say", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to talk to Echo." });
    return;
  }
  const parsed = SayToCompanionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const message = parsed.data.message;

  const portrait = await loadPortrait(userId);
  const state = await getState(userId);
  const persona = normalizePersona(state?.persona);
  const candor = clampCandor(state?.candor);

  const openCommitments = await loadOpenCommitments(userId);
  const now = Date.now();
  const view = buildCompanionView({
    portrait,
    persona,
    candor,
    openCommitments: openCommitments.map((c) => ({
      body: c.body,
      overdue:
        c.dueAt instanceof Date
          ? c.dueAt.getTime() < now
          : c.dueAt
            ? new Date(c.dueAt).getTime() < now
            : false,
    })),
  });

  const deterministic = answerCompanion(view, message);

  // Persist the user's turn.
  await db.insert(companionMessagesTable).values({
    userId,
    role: "user",
    content: message,
  });

  const reply = await echoReply({
    userId,
    question: message,
    view,
    deterministic,
    portrait,
    persona,
    candor,
    recentSummary: state?.evolvingSummary ?? null,
    openCommitments: openCommitments.map((c) => c.body),
  });

  // Persist Echo's turn with the real grounding it leaned on.
  await db.insert(companionMessagesTable).values({
    userId,
    role: "echo",
    content: reply.answer,
    grounding: reply.grounding as unknown as Record<string, unknown>,
  });

  // Record any commitment Echo heard, and surface it in the feed so the user
  // sees that Echo is going to hold them to it.
  let commitment = null as null | {
    id: number;
    body: string;
    status: string;
    dueAt: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  if (deterministic.detectedCommitment) {
    const [row] = await db
      .insert(companionCommitmentsTable)
      .values({
        userId,
        body: deterministic.detectedCommitment,
        status: "open",
      })
      .returning();
    if (row) {
      commitment = {
        id: row.id,
        body: row.body,
        status: row.status,
        dueAt: toIsoOrNull(row.dueAt),
        createdAt: toIso(row.createdAt),
        completedAt: toIsoOrNull(row.completedAt),
      };
      await db.insert(companionNotificationsTable).values({
        userId,
        source: "commitment",
        kind: "commitment_recorded",
        title: "Echo is holding you to this",
        body: `You said you would ${row.body}. I wrote it down. I will check in.`,
        ctaHref: "/echo",
        ctaLabel: "Open Echo",
      });
    }
  }

  res.json(
    SayToCompanionResponse.parse({
      answer: reply.answer,
      followUp: reply.followUp,
      grounding: reply.grounding,
      isFallback: reply.isFallback,
      commitment,
    }),
  );
});

router.post("/me/companion/review", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to have Echo read a message." });
    return;
  }
  const parsed = ReviewMessageWithCompanionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { text, direction } = parsed.data;

  const state = await getState(userId);
  const persona = normalizePersona(state?.persona);
  const candor = clampCandor(state?.candor);

  const deterministic = reviewMessage(
    text,
    direction as MessageDirection,
    persona,
    candor,
  );
  const result = await echoReviewMessage({
    userId,
    text,
    direction: direction as MessageDirection,
    deterministic,
    persona,
    candor,
  });

  res.json(
    ReviewMessageWithCompanionResponse.parse({
      verdict: result.verdict,
      strengths: result.strengths,
      risks: result.risks,
      suggestion: result.suggestion,
      isFallback: result.isFallback,
    }),
  );
});

// Called the instant the readiness meter moves. Compares the current portrait to
// the stored reaction baseline, builds an honest reaction, enriches the voice if
// the deep AI lane is on, then advances the baseline so a single climb is never
// reacted to twice.
router.post("/me/companion/pulse", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to meet Echo." });
    return;
  }

  // Read the reaction baseline and advance it atomically under a per-user
  // advisory lock so two concurrent pulses can only consume a single move. The
  // portrait and the deterministic build happen inside the lock; Claude
  // enrichment runs AFTER the transaction so we never hold the lock across a
  // network call.
  const { deterministic, persona, candor } = await db.transaction(
    async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${reactionLockKey(userId)})::bigint)`,
      );

      // Derive the portrait inside the lock so the score we react to and the
      // baseline we read/advance are taken at the same serialized point. If we
      // computed it before the lock, a concurrent pulse could advance the
      // baseline past our stale score and we would react to a phantom dip and
      // regress the baseline.
      const portrait = await loadPortrait(userId);

      const [state] = await tx
        .select()
        .from(companionStateTable)
        .where(eq(companionStateTable.userId, userId))
        .limit(1);

      const persona = normalizePersona(state?.persona);
      const candor = clampCandor(state?.candor);
      const previousScore = state?.lastReactedScore ?? null;
      const previousCoverageByKey = state?.lastReactedCoverage ?? null;

      const deterministic = buildReaction({
        portrait,
        previousScore,
        previousCoverageByKey,
        persona,
        candor,
      });

      // Advance the baseline only when we reacted to a real move (or when no
      // baseline existed yet). A flat read leaves the baseline untouched so a
      // later move is still measured against the right starting point. Advancing
      // here, under the lock, is what makes a concurrent duplicate pulse read the
      // new baseline and compute moved=false.
      if (deterministic.moved || previousScore === null) {
        const now = new Date();
        const coverage = coverageFromPortrait(portrait);
        await tx
          .insert(companionStateTable)
          .values({
            userId,
            lastReactedScore: portrait.readinessScore,
            lastReactedCoverage: coverage,
            lastReactedAt: now,
            persona: state?.persona ?? "best_friend",
            candor: state?.candor ?? 2,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: companionStateTable.userId,
            set: {
              lastReactedScore: portrait.readinessScore,
              lastReactedCoverage: coverage,
              lastReactedAt: now,
              updatedAt: now,
            },
          });
      }

      return { deterministic, persona, candor };
    },
  );

  const { reaction, isFallback } = await echoReact({
    userId,
    deterministic,
    persona,
    candor,
  });

  res.json(
    PulseCompanionResponse.parse({
      reaction,
      isFallback,
    }),
  );
});

router.get("/me/companion/notifications", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to see Echo's feed." });
    return;
  }
  const rows = await db
    .select()
    .from(companionNotificationsTable)
    .where(eq(companionNotificationsTable.userId, userId))
    .orderBy(desc(companionNotificationsTable.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => r.readAt === null).length;

  res.json(
    ListCompanionNotificationsResponse.parse({
      notifications: rows.map((r) => ({
        id: r.id,
        source: r.source,
        kind: r.kind,
        title: r.title,
        body: r.body,
        ctaHref: r.ctaHref,
        ctaLabel: r.ctaLabel,
        read: r.readAt !== null,
        createdAt: toIso(r.createdAt),
      })),
      unreadCount,
    }),
  );
});

router.post(
  "/me/companion/notifications/read",
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }
    const parsed = MarkCompanionNotificationsReadBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ids = parsed.data.ids;
    const now = new Date();
    if (ids && ids.length > 0) {
      await db
        .update(companionNotificationsTable)
        .set({ readAt: now })
        .where(
          and(
            eq(companionNotificationsTable.userId, userId),
            isNull(companionNotificationsTable.readAt),
            inArray(companionNotificationsTable.id, ids),
          ),
        );
    } else {
      await db
        .update(companionNotificationsTable)
        .set({ readAt: now })
        .where(
          and(
            eq(companionNotificationsTable.userId, userId),
            isNull(companionNotificationsTable.readAt),
          ),
        );
    }

    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companionNotificationsTable)
      .where(
        and(
          eq(companionNotificationsTable.userId, userId),
          isNull(companionNotificationsTable.readAt),
        ),
      );

    res.json(
      MarkCompanionNotificationsReadResponse.parse({
        unreadCount: unread?.count ?? 0,
      }),
    );
  },
);

router.patch("/me/companion/settings", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }
  const parsed = UpdateCompanionSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const now = new Date();

  const existingState = await getState(userId);
  const existingPrefs = await getPrefs(userId);

  // Persona + candor live on companion_state.
  if (body.persona !== undefined || body.candor !== undefined) {
    const persona =
      body.persona !== undefined
        ? normalizePersona(body.persona)
        : normalizePersona(existingState?.persona);
    const candor =
      body.candor !== undefined
        ? clampCandor(body.candor)
        : clampCandor(existingState?.candor);
    await db
      .insert(companionStateTable)
      .values({ userId, persona, candor, updatedAt: now })
      .onConflictDoUpdate({
        target: companionStateTable.userId,
        set: { persona, candor, updatedAt: now },
      });
  }

  // Channel prefs live on companion_channel_prefs. SMS requires an explicit
  // phone number; turning it on without one is rejected, and we stamp consent.
  const channelTouched =
    body.inApp !== undefined ||
    body.email !== undefined ||
    body.sms !== undefined ||
    body.phone !== undefined;
  if (channelTouched) {
    const phone =
      body.phone !== undefined ? body.phone : (existingPrefs?.phone ?? null);
    const sms =
      body.sms !== undefined ? body.sms : (existingPrefs?.sms ?? false);
    if (sms && (!phone || phone.trim().length < 7)) {
      res
        .status(400)
        .json({ error: "Add a phone number before turning on SMS." });
      return;
    }
    const wasOn = existingPrefs?.sms ?? false;
    const smsConsentAt =
      sms && !wasOn ? now : (existingPrefs?.smsConsentAt ?? null);
    await db
      .insert(companionChannelPrefsTable)
      .values({
        userId,
        inApp: body.inApp ?? existingPrefs?.inApp ?? true,
        email: body.email ?? existingPrefs?.email ?? true,
        sms,
        phone: phone ? phone.trim() : null,
        smsConsentAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: companionChannelPrefsTable.userId,
        set: {
          inApp: body.inApp ?? existingPrefs?.inApp ?? true,
          email: body.email ?? existingPrefs?.email ?? true,
          sms,
          phone: phone ? phone.trim() : null,
          smsConsentAt,
          updatedAt: now,
        },
      });
  }

  const state = await getState(userId);
  const prefs = await getPrefs(userId);
  res.json(
    UpdateCompanionSettingsResponse.parse(settingsPayload(state, prefs)),
  );
});

router.post(
  "/me/companion/commitments/:id/done",
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Commitment not found." });
      return;
    }
    const now = new Date();
    const [row] = await db
      .update(companionCommitmentsTable)
      .set({ status: "done", completedAt: now })
      .where(
        and(
          eq(companionCommitmentsTable.id, id),
          eq(companionCommitmentsTable.userId, userId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Commitment not found." });
      return;
    }
    res.json(
      CompleteCompanionCommitmentResponse.parse({
        id: row.id,
        body: row.body,
        status: row.status,
        dueAt: toIsoOrNull(row.dueAt),
        createdAt: toIso(row.createdAt),
        completedAt: toIsoOrNull(row.completedAt),
      }),
    );
  },
);

router.post(
  "/me/companion/observations/:id/dismiss",
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Observation not found." });
      return;
    }
    const [row] = await db
      .update(companionObservationsTable)
      .set({ dismissedAt: new Date() })
      .where(
        and(
          eq(companionObservationsTable.id, id),
          eq(companionObservationsTable.userId, userId),
        ),
      )
      .returning({ id: companionObservationsTable.id });
    if (!row) {
      res.status(404).json({ error: "Observation not found." });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
