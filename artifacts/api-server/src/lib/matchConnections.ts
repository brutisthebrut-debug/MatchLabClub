import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  matchConnectionsTable,
  companionNotificationsTable,
  pushTokensTable,
  orderConnectionPair,
  type MatchConnection,
} from "@workspace/db";
import { logger } from "./logger";
import { sendExpoPushNotifications, isValidExpoPushToken } from "./expoPush";
import { pairIsBlocked } from "./userBlocks";

// Create (or fetch) the single connection for a mutual pair. Idempotent: the
// partial unique index on the ordered (low, high) pair means concurrent
// mutual_yes flips collide here and resolve to one row via ON CONFLICT DO
// NOTHING. Returns the connection and whether this call created it, so callers
// only fire the "it's a match" notification once.
export async function ensureConnection(
  userA: string,
  userB: string,
): Promise<{ connection: MatchConnection; created: boolean }> {
  const pair = orderConnectionPair(userA, userB);
  const inserted = await db
    .insert(matchConnectionsTable)
    .values({ userLowId: pair.userLowId, userHighId: pair.userHighId })
    .onConflictDoNothing({
      target: [
        matchConnectionsTable.userLowId,
        matchConnectionsTable.userHighId,
      ],
    })
    .returning();
  if (inserted[0]) {
    return { connection: inserted[0], created: true };
  }
  const existing = await db
    .select()
    .from(matchConnectionsTable)
    .where(
      and(
        eq(matchConnectionsTable.userLowId, pair.userLowId),
        eq(matchConnectionsTable.userHighId, pair.userHighId),
      ),
    )
    .limit(1);
  // A previously closed connection is reopened when the pair matches again,
  // unless a block now stands between them (a report also blocks). The matching
  // engine already drops blocked pairs from the pool, so a fresh mutual_yes
  // should not reach here; this keeps the safety rule local and explicit.
  if (existing[0] && existing[0].status !== "active") {
    if (await pairIsBlocked(pair.userLowId, pair.userHighId)) {
      return { connection: existing[0], created: false };
    }
    const [reopened] = await db
      .update(matchConnectionsTable)
      .set({
        status: "active",
        closedReason: null,
        closedByUserId: null,
        datePlannedAt: null,
        dateCompletedAt: null,
      })
      .where(eq(matchConnectionsTable.id, existing[0].id))
      .returning();
    return { connection: reopened ?? existing[0], created: false };
  }
  return { connection: existing[0]!, created: false };
}

async function validTokensForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));
  const out: string[] = [];
  for (const r of rows) {
    if (await isValidExpoPushToken(r.token)) out.push(r.token);
  }
  return out;
}

// "It's a match" notification for both sides, with a push when a device token
// exists. In-app row always written so the bell + feed surface it even with no
// push token. Best-effort: a notification failure never blocks the match.
export async function notifyNewMatch(
  connection: MatchConnection,
): Promise<void> {
  const href = `/connections/${connection.id}`;
  const parties = [connection.userLowId, connection.userHighId];
  try {
    await db.insert(companionNotificationsTable).values(
      parties.map((userId) => ({
        userId,
        source: "system",
        kind: "match_new",
        title: "It is a match",
        body: "You both said yes. Say hello and start the conversation.",
        ctaHref: href,
        ctaLabel: "Open the conversation",
      })),
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to write new-match notifications",
    );
  }
  for (const userId of parties) {
    try {
      const tokens = await validTokensForUser(userId);
      if (tokens.length === 0) continue;
      await sendExpoPushNotifications(
        tokens.map((token) => ({
          to: token,
          title: "It is a match",
          body: "You both said yes. Tap to say hello.",
          sound: "default",
          data: { type: "match-new", connectionId: connection.id },
        })),
      );
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to push new-match notification",
      );
    }
  }
}

// New-message notification for the recipient. Cooldowned: while an unread
// "match_message" notification for this connection already exists, we do not
// stack another (and do not re-push), so a burst of messages produces one
// unread nudge until the recipient opens the thread.
export async function notifyNewMessage(
  connection: MatchConnection,
  recipientId: string,
): Promise<void> {
  const href = `/connections/${connection.id}`;
  try {
    const existing = await db
      .select({ id: companionNotificationsTable.id })
      .from(companionNotificationsTable)
      .where(
        and(
          eq(companionNotificationsTable.userId, recipientId),
          eq(companionNotificationsTable.kind, "match_message"),
          eq(companionNotificationsTable.ctaHref, href),
          isNull(companionNotificationsTable.readAt),
        ),
      )
      .limit(1);
    if (existing[0]) return;
    await db.insert(companionNotificationsTable).values({
      userId: recipientId,
      source: "system",
      kind: "match_message",
      title: "New message from your match",
      body: "You have a new message waiting. Tap to read and reply.",
      ctaHref: href,
      ctaLabel: "Read the message",
    });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to write new-message notification",
    );
    return;
  }
  try {
    const tokens = await validTokensForUser(recipientId);
    if (tokens.length === 0) return;
    await sendExpoPushNotifications(
      tokens.map((token) => ({
        to: token,
        title: "New message from your match",
        body: "You have a new message waiting. Tap to reply.",
        sound: "default",
        data: { type: "match-message", connectionId: connection.id },
      })),
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to push new-message notification",
    );
  }
}
