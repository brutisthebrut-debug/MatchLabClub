import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  pushTokensTable,
  matchingReadinessSnapshotsTable,
  matchingNudgeStateTable,
  jobHeartbeatsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat, getStaleThresholdMs } from "./jobHeartbeat";
import { sendExpoPushNotifications, isValidExpoPushToken } from "./expoPush";
import { effectiveReadinessThreshold, loadBrainControls } from "./brainConfig";

const MATCHING_NUDGE_JOB = "matching_nudge";
const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_COOLDOWN_HOURS = 72;
const DEFAULT_THRESHOLD = 50;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function readinessThreshold(): Promise<number> {
  try {
    return await effectiveReadinessThreshold();
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

function describeNudge(score: number, threshold: number): {
  title: string;
  body: string;
} {
  const gap = Math.max(1, threshold - score);
  return {
    title: "You are close to matching",
    body: `You are ${gap} point${gap === 1 ? "" : "s"} from the match pool. One compass read or post-date note gets you there. Tap to see your next step.`,
  };
}

/**
 * Notify users who have engaged (have at least one readiness snapshot) but
 * stalled below the match threshold, nudging them toward the next step.
 * Rate-limited per user via `matching_nudge_state` so we never spam.
 */
export async function sendMatchingNudges(options?: {
  jobName?: string;
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? MATCHING_NUDGE_JOB;
  const threshold = await readinessThreshold();
  const cooldownMs =
    readPositiveNumberEnv("MATCHING_NUDGE_COOLDOWN_HOURS", DEFAULT_COOLDOWN_HOURS) *
    60 *
    60 *
    1000;
  const now = Date.now();

  try {
    const tokenRows = await db
      .select({ userId: pushTokensTable.userId, token: pushTokensTable.token })
      .from(pushTokensTable);

    if (tokenRows.length === 0) {
      await recordJobHeartbeat(heartbeatJobName);
      return 0;
    }

    const userIds = [...new Set(tokenRows.map((r) => r.userId))];

    // Latest readiness score per user, taken from the most recent snapshot.
    const scoreRows = await db
      .select({
        userId: matchingReadinessSnapshotsTable.userId,
        score: matchingReadinessSnapshotsTable.score,
        createdAt: matchingReadinessSnapshotsTable.createdAt,
      })
      .from(matchingReadinessSnapshotsTable)
      .where(inArray(matchingReadinessSnapshotsTable.userId, userIds))
      .orderBy(desc(matchingReadinessSnapshotsTable.createdAt));

    const latestScoreByUser = new Map<string, number>();
    for (const row of scoreRows) {
      if (!latestScoreByUser.has(row.userId)) {
        latestScoreByUser.set(row.userId, Number(row.score));
      }
    }

    const stateRows = await db
      .select()
      .from(matchingNudgeStateTable)
      .where(inArray(matchingNudgeStateTable.userId, userIds));
    const stateByUser = new Map(stateRows.map((r) => [r.userId, r]));

    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows) {
      const list = tokensByUser.get(row.userId) ?? [];
      list.push(row.token);
      tokensByUser.set(row.userId, list);
    }

    const messages: {
      to: string;
      title: string;
      body: string;
      sound: "default";
      data: Record<string, unknown>;
    }[] = [];
    const nudgedUserIds: { userId: string; score: number }[] = [];

    for (const userId of userIds) {
      const score = latestScoreByUser.get(userId);
      if (score === undefined || score >= threshold) continue;

      const state = stateByUser.get(userId);
      if (state?.lastNudgedAt) {
        const last =
          state.lastNudgedAt instanceof Date
            ? state.lastNudgedAt.getTime()
            : new Date(String(state.lastNudgedAt)).getTime();
        if (now - last < cooldownMs) continue;
        // Do not re-nudge if the user has not moved since the last nudge.
        if (state.lastSeenScore !== null && state.lastSeenScore === score) {
          continue;
        }
      }

      const tokens = tokensByUser.get(userId) ?? [];
      const validTokens: string[] = [];
      for (const token of tokens) {
        if (await isValidExpoPushToken(token)) validTokens.push(token);
      }
      if (validTokens.length === 0) continue;

      const { title, body } = describeNudge(score, threshold);
      for (const token of validTokens) {
        messages.push({
          to: token,
          title,
          body,
          sound: "default",
          data: { type: "matching-nudge" },
        });
      }
      nudgedUserIds.push({ userId, score });
    }

    if (messages.length === 0) {
      await recordJobHeartbeat(heartbeatJobName);
      logger.debug({ threshold }, "No matching nudges to send");
      return 0;
    }

    await sendExpoPushNotifications(messages);

    for (const { userId, score } of nudgedUserIds) {
      await db
        .insert(matchingNudgeStateTable)
        .values({
          userId,
          lastNudgedAt: new Date(now),
          lastSeenScore: score,
        })
        .onConflictDoUpdate({
          target: matchingNudgeStateTable.userId,
          set: { lastNudgedAt: new Date(now), lastSeenScore: score },
        });
    }

    await recordJobHeartbeat(heartbeatJobName);
    logger.info(
      { notifiedUsers: nudgedUserIds.length, messagesSent: messages.length },
      "Sent matching nudges",
    );
    return messages.length;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to send matching nudges",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

// One scheduled tick. The timer always runs; whether a nudge sweep actually
// fires is gated on the live founder control (seeded from MATCHING_NUDGE_ENABLED),
// so the founder can flip re-engagement nudges on or off from the control center
// with no redeploy. The sweep itself stays ungated so direct and test callers are
// never blocked.
export async function matchingNudgeTick(): Promise<void> {
  try {
    const controls = await loadBrainControls();
    if (!controls.matchingNudgeEnabled) return;
    await sendMatchingNudges();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Matching nudge tick failed to read controls; skipping this run",
    );
  }
}

export function startMatchingNudgeJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "MATCHING_NUDGE_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void matchingNudgeTick();

  scheduledTimer = setInterval(() => {
    void matchingNudgeTick();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { intervalHours },
    "Started matching nudge job (gated by founder control)",
  );
}

export function stopMatchingNudgeJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}

export function getMatchingNudgeStaleThresholdMs(): number {
  return getStaleThresholdMs(MATCHING_NUDGE_JOB);
}

export async function getMatchingNudgeHeartbeat(): Promise<Date | null> {
  const rows = await db
    .select({ lastSuccessAt: jobHeartbeatsTable.lastSuccessAt })
    .from(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, MATCHING_NUDGE_JOB))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.lastSuccessAt instanceof Date
    ? row.lastSuccessAt
    : new Date(row.lastSuccessAt as unknown as string);
}
