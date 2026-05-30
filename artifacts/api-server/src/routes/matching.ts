import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  compatibilityReadsTable,
  journalEntriesTable,
  postDateNotesTable,
  wellnessAnswersTable,
  importedSourcesTable,
  datingWinsTable,
  matchingReadinessSnapshotsTable,
} from "@workspace/db";
import {
  UpdateMatchingPreferencesBody,
  UpdateMatchingPoolMembershipBody,
  CreateMatchingExternalReadBody,
} from "@workspace/api-zod";
import { generate, parseStructured } from "../lib/aiService";
import {
  computeBreakdown,
  computeNextActions,
  computeOutcomeInsight,
  scoreFromBreakdown,
  type OutcomeInsight,
  type ReadinessBreakdown,
  type ReadinessNextAction,
} from "../lib/readiness";
import { describeActiveSignals } from "../lib/signalRegistry";

// Minimum substantive journal length (chars) to count toward readiness. A
// lazy one-liner should not move the needle; a real reflection should.
const SUBSTANTIVE_JOURNAL_CHARS = 120;

async function loadUserTier(userId: string): Promise<string | null> {
  const rows = await db
    .select({ tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0]?.tier ?? null;
}

const router: IRouter = Router();

type PreferencesRow = typeof matchPreferencesTable.$inferSelect;
type PoolRow = typeof matchPoolMembershipTable.$inferSelect;
type ProposalRow = typeof matchProposalsTable.$inferSelect;

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function serializePreferences(row: PreferencesRow) {
  return {
    userId: row.userId,
    ageMin: row.ageMin ?? null,
    ageMax: row.ageMax ?? null,
    distanceKm: row.distanceKm ?? null,
    genderPreference: row.genderPreference ?? null,
    dealBreakers: row.dealBreakers ?? null,
    mustHaves: row.mustHaves ?? null,
    cityHint: row.cityHint ?? null,
    updatedAt: toIso(row.updatedAt),
  };
}

function serializeMembership(row: PoolRow) {
  return {
    userId: row.userId,
    status: row.status,
    readyAt: row.readyAt ? toIso(row.readyAt) : null,
    pausedReason: row.pausedReason ?? null,
    tier: row.tier ?? null,
    updatedAt: toIso(row.updatedAt),
  };
}

function serializeProposal(row: ProposalRow) {
  return {
    id: row.id,
    userId: row.userId,
    proposedToUserId: row.proposedToUserId ?? null,
    source: row.source,
    compatibilityScore: row.compatibilityScore,
    summary: row.summary ?? null,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function loadPreferences(userId: string): Promise<PreferencesRow | null> {
  const rows = await db
    .select()
    .from(matchPreferencesTable)
    .where(eq(matchPreferencesTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadMembership(userId: string): Promise<PoolRow | null> {
  const rows = await db
    .select()
    .from(matchPoolMembershipTable)
    .where(eq(matchPoolMembershipTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

interface Readiness {
  score: number;
  breakdown: ReadinessBreakdown;
}

async function computeReadiness(userId: string): Promise<Readiness> {
  const compassRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(compatibilityReadsTable)
    .where(eq(compatibilityReadsTable.userId, userId));
  const compassCount = Number(compassRows[0]?.count ?? 0);

  // Only substantive journal entries count: a real reflection moves readiness,
  // a one-line note does not.
  const journalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, userId),
        isNull(journalEntriesTable.deletedAt),
        sql`char_length(trim(${journalEntriesTable.body})) >= ${SUBSTANTIVE_JOURNAL_CHARS}`,
      ),
    );
  const journalCount = Number(journalRows[0]?.count ?? 0);

  const wellnessRows = await db
    .select({
      count: sql<number>`count(distinct ${wellnessAnswersTable.dimension})::int`,
    })
    .from(wellnessAnswersTable)
    .where(eq(wellnessAnswersTable.userId, userId));
  const wellnessDistinct = Number(wellnessRows[0]?.count ?? 0);

  const hingeRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.userId, userId),
        eq(importedSourcesTable.source, "hinge"),
      ),
    );
  const hingeCount = Number(hingeRows[0]?.count ?? 0);

  // Only post-date notes the user actually reflected on count: an outcome set
  // or a filled reflection field. An empty stub does not.
  const postDateRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.userId, userId),
        isNull(postDateNotesTable.deletedAt),
        sql`(
          ${postDateNotesTable.outcome} is not null
          or char_length(trim(coalesce(${postDateNotesTable.whatWentWell}, ''))) > 0
          or char_length(trim(coalesce(${postDateNotesTable.whatDidnt}, ''))) > 0
        )`,
      ),
    );
  const postDateReflected = Number(postDateRows[0]?.count ?? 0);

  const winsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(datingWinsTable)
    .where(
      and(
        eq(datingWinsTable.userId, userId),
        isNull(datingWinsTable.deletedAt),
      ),
    );
  const winsCount = Number(winsRows[0]?.count ?? 0);

  const breakdown = computeBreakdown({
    compass: compassCount,
    journal: journalCount,
    wellnessDistinct,
    hingeImport: hingeCount,
    postDateReflected,
    wins: winsCount,
  });

  return { score: scoreFromBreakdown(breakdown), breakdown };
}

async function computeOutcomeInsightForUser(
  userId: string,
): Promise<OutcomeInsight> {
  const rows = await db
    .select({
      outcome: postDateNotesTable.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.userId, userId),
        isNull(postDateNotesTable.deletedAt),
        sql`${postDateNotesTable.outcome} is not null`,
      ),
    )
    .groupBy(postDateNotesTable.outcome);

  const counts = { anotherDate: 0, noMore: 0, ghosted: 0, unsure: 0 };
  for (const row of rows) {
    const n = Number(row.count ?? 0);
    if (row.outcome === "another_date") counts.anotherDate = n;
    else if (row.outcome === "no_more") counts.noMore = n;
    else if (row.outcome === "ghosted") counts.ghosted = n;
    else if (row.outcome === "unsure") counts.unsure = n;
  }
  return computeOutcomeInsight(counts);
}

interface ReadinessHistoryPoint {
  day: string;
  score: number;
}

async function loadReadinessHistory(
  userId: string,
): Promise<ReadinessHistoryPoint[]> {
  const rows = await db
    .select({
      day: matchingReadinessSnapshotsTable.day,
      score: matchingReadinessSnapshotsTable.score,
    })
    .from(matchingReadinessSnapshotsTable)
    .where(eq(matchingReadinessSnapshotsTable.userId, userId))
    .orderBy(asc(matchingReadinessSnapshotsTable.day))
    .limit(30);
  return rows.map((r) => ({ day: r.day, score: Number(r.score) }));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function writeReadinessSnapshot(
  userId: string,
  readiness: Readiness,
): Promise<void> {
  await db
    .insert(matchingReadinessSnapshotsTable)
    .values({
      userId,
      day: todayUtc(),
      score: readiness.score,
      breakdown: readiness.breakdown,
    })
    .onConflictDoUpdate({
      target: [
        matchingReadinessSnapshotsTable.userId,
        matchingReadinessSnapshotsTable.day,
      ],
      set: {
        score: readiness.score,
        breakdown: readiness.breakdown,
      },
    });
}

// Minimum readiness score required to activate pool membership. Tunable via
// MATCHING_READINESS_THRESHOLD; clamped to 0-100, defaults to 50.
function readinessThreshold(): number {
  const raw = Number(process.env.MATCHING_READINESS_THRESHOLD);
  if (!Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

const POOL_VISIBLE_STATUSES = ["building", "ready", "concierge_only"] as const;

async function totalPoolCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchPoolMembershipTable)
    .where(
      inArray(matchPoolMembershipTable.status, [...POOL_VISIBLE_STATUSES]),
    );
  return Number(rows[0]?.count ?? 0);
}

router.get("/me/matching/state", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const [prefs, membership, readiness, total, tier, outcomeInsight] =
    await Promise.all([
      loadPreferences(userId),
      loadMembership(userId),
      computeReadiness(userId),
      totalPoolCount(),
      loadUserTier(userId),
      computeOutcomeInsightForUser(userId),
    ]);
  const cityHint = prefs?.cityHint ?? null;
  let density = total;
  if (cityHint && cityHint.trim().length > 0) {
    const cityRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchPoolMembershipTable)
      .innerJoin(
        matchPreferencesTable,
        eq(matchPoolMembershipTable.userId, matchPreferencesTable.userId),
      )
      .where(
        and(
          inArray(matchPoolMembershipTable.status, [...POOL_VISIBLE_STATUSES]),
          sql`lower(${matchPreferencesTable.cityHint}) = ${cityHint.toLowerCase()}`,
        ),
      );
    density = Number(cityRows[0]?.count ?? 0);
  }

  const threshold = readinessThreshold();
  const eligible = readiness.score >= threshold;

  // Persist today's score so the trend line has fresh data, then read the
  // (now-current) history back. A failed snapshot must not break the state read.
  try {
    await writeReadinessSnapshot(userId, readiness);
  } catch (err) {
    req.log.warn({ err }, "Failed to write readiness snapshot");
  }
  const [history, nextActions] = await Promise.all([
    loadReadinessHistory(userId),
    Promise.resolve(computeNextActions(readiness.breakdown, eligible)),
  ]);

  res.json({
    preferences: prefs ? serializePreferences(prefs) : null,
    poolStatus: membership?.status ?? "off",
    tier,
    readiness,
    eligible,
    readinessThreshold: threshold,
    cityDensity: density,
    totalPoolCount: total,
    nextActions,
    history,
    outcomeInsight,
  });
});

router.put("/me/matching/preferences", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = UpdateMatchingPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const data = parsed.data;
  if (
    data.ageMin !== undefined &&
    data.ageMin !== null &&
    data.ageMax !== undefined &&
    data.ageMax !== null &&
    data.ageMin > data.ageMax
  ) {
    res.status(400).json({ error: "ageMin cannot exceed ageMax" });
    return;
  }
  const now = new Date();
  const values = {
    userId,
    ageMin: data.ageMin ?? null,
    ageMax: data.ageMax ?? null,
    distanceKm: data.distanceKm ?? null,
    genderPreference: data.genderPreference ?? null,
    dealBreakers: data.dealBreakers ?? null,
    mustHaves: data.mustHaves ?? null,
    cityHint: data.cityHint ?? null,
    updatedAt: now,
  };
  const [row] = await db
    .insert(matchPreferencesTable)
    .values(values)
    .onConflictDoUpdate({
      target: matchPreferencesTable.userId,
      set: {
        ageMin: values.ageMin,
        ageMax: values.ageMax,
        distanceKm: values.distanceKm,
        genderPreference: values.genderPreference,
        dealBreakers: values.dealBreakers,
        mustHaves: values.mustHaves,
        cityHint: values.cityHint,
        updatedAt: now,
      },
    })
    .returning();
  res.json(serializePreferences(row!));
});

router.put("/me/matching/pool-membership", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = UpdateMatchingPoolMembershipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const requested = parsed.data.status;
  // Cohort gate: joining the pool (building/ready) requires enough signal
  // density. Leaving (off) and pausing (paused) are always allowed so a user
  // can never get stuck in the pool.
  if (requested === "building" || requested === "ready") {
    const [readiness, threshold] = [
      await computeReadiness(userId),
      readinessThreshold(),
    ];
    if (readiness.score < threshold) {
      res.status(422).json({
        error: `You need a readiness of ${threshold} to join the matching pool. You are at ${readiness.score} right now. Add a compass read, a wellness pass, or a Hinge import to close the gap.`,
        readinessScore: readiness.score,
        readinessThreshold: threshold,
      });
      return;
    }
  }
  const [existing, tier] = await Promise.all([
    loadMembership(userId),
    loadUserTier(userId),
  ]);
  let nextStatus: "off" | "building" | "ready" | "paused" | "concierge_only" =
    requested;
  if (nextStatus === "building" && tier === "wingman") {
    nextStatus = "concierge_only";
    req.log.info(
      { userId },
      "Wingman tier opted into pool — routed to concierge_only for founder review",
    );
  }
  const pausedReason =
    nextStatus === "paused" ? parsed.data.pausedReason ?? null : null;
  const now = new Date();
  const readyAt =
    nextStatus === "ready" ? existing?.readyAt ?? now : existing?.readyAt ?? null;
  const [row] = await db
    .insert(matchPoolMembershipTable)
    .values({
      userId,
      status: nextStatus,
      readyAt,
      pausedReason,
      tier,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: {
        status: nextStatus,
        readyAt,
        pausedReason,
        updatedAt: now,
      },
    })
    .returning();
  res.json(serializeMembership(row!));
});

// Deterministic baseline used as fallback when Anthropic isn't available
// (no API key, consent not granted, or daily cap exceeded). Same shape as
// the AI path so callers don't have to branch.
function deterministicExternalRead(profileText: string): {
  score: number;
  highlights: string[];
  frictions: string[];
  summary: string;
} {
  const text = profileText.trim();
  const lower = text.toLowerCase();
  const positives = [
    "therapy",
    "boundaries",
    "growth",
    "honest",
    "kind",
    "curious",
    "reader",
    "active",
    "outdoors",
    "family",
    "thoughtful",
    "creative",
  ];
  const frictionsList = [
    "no drama",
    "fluent in sarcasm",
    "ask me later",
    "5'10",
    "send memes",
    "looking for fun",
  ];
  const highlights = positives.filter((kw) => lower.includes(kw));
  const frictions = frictionsList.filter((kw) => lower.includes(kw));
  let score = 50 + highlights.length * 5 - frictions.length * 7;
  if (text.length > 300) score += 5;
  if (text.length > 800) score += 5;
  score = Math.max(0, Math.min(100, score));
  const summary =
    highlights.length === 0 && frictions.length === 0
      ? "Not much to grab onto in this profile yet. Ask one specific question and re-score."
      : `Found ${highlights.length} signal${highlights.length === 1 ? "" : "s"} worth leaning on and ${frictions.length} thing${frictions.length === 1 ? "" : "s"} to watch.`;
  return { score, highlights, frictions, summary };
}

interface ExternalReadAiOutput {
  score: number;
  highlights: string[];
  frictions: string[];
  summary: string;
}

function coerceExternalReadAi(value: unknown): ExternalReadAiOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const rawScore = typeof v.score === "number" ? v.score : Number(v.score);
  if (!Number.isFinite(rawScore)) return null;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const toStringArray = (x: unknown): string[] =>
    Array.isArray(x)
      ? x.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 6)
      : [];
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  if (summary.length === 0) return null;
  return {
    score,
    highlights: toStringArray(v.highlights),
    frictions: toStringArray(v.frictions),
    summary,
  };
}

router.post("/me/matching/external-read", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateMatchingExternalReadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const deterministic = deterministicExternalRead(parsed.data.profileText);

  // Forward loop: feed the user's own recent date outcomes AND everything the
  // signal registry knows about them into the read, so the coach leans toward
  // what fits this specific person. The "what we know" block is assembled from
  // the registry, so any newly added signal source shows up here automatically.
  const [outcomeInsight, readiness] = await Promise.all([
    computeOutcomeInsightForUser(userId),
    computeReadiness(userId),
  ]);
  const knownSignals = describeActiveSignals(readiness.breakdown);

  const systemLines = [
    "You are Echo, a candid dating coach reading an external dating-app profile",
    "(Hinge/Tinder/Bumble) the user has pasted in. Score how worth-engaging this",
    "profile looks for them, name specific signals, name specific frictions, and",
    "give a 2-3 sentence read in plain spoken English.",
  ];
  if (knownSignals.length > 0) {
    systemLines.push(
      "What the machine already knows about this user (use it to judge fit for them specifically, do not repeat it back):",
      ...knownSignals.map((line) => `- ${line}`),
    );
  }
  if (outcomeInsight.totalDates > 0) {
    systemLines.push(
      `Context on this user's recent dates: ${outcomeInsight.anotherDate} led to another date, ${outcomeInsight.noMore} were a no, ${outcomeInsight.ghosted} ghosted, ${outcomeInsight.unsure} unsure. Use this to judge fit, but read the pasted profile on its own merits.`,
    );
  }
  systemLines.push(
    "Voice rules: no em dashes. No filler like 'unlock', 'elevate', 'dive in',",
    "'game-changer', 'in today's world', 'seamless', 'buckle up'. Vary sentence",
    "length. Be specific, not generic.",
    "Return JSON only, no prose, no code fences:",
    '{ "score": 0-100 integer,',
    '  "highlights": ["3-6 specific things in the profile worth leaning on"],',
    '  "frictions": ["1-4 specific things to watch out for, or empty"],',
    '  "summary": "2-3 sentence Echo-voice read" }',
  );
  const system = systemLines.join("\n");

  const aiResult = await generate(
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user: parsed.data.profileText,
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 1024,
    },
    "",
  );

  let final: ExternalReadAiOutput = deterministic;
  let usedAi = false;
  if (!aiResult.isFallback && aiResult.output) {
    const raw = aiResult.raw ?? aiResult.output;
    const { value } = parseStructured<unknown>(raw, null);
    const coerced = coerceExternalReadAi(value);
    if (coerced) {
      final = coerced;
      usedAi = true;
    } else {
      req.log.warn(
        { userId, fallbackReason: "schema_validation_failed" },
        "matching.external-read AI output failed to validate; using deterministic baseline",
      );
    }
  } else if (aiResult.fallbackReason) {
    req.log.info(
      { userId, fallbackReason: aiResult.fallbackReason },
      "matching.external-read fell back to deterministic baseline",
    );
  }

  await db.insert(compatibilityReadsTable).values({
    userId,
    sourceKind: "paste",
    rawText: parsed.data.profileText,
    parsedProfile: {
      externalSource: parsed.data.source,
      via: "matching_external",
    },
    resultJson: {
      deterministicResult: deterministic,
      aiResult: usedAi ? final : null,
    },
    overallAlignment: final.score,
    mode: "matching_external",
  });

  await db.insert(matchProposalsTable).values({
    userId,
    proposedToUserId: null,
    source: "external_paste",
    compatibilityScore: final.score,
    summary: final.summary,
    status: "proposed",
  });

  res.json(final);
});

router.get("/me/matching/proposals", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(matchProposalsTable)
    .where(eq(matchProposalsTable.userId, req.user.id))
    .orderBy(desc(matchProposalsTable.createdAt))
    .limit(50);
  res.json(rows.map(serializeProposal));
});

export default router;
