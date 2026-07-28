import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  companionNotificationsTable,
  pushTokensTable,
  type MatchConnection,
} from "@workspace/db";
import { logger } from "./logger";
import { sendExpoPushNotifications, isValidExpoPushToken } from "./expoPush";

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
