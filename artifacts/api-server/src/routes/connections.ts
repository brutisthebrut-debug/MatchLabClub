import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  matchConnectionsTable,
  connectionMessagesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  matchPreferencesTable,
  profilePhotosTable,
  usersTable,
  userBlocksTable,
  userReportsTable,
  companionNotificationsTable,
  postDateNotesTable,
  insertConnectionMessageSchema,
  SAFETY_REASONS,
  type MatchConnection,
  type ConnectionMessage,
} from "@workspace/db";
import { z } from "zod/v4";
import { notifyNewMessage } from "../lib/matchConnections";
import { blockUserPair } from "../lib/userBlocks";
import { computeReadiness } from "./matching";
import { generateConnectionStarters, generateDateIdeas } from "../lib/aiEngine";
import { generate } from "../lib/aiService";
import { canonicalizeCity, titleCaseCity } from "../lib/geo";
import { getPlacesProvider, type PlaceSuggestion } from "../lib/placesProvider";
import { recordJourneyEvent } from "../lib/journeyEvents";

const router: IRouter = Router();

// A sender may not post more than this many messages across all their
// conversations within the window. Durable (DB-counted) so it survives restarts
// and is not per-instance. Generous enough for a real back-and-forth, low
// enough to blunt spam and runaway clients.
const SEND_WINDOW_MS = 60_000;
const SEND_MAX_PER_WINDOW = 30;

function toIso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function counterpartOf(connection: MatchConnection, userId: string): string {
  return connection.userLowId === userId
    ? connection.userHighId
    : connection.userLowId;
}

function serializeConnection(
  connection: MatchConnection,
  userId: string,
  extra?: {
    unreadCount?: number;
    lastMessagePreview?: string | null;
    debriefNoteId?: number | null;
  },
) {
  const debriefNoteId = extra?.debriefNoteId ?? null;
  const dateStage = debriefNoteId
    ? "debrief_saved"
    : connection.dateCompletedAt
      ? "date_completed"
      : connection.datePlannedAt
        ? "date_planned"
        : "connected";
  return {
    id: connection.id,
    counterpartUserId: counterpartOf(connection, userId),
    status: connection.status,
    closedReason: connection.closedReason ?? null,
    closedByYou: connection.closedByUserId === userId,
    dateStage,
    datePlannedAt: toIso(connection.datePlannedAt),
    dateCompletedAt: toIso(connection.dateCompletedAt),
    debriefNoteId,
    lastMessageAt: toIso(connection.lastMessageAt),
    createdAt: toIso(connection.createdAt),
    unreadCount: extra?.unreadCount ?? 0,
    lastMessagePreview: extra?.lastMessagePreview ?? null,
  };
}

async function activeDebriefId(
  connection: MatchConnection,
  userId: string,
): Promise<number | null> {
  if (!connection.dateCompletedAt) return null;
  const [row] = await db
    .select({ id: postDateNotesTable.id })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.connectionId, connection.id),
        eq(postDateNotesTable.userId, userId),
        isNull(postDateNotesTable.deletedAt),
        gt(postDateNotesTable.createdAt, connection.dateCompletedAt),
      ),
    )
    .orderBy(desc(postDateNotesTable.createdAt))
    .limit(1);
  return row?.id ?? null;
}

function serializeMessage(message: ConnectionMessage, userId: string) {
  return {
    id: message.id,
    connectionId: message.connectionId,
    mine: message.senderUserId === userId,
    body: message.body,
    createdAt: toIso(message.createdAt),
    readAt: toIso(message.readAt),
  };
}

// Load a connection only if the requester is one of its two members. Returns
// null otherwise so handlers answer 404 uniformly (never leak existence).
async function loadConnectionForUser(
  id: string,
  userId: string,
): Promise<MatchConnection | null> {
  const rows = await db
    .select()
    .from(matchConnectionsTable)
    .where(
      and(
        eq(matchConnectionsTable.id, id),
        or(
          eq(matchConnectionsTable.userLowId, userId),
          eq(matchConnectionsTable.userHighId, userId),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function isBlockedPair(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ id: userBlocksTable.id })
    .from(userBlocksTable)
    .where(
      or(
        and(
          eq(userBlocksTable.blockerUserId, a),
          eq(userBlocksTable.blockedUserId, b),
        ),
        and(
          eq(userBlocksTable.blockerUserId, b),
          eq(userBlocksTable.blockedUserId, a),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// GET /me/connections — the member's conversation list, most recently active
// first. Each row carries the counterpart id, the unread count, and a short
// preview of the latest message.
router.get(
  "/me/connections",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connections = await db
      .select()
      .from(matchConnectionsTable)
      .where(
        or(
          eq(matchConnectionsTable.userLowId, userId),
          eq(matchConnectionsTable.userHighId, userId),
        ),
      )
      .orderBy(
        desc(matchConnectionsTable.lastMessageAt),
        desc(matchConnectionsTable.createdAt),
      );

    const out = [];
    for (const connection of connections) {
      const [unread] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(connectionMessagesTable)
        .where(
          and(
            eq(connectionMessagesTable.connectionId, connection.id),
            ne(connectionMessagesTable.senderUserId, userId),
            isNull(connectionMessagesTable.readAt),
          ),
        );
      const [latest] = await db
        .select({ body: connectionMessagesTable.body })
        .from(connectionMessagesTable)
        .where(eq(connectionMessagesTable.connectionId, connection.id))
        .orderBy(desc(connectionMessagesTable.id))
        .limit(1);
      const debriefNoteId = await activeDebriefId(connection, userId);
      out.push(
        serializeConnection(connection, userId, {
          unreadCount: unread?.value ?? 0,
          lastMessagePreview: latest?.body ? latest.body.slice(0, 140) : null,
          debriefNoteId,
        }),
      );
    }
    res.json(out);
  },
);

// GET /me/connections/:id — a single conversation's metadata.
router.get(
  "/me/connections/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const debriefNoteId = await activeDebriefId(connection, userId);
    res.json(serializeConnection(connection, userId, { debriefNoteId }));
  },
);

const ConnectionDateStateBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    occurredAt: z.iso.datetime({ offset: true }),
  }),
  z.object({
    action: z.literal("complete"),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
  }),
]);

// PATCH /me/connections/:id/date-state — persist the shared date lifecycle.
// The plan/completion fact is shared by the pair; each person's debrief remains
// private in post_date_notes and only affects their own serialized stage.
router.patch(
  "/me/connections/:id/date-state",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const parsed = ConnectionDateStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    if (connection.status !== "active") {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }
    if (parsed.data.action === "plan" && connection.dateCompletedAt) {
      res.status(409).json({
        error:
          "This date is already complete and cannot be moved back to planned",
      });
      return;
    }
    if (parsed.data.action === "complete" && connection.dateCompletedAt) {
      const debriefNoteId = await activeDebriefId(connection, userId);
      res.json(serializeConnection(connection, userId, { debriefNoteId }));
      return;
    }

    const now = new Date();
    const occurredAt = parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : now;
    if (Number.isNaN(occurredAt.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    let patch: Partial<typeof matchConnectionsTable.$inferInsert>;
    let step: "date_planned" | "date_completed";
    if (parsed.data.action === "plan") {
      const earliest = now.getTime() - 24 * 60 * 60 * 1000;
      const latest = now.getTime() + 366 * 24 * 60 * 60 * 1000;
      if (occurredAt.getTime() < earliest || occurredAt.getTime() > latest) {
        res.status(400).json({
          error: "Choose a date between now and one year from now",
        });
        return;
      }
      patch = { datePlannedAt: occurredAt, dateCompletedAt: null };
      step = "date_planned";
    } else {
      if (occurredAt.getTime() > now.getTime() + 5 * 60 * 1000) {
        res
          .status(400)
          .json({ error: "A completed date cannot be in the future" });
        return;
      }
      patch = {
        datePlannedAt: connection.datePlannedAt ?? occurredAt,
        dateCompletedAt: occurredAt,
      };
      step = "date_completed";
    }

    const [updated] = await db
      .update(matchConnectionsTable)
      .set(patch)
      .where(eq(matchConnectionsTable.id, connection.id))
      .returning();
    const changed =
      step === "date_planned"
        ? toIso(connection.datePlannedAt) !== occurredAt.toISOString() ||
          connection.dateCompletedAt !== null
        : connection.dateCompletedAt === null;
    if (changed) {
      void recordJourneyEvent({
        eventType: "match_step",
        userId,
        props: { step },
      });
    }
    const debriefNoteId = await activeDebriefId(updated ?? connection, userId);
    res.json(
      serializeConnection(updated ?? connection, userId, { debriefNoteId }),
    );
  },
);

// GET /me/connections/:id/messages — the full thread, oldest first.
router.get(
  "/me/connections/:id/messages",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const rows = await db
      .select()
      .from(connectionMessagesTable)
      .where(eq(connectionMessagesTable.connectionId, connection.id))
      .orderBy(asc(connectionMessagesTable.id));
    res.json(rows.map((m) => serializeMessage(m, userId)));
  },
);

// POST /me/connections/:id/messages — send a message. Hard-gated: the
// connection must be active and the pair must not be blocked in either
// direction. Rate-limited per sender across all their conversations.
router.post(
  "/me/connections/:id/messages",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const parsed = insertConnectionMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    if (connection.status !== "active") {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }
    const counterpart = counterpartOf(connection, userId);
    if (await isBlockedPair(userId, counterpart)) {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }

    const since = new Date(Date.now() - SEND_WINDOW_MS);
    const [recent] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(connectionMessagesTable)
      .where(
        and(
          eq(connectionMessagesTable.senderUserId, userId),
          gt(connectionMessagesTable.createdAt, since),
        ),
      );
    if ((recent?.value ?? 0) >= SEND_MAX_PER_WINDOW) {
      res.status(429).json({
        error: "You are sending messages too quickly. Try again in a moment.",
      });
      return;
    }

    const [message] = await db
      .insert(connectionMessagesTable)
      .values({
        connectionId: connection.id,
        senderUserId: userId,
        body: parsed.data.body,
      })
      .returning();
    await db
      .update(matchConnectionsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(matchConnectionsTable.id, connection.id));

    void notifyNewMessage(connection, counterpart);

    req.log.info({ connectionId: connection.id }, "connection.message sent");
    res.status(201).json(serializeMessage(message!, userId));
  },
);

// POST /me/connections/:id/read — mark every message from the counterpart as
// read, and clear the unread "new message" notification for this thread.
router.post(
  "/me/connections/:id/read",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const now = new Date();
    await db
      .update(connectionMessagesTable)
      .set({ readAt: now })
      .where(
        and(
          eq(connectionMessagesTable.connectionId, connection.id),
          ne(connectionMessagesTable.senderUserId, userId),
          isNull(connectionMessagesTable.readAt),
        ),
      );
    await db
      .update(companionNotificationsTable)
      .set({ readAt: now })
      .where(
        and(
          eq(companionNotificationsTable.userId, userId),
          eq(companionNotificationsTable.kind, "match_message"),
          eq(
            companionNotificationsTable.ctaHref,
            `/connections/${connection.id}`,
          ),
          isNull(companionNotificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  },
);

// POST /me/connections/:id/unmatch — end the conversation. Closing is symmetric:
// once closed neither side can send. A later mutual match reopens it.
router.post(
  "/me/connections/:id/unmatch",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const [updated] = await db
      .update(matchConnectionsTable)
      .set({
        status: "closed",
        closedReason: "unmatch",
        closedByUserId: userId,
      })
      .where(eq(matchConnectionsTable.id, connection.id))
      .returning();
    req.log.info({ connectionId: connection.id }, "connection.unmatched");
    const debriefNoteId = await activeDebriefId(updated ?? connection, userId);
    res.json(
      serializeConnection(updated ?? connection, userId, { debriefNoteId }),
    );
  },
);

const ReportConnectionBody = z.object({
  reason: z.enum(SAFETY_REASONS),
  note: z.string().trim().max(1000).nullish(),
});

// POST /me/connections/:id/report — report the counterpart and close the
// thread. Files a normal member report (reportedUserId = counterpart) so it
// joins the founder review queue; reporting never moves Match Readiness.
router.post(
  "/me/connections/:id/report",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const parsed = ReportConnectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const counterpart = counterpartOf(connection, userId);
    await db.insert(userReportsTable).values({
      reporterUserId: userId,
      reportedUserId: counterpart,
      subjectType: "member",
      reason: parsed.data.reason,
      context: "conversation",
      note: parsed.data.note ?? null,
    });
    // Reporting also blocks: the reporter never gets re-paired with this person.
    // The block is a hard, symmetric gate in the matching engine and clears any
    // internal proposals between the two, so the thread cannot reopen later.
    await blockUserPair(userId, counterpart, `report:${parsed.data.reason}`);
    const [updated] = await db
      .update(matchConnectionsTable)
      .set({ status: "closed", closedReason: "report", closedByUserId: userId })
      .where(eq(matchConnectionsTable.id, connection.id))
      .returning();
    req.log.info(
      { connectionId: connection.id, reason: parsed.data.reason },
      "connection.reported",
    );
    const debriefNoteId = await activeDebriefId(updated ?? connection, userId);
    res.json(
      serializeConnection(updated ?? connection, userId, { debriefNoteId }),
    );
  },
);

function photoServingUrl(objectPath: string): string {
  const id = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.replace(/^\/+/, "");
  return `storage/objects/${id}`;
}

function readinessPhrase(score: number): string {
  if (score >= 80) {
    return "Deeply relationship-ready, with a rich signal picture across the lanes that matter.";
  }
  if (score >= 60) {
    return "Solidly relationship-ready and still building, with good coverage across several lanes.";
  }
  if (score >= 40) {
    return "Actively building readiness, with a real foundation forming across a few lanes.";
  }
  return "Early in the readiness climb and putting in the work.";
}

// Symmetric compatibility for a connected pair. Internal proposals are mirrored
// (one ordered row per member, sharing the same score and summary), so we read
// the viewer's row first and fall back to the counterpart's. Status is
// intentionally not filtered: a live connection may sit on any proposal status.
// Returns null when no internal proposal exists (e.g. a reopened or
// concierge-made connection), so callers expose null rather than a fake score.
async function loadPairCompatibility(
  me: string,
  counterpart: string,
): Promise<{ compatibilityScore: number; matchSummary: string | null } | null> {
  const cols = {
    score: matchProposalsTable.compatibilityScore,
    summary: matchProposalsTable.summary,
  };
  const mine = await db
    .select(cols)
    .from(matchProposalsTable)
    .where(
      and(
        eq(matchProposalsTable.source, "internal"),
        eq(matchProposalsTable.userId, me),
        eq(matchProposalsTable.proposedToUserId, counterpart),
      ),
    )
    .orderBy(desc(matchProposalsTable.createdAt))
    .limit(1);
  const row =
    mine[0] ??
    (
      await db
        .select(cols)
        .from(matchProposalsTable)
        .where(
          and(
            eq(matchProposalsTable.source, "internal"),
            eq(matchProposalsTable.userId, counterpart),
            eq(matchProposalsTable.proposedToUserId, me),
          ),
        )
        .orderBy(desc(matchProposalsTable.createdAt))
        .limit(1)
    )[0];
  if (!row) return null;
  return { compatibilityScore: row.score, matchSummary: row.summary ?? null };
}

// GET /me/connections/:id/profile — the counterpart's curated reveal card. Name
// and photos appear only when the counterpart turned reveal consent on. The
// readiness and values lines are aggregate phrasing derived from their signal
// coverage, never raw signals or PII. Demo-safe: returns a useful card even
// when the counterpart has shared nothing yet.
router.get(
  "/me/connections/:id/profile",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const counterpart = counterpartOf(connection, userId);

    const [membership] = await db
      .select({ revealConsent: matchPoolMembershipTable.revealConsent })
      .from(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, counterpart))
      .limit(1);
    const revealed = membership?.revealConsent === true;

    let displayName: string | null = null;
    let photos: string[] = [];
    if (revealed) {
      const [user] = await db
        .select({ firstName: usersTable.firstName })
        .from(usersTable)
        .where(eq(usersTable.id, counterpart))
        .limit(1);
      displayName = user?.firstName?.trim() || null;
      const photoRows = await db
        .select()
        .from(profilePhotosTable)
        .where(eq(profilePhotosTable.userId, counterpart))
        .orderBy(asc(profilePhotosTable.ordinal), asc(profilePhotosTable.id));
      photos = photoRows.map((p) => photoServingUrl(p.objectPath));
    }

    const readiness = await computeReadiness(counterpart);
    const pair = await loadPairCompatibility(userId, counterpart);

    res.json({
      counterpartUserId: counterpart,
      revealed,
      displayName,
      photos,
      prompts: [],
      readinessSummary: readinessPhrase(readiness.score),
      valuesSummary:
        "Values come through in how this person shows up across the lanes they have shared. The more you talk, the clearer the fit.",
      compatibilityScore: pair?.compatibilityScore ?? null,
      matchSummary: pair?.matchSummary ?? null,
    });
  },
);

// GET /me/connections/:id/starters — three openers the signed-in user can send.
// Built ONLY from reveal-safe aggregate fields: the readiness phrase, the
// aggregate match summary, the compatibility score, and the counterpart's
// display name when they turned reveal consent on. Never raw signals, lane
// breakdowns, or PII. Hybrid: the deterministic baseline always runs; the deep
// AI lane is layered on when the account opted in, and any failure, missing
// consent, or cap hit silently keeps the deterministic openers.
router.get(
  "/me/connections/:id/starters",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const counterpart = counterpartOf(connection, userId);

    const [membership] = await db
      .select({ revealConsent: matchPoolMembershipTable.revealConsent })
      .from(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, counterpart))
      .limit(1);
    const revealed = membership?.revealConsent === true;

    let displayName: string | null = null;
    if (revealed) {
      const [user] = await db
        .select({ firstName: usersTable.firstName })
        .from(usersTable)
        .where(eq(usersTable.id, counterpart))
        .limit(1);
      displayName = user?.firstName?.trim() || null;
    }

    const readiness = await computeReadiness(counterpart);
    const pair = await loadPairCompatibility(userId, counterpart);

    // One shared, reveal-safe context object feeds BOTH the deterministic
    // generator and the Claude prompt, so there is a single leak chokepoint.
    const ctx = {
      revealed,
      displayName,
      compatibilityScore: pair?.compatibilityScore ?? null,
      matchSummary: pair?.matchSummary ?? null,
      readinessSummary: readinessPhrase(readiness.score),
    };

    const deterministic = generateConnectionStarters(ctx);
    let starters = deterministic.starters;
    let mode: "deterministic" | "ai" = "deterministic";

    try {
      const system = [
        "You are Echo, the MatchLab Club connection coach. The signed-in user just",
        "matched with someone and wants three openers to start the conversation. You",
        "are given ONLY aggregate, consented details about the match. Use only what is",
        "provided. Never invent facts about the other person, never reference anything",
        "not listed, and never mention scores or internal metrics inside the opener text.",
        "",
        "Return JSON only. No prose, no code fences. Match this shape exactly:",
        '{ "starters": [ { "text": "the actual opener the user could send, in a real human voice", "rationale": "one line on why this opener fits" } ] }',
        "",
        "Give exactly 3 starters, each a different angle (warm, curious, light). Every",
        "opener must be something a real person would send a brand new match. Keep them",
        "short.",
        "Voice rules: no em dashes. No emojis. No filler words like 'unlock', 'leverage',",
        "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge', 'dive",
        "in', 'buckle up', or 'in today's world'. Vary sentence length. Sound human.",
      ].join("\n");

      const userContent = [
        ctx.displayName
          ? `Match first name: ${ctx.displayName}`
          : "Match name: not revealed yet, do not invent one",
        ctx.compatibilityScore != null
          ? `Compatibility score (0 to 100, context only, never quote it back): ${ctx.compatibilityScore}`
          : "Compatibility score: not available",
        ctx.matchSummary
          ? `Aggregate match summary: ${ctx.matchSummary}`
          : null,
        `Readiness phrasing for the match: ${ctx.readinessSummary}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

      const aiResult = await generate(
        {
          provider: "anthropic",
          system,
          user: userContent,
          expectJson: true,
          requireContentConsent: true,
          userId,
          context: { toolName: "Conversation Starters" },
          maxTokens: 800,
        },
        "",
      );

      if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
        const parsed = JSON.parse(aiResult.output) as {
          starters?: { text?: unknown; rationale?: unknown }[];
        };
        const clean = Array.isArray(parsed.starters)
          ? parsed.starters
              .map((s) => ({
                text: String(s?.text ?? "").trim(),
                rationale: String(s?.rationale ?? "").trim(),
              }))
              .filter((s) => s.text.length > 0 && s.rationale.length > 0)
              .slice(0, 3)
          : [];
        if (clean.length === 3) {
          starters = clean;
          mode = "ai";
        }
      } else if (aiResult.fallbackReason) {
        req.log.info(
          {
            connectionId: connection.id,
            fallbackReason: aiResult.fallbackReason,
          },
          "starters fell back to deterministic baseline",
        );
      }
    } catch (err) {
      starters = deterministic.starters;
      mode = "deterministic";
      req.log.warn(
        { err, connectionId: connection.id },
        "starters deep-AI lane threw; using deterministic baseline",
      );
    }

    res.json({ starters, mode });
  },
);

// The single city-leak chokepoint for date ideas. The counterpart's city may be
// named ONLY when they turned reveal consent on, or when both people gave the
// same city (so naming it reveals nothing new). Otherwise we pitch on the
// signed-in user's OWN city (their own data, safe to name) framed as "near you",
// or stay fully generic with "near both of you" when we have no city at all.
// Returns an adverbial phrase that reads naturally inside the idea copy, e.g.
// "in Austin", "near you in Seattle", "near both of you".
function buildDateLocationLabel(opts: {
  revealed: boolean;
  myCity: string | null;
  theirCity: string | null;
  sameCity: boolean;
}): string {
  const { revealed, myCity, theirCity, sameCity } = opts;
  if (revealed && theirCity && canonicalizeCity(theirCity).length > 0) {
    return `in ${titleCaseCity(canonicalizeCity(theirCity))}`;
  }
  if (sameCity && myCity && canonicalizeCity(myCity).length > 0) {
    return `in ${titleCaseCity(canonicalizeCity(myCity))}`;
  }
  if (myCity && canonicalizeCity(myCity).length > 0) {
    return `near you in ${titleCaseCity(canonicalizeCity(myCity))}`;
  }
  return "near both of you";
}

// POST /me/connections/:id/date-ideas — a short set of date ideas sized to where
// both people are. User-initiated (a POST), so it only spends the deep AI lane
// when the user actually asks for ideas. Location phrasing is reveal-safe (see
// buildDateLocationLabel: counterpart city named only when revealed or shared).
// Hybrid: the deterministic category templates always run; the deep AI lane is
// layered on when the account opted in, and any failure, missing consent, or cap
// hit silently keeps the deterministic ideas. A maps provider can be wired later
// without changing the contract; until then ideas are template-based, never
// invented venues.
router.post(
  "/me/connections/:id/date-ideas",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const connection = await loadConnectionForUser(
      String(req.params.id ?? ""),
      userId,
    );
    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    // A closed or reported thread cannot get fresh ideas; the frontend hides the
    // card, and gating here keeps a stale tab from spending a deep-AI-lane token
    // on a connection that is already over.
    if (connection.status !== "active") {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }
    const counterpart = counterpartOf(connection, userId);

    const [membership] = await db
      .select({ revealConsent: matchPoolMembershipTable.revealConsent })
      .from(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, counterpart))
      .limit(1);
    const revealed = membership?.revealConsent === true;

    // Both members' free-text city hints. The counterpart's value is used ONLY
    // to decide whether the cities match; it is never echoed back unless the
    // reveal-safe label above is allowed to name it.
    const [minePrefs] = await db
      .select({ cityHint: matchPreferencesTable.cityHint })
      .from(matchPreferencesTable)
      .where(eq(matchPreferencesTable.userId, userId))
      .limit(1);
    const [theirPrefs] = await db
      .select({ cityHint: matchPreferencesTable.cityHint })
      .from(matchPreferencesTable)
      .where(eq(matchPreferencesTable.userId, counterpart))
      .limit(1);
    const myCity = minePrefs?.cityHint?.trim() || null;
    const theirCity = theirPrefs?.cityHint?.trim() || null;
    const myCanon = canonicalizeCity(myCity);
    const theirCanon = canonicalizeCity(theirCity);
    const sameCity = myCanon.length > 0 && myCanon === theirCanon;

    const locationLabel = buildDateLocationLabel({
      revealed,
      myCity,
      theirCity,
      sameCity,
    });

    const pair = await loadPairCompatibility(userId, counterpart);

    // Real venues only when a maps provider is configured (null today). The
    // provider is told a single safe city: the named city when we are allowed to
    // name one, otherwise the user's own city. Never the counterpart's hidden
    // city. Fail soft so a flaky provider never breaks the endpoint.
    let places: PlaceSuggestion[] | null = null;
    const provider = getPlacesProvider();
    if (provider) {
      const lookupCity =
        revealed && theirCity ? theirCity : sameCity ? myCity : myCity;
      if (lookupCity) {
        try {
          const [coffee, food] = await Promise.all([
            provider.nearby(lookupCity, "coffee", 1),
            provider.nearby(lookupCity, "food", 1),
          ]);
          const merged = [...coffee, ...food];
          places = merged.length > 0 ? merged : null;
        } catch (err) {
          req.log.warn(
            { err, connectionId: connection.id },
            "places provider lookup failed; using template-only date ideas",
          );
          places = null;
        }
      }
    }

    // One shared, reveal-safe context object feeds BOTH the deterministic
    // generator and the Claude prompt, so there is a single leak chokepoint.
    const ctx = {
      locationLabel,
      compatibilityScore: pair?.compatibilityScore ?? null,
      places,
    };

    const deterministic = generateDateIdeas(ctx);
    let ideas = deterministic.ideas;
    let mode: "deterministic" | "ai" = "deterministic";

    try {
      const system = [
        "You are Echo, the MatchLab Club connection coach. The signed-in user matched",
        "with someone and wants a few date ideas. You are given ONLY a reveal-safe",
        "location label and an aggregate compatibility score. Use only what is provided.",
        "Never invent specific venue or business names unless they are listed for you.",
        "Never reveal or guess the other person's exact city: use the location label",
        "exactly as written, and never quote the score inside the idea copy.",
        "",
        "Return JSON only. No prose, no code fences. Match this shape exactly:",
        '{ "ideas": [ { "title": "short name", "description": "one or two lines on what the date is and why it suits this pair, in a real human voice", "category": "coffee|food|outdoors|culture|active|low-key" } ] }',
        "",
        "Give between 4 and 6 ideas across different categories. Each must be something",
        "two people who just matched could realistically do. Keep them concrete but",
        "venue-agnostic unless venues are provided.",
        "Voice rules: no em dashes. No emojis. No filler words like 'unlock', 'leverage',",
        "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge', 'dive",
        "in', 'buckle up', or 'in today's world'. Vary sentence length. Sound human.",
      ].join("\n");

      const providedVenues =
        places && places.length > 0
          ? `Real venues you may name (category: name): ${places
              .map((p) => `${p.category}: ${p.name}`)
              .join("; ")}`
          : "No specific venues are available, stay venue-agnostic.";

      const userContent = [
        `Location label to reuse verbatim: ${locationLabel}`,
        ctx.compatibilityScore != null
          ? `Compatibility score (0 to 100, context only, never quote it back): ${ctx.compatibilityScore}`
          : "Compatibility score: not available",
        providedVenues,
      ].join("\n");

      const aiResult = await generate(
        {
          provider: "anthropic",
          system,
          user: userContent,
          expectJson: true,
          requireContentConsent: true,
          userId,
          context: { toolName: "Date Ideas" },
          maxTokens: 900,
        },
        "",
      );

      if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
        const parsed = JSON.parse(aiResult.output) as {
          ideas?: {
            title?: unknown;
            description?: unknown;
            category?: unknown;
          }[];
        };
        const clean = Array.isArray(parsed.ideas)
          ? parsed.ideas
              .map((i) => ({
                title: String(i?.title ?? "").trim(),
                description: String(i?.description ?? "").trim(),
                category: String(i?.category ?? "").trim() || "low-key",
              }))
              .filter((i) => i.title.length > 0 && i.description.length > 0)
              .slice(0, 6)
          : [];
        if (clean.length >= 3) {
          ideas = clean;
          mode = "ai";
        }
      } else if (aiResult.fallbackReason) {
        req.log.info(
          {
            connectionId: connection.id,
            fallbackReason: aiResult.fallbackReason,
          },
          "date ideas fell back to deterministic baseline",
        );
      }
    } catch (err) {
      ideas = deterministic.ideas;
      mode = "deterministic";
      req.log.warn(
        { err, connectionId: connection.id },
        "date ideas deep-AI lane threw; using deterministic baseline",
      );
    }

    res.json({ ideas, mode, locationLabel });
  },
);

export default router;
