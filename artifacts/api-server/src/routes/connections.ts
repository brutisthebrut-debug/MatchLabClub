import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  matchConnectionsTable,
  connectionMessagesTable,
  matchPoolMembershipTable,
  profilePhotosTable,
  usersTable,
  userBlocksTable,
  userReportsTable,
  companionNotificationsTable,
  insertConnectionMessageSchema,
  SAFETY_REASONS,
  type MatchConnection,
  type ConnectionMessage,
} from "@workspace/db";
import { z } from "zod/v4";
import { notifyNewMessage } from "../lib/matchConnections";
import { blockUserPair } from "../lib/userBlocks";
import { computeReadiness } from "./matching";

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
  extra?: { unreadCount?: number; lastMessagePreview?: string | null },
) {
  return {
    id: connection.id,
    counterpartUserId: counterpartOf(connection, userId),
    status: connection.status,
    closedReason: connection.closedReason ?? null,
    closedByYou: connection.closedByUserId === userId,
    lastMessageAt: toIso(connection.lastMessageAt),
    createdAt: toIso(connection.createdAt),
    unreadCount: extra?.unreadCount ?? 0,
    lastMessagePreview: extra?.lastMessagePreview ?? null,
  };
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
router.get("/me/connections", async (req: Request, res: Response): Promise<void> => {
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
    out.push(
      serializeConnection(connection, userId, {
        unreadCount: unread?.value ?? 0,
        lastMessagePreview: latest?.body ? latest.body.slice(0, 140) : null,
      }),
    );
  }
  res.json(out);
});

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
    res.json(serializeConnection(connection, userId));
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
      res
        .status(429)
        .json({ error: "You are sending messages too quickly. Try again in a moment." });
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

    req.log.info(
      { connectionId: connection.id },
      "connection.message sent",
    );
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
          eq(companionNotificationsTable.ctaHref, `/connections/${connection.id}`),
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
      .set({ status: "closed", closedReason: "unmatch", closedByUserId: userId })
      .where(eq(matchConnectionsTable.id, connection.id))
      .returning();
    req.log.info({ connectionId: connection.id }, "connection.unmatched");
    res.json(serializeConnection(updated ?? connection, userId));
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
    res.json(serializeConnection(updated ?? connection, userId));
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

    res.json({
      counterpartUserId: counterpart,
      revealed,
      displayName,
      photos,
      prompts: [],
      readinessSummary: readinessPhrase(readiness.score),
      valuesSummary:
        "Values come through in how this person shows up across the lanes they have shared. The more you talk, the clearer the fit.",
    });
  },
);

export default router;
