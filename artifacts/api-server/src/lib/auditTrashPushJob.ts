import { and, asc, inArray, isNotNull } from "drizzle-orm";
import { db, auditsTable, pushTokensTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";
import { getRetentionDays } from "./auditTrashPurge";

const AUDIT_TRASH_PUSH_JOB = "audit_trash_push";
const WITHIN_DAYS = 3;
const DEFAULT_INTERVAL_HOURS = 24;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function describeExpiringMessage(opts: {
  count: number;
  earliestDaysLeft: number;
}): { title: string; body: string } {
  const { count, earliestDaysLeft } = opts;
  const noun = count === 1 ? "audit" : "audits";
  void noun;
  const when =
    earliestDaysLeft <= 0
      ? "today"
      : earliestDaysLeft === 1
        ? "tomorrow"
        : `in ${earliestDaysLeft} days`;
  return {
    title:
      count === 1
        ? "An audit is about to be deleted"
        : `${count} audits are about to be deleted`,
    body: `${count === 1 ? "It" : "The earliest"} purges ${when}. Tap to restore from Recently deleted.`,
  };
}

type ExpoPushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const { Expo } = (await import("expo-server-sdk")) as typeof import("expo-server-sdk");
  const expo = new Expo();

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          logger.warn(
            { error: ticket.details?.error ?? ticket.message },
            "Expo push ticket error",
          );
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to send Expo push notification chunk",
      );
    }
  }
}

export async function sendExpiringAuditPushNotifications(options?: {
  jobName?: string;
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? AUDIT_TRASH_PUSH_JOB;
  const retentionDays = getRetentionDays();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const earliestDeletedMs = now - retentionDays * dayMs;
  const latestDeletedMs = now - (retentionDays - WITHIN_DAYS) * dayMs;

  try {
    const tokenRows = await db
      .select({
        userId: pushTokensTable.userId,
        token: pushTokensTable.token,
      })
      .from(pushTokensTable);

    if (tokenRows.length === 0) {
      await recordJobHeartbeat(heartbeatJobName);
      return 0;
    }

    const userIds = [...new Set(tokenRows.map((r) => r.userId))];

    const trashed = await db
      .select()
      .from(auditsTable)
      .where(
        and(
          inArray(auditsTable.userId, userIds),
          isNotNull(auditsTable.deletedAt),
        ),
      )
      .orderBy(asc(auditsTable.deletedAt));

    const expiringByUser = new Map<
      string,
      { ids: number[]; earliestDaysLeft: number }
    >();

    for (const audit of trashed) {
      if (!audit.deletedAt || !audit.userId) continue;
      const t =
        audit.deletedAt instanceof Date
          ? audit.deletedAt.getTime()
          : new Date(String(audit.deletedAt)).getTime();
      if (t < earliestDeletedMs || t >= latestDeletedMs) continue;

      const purgeAt = t + retentionDays * dayMs;
      const daysLeft = Math.ceil((purgeAt - now) / dayMs);

      const existing = expiringByUser.get(audit.userId);
      if (!existing) {
        expiringByUser.set(audit.userId, {
          ids: [audit.id],
          earliestDaysLeft: daysLeft,
        });
      } else {
        existing.ids.push(audit.id);
        if (daysLeft < existing.earliestDaysLeft) {
          existing.earliestDaysLeft = daysLeft;
        }
      }
    }

    if (expiringByUser.size === 0) {
      await recordJobHeartbeat(heartbeatJobName);
      logger.debug(
        { retentionDays, withinDays: WITHIN_DAYS },
        "No expiring audits to notify about",
      );
      return 0;
    }

    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows) {
      const list = tokensByUser.get(row.userId) ?? [];
      list.push(row.token);
      tokensByUser.set(row.userId, list);
    }

    const { Expo } = (await import("expo-server-sdk")) as typeof import("expo-server-sdk");
    const messages: ExpoPushMessage[] = [];

    for (const [userId, expiring] of expiringByUser) {
      const tokens = tokensByUser.get(userId) ?? [];
      if (tokens.length === 0) continue;

      const { title, body } = describeExpiringMessage({
        count: expiring.ids.length,
        earliestDaysLeft: expiring.earliestDaysLeft,
      });

      for (const token of tokens) {
        if (!Expo.isExpoPushToken(token)) {
          logger.warn({ userId, token }, "Skipping invalid Expo push token");
          continue;
        }
        messages.push({
          to: token,
          title,
          body,
          sound: "default",
          data: { type: "trash-purge-warning" },
        });
      }
    }

    await sendExpoPushNotifications(messages);
    await recordJobHeartbeat(heartbeatJobName);

    logger.info(
      { notifiedUsers: expiringByUser.size, messagesSent: messages.length },
      "Sent expiring audit push notifications",
    );

    return messages.length;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to send expiring audit push notifications",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAuditTrashPushJob(): void {
  if (scheduledTimer) return;

  const intervalHours = readPositiveNumberEnv(
    "AUDIT_TRASH_PUSH_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void sendExpiringAuditPushNotifications();

  scheduledTimer = setInterval(() => {
    void sendExpiringAuditPushNotifications();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { intervalHours, withinDays: WITHIN_DAYS },
    "Started audit trash push notification job",
  );
}

export function stopAuditTrashPushJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
