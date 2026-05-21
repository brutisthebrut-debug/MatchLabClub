import { sql, eq } from "drizzle-orm";
import {
  db,
  aiToolAlertStateTable,
  founderSettingsTable,
  FOUNDER_SETTINGS_REBREACH_COOLDOWN,
} from "@workspace/db";
import { sendMail } from "./mailer";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";

const AI_RELIABILITY_ALERTS_JOB = "ai_reliability_alerts";

export const ALERT_WINDOW = 50;
export const ALERT_MIN_SAMPLE = 10;
export const ALERT_THRESHOLD = 0.7;
export const DEFAULT_SEND_FAILURE_ALERT_THRESHOLD = 3;

const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_REBREACH_COOLDOWN_MINUTES = 15;

export function getEnvRebreachCooldownMinutes(): number {
  return readPositiveNumberEnv(
    "AI_RELIABILITY_REBREACH_COOLDOWN_MINUTES",
    DEFAULT_REBREACH_COOLDOWN_MINUTES,
  );
}

export { DEFAULT_REBREACH_COOLDOWN_MINUTES };

export async function getRebreachCooldownMs(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(founderSettingsTable)
      .where(eq(founderSettingsTable.key, FOUNDER_SETTINGS_REBREACH_COOLDOWN))
      .limit(1);
    const minutes =
      row != null ? row.value : getEnvRebreachCooldownMinutes();
    return minutes * 60 * 1000;
  } catch {
    return getEnvRebreachCooldownMinutes() * 60 * 1000;
  }
}

export const PERSISTENT_SEND_FAILURE_EVENT =
  "ai_reliability_email_delivery_persistently_failing";

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function getSendFailureAlertThreshold(): number {
  return readPositiveIntEnv(
    "AI_RELIABILITY_SEND_FAILURE_ALERT_THRESHOLD",
    DEFAULT_SEND_FAILURE_ALERT_THRESHOLD,
  );
}

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getFounderRecipient(): string | null {
  const v =
    process.env["FOUNDER_ALERT_EMAIL"]?.trim() ||
    process.env["FOUNDER_EMAIL"]?.trim();
  return v && v.length > 0 ? v : null;
}

interface RecentRow {
  tool_name: string;
  recent_total: string | number;
  recent_first_try_ok: string | number;
  [key: string]: unknown;
}

export interface AlertCheckResult {
  breached: string[];
  cleared: string[];
}

async function fetchRecentByTool(
  toolNames?: readonly string[],
): Promise<Map<string, { total: number; firstTryOk: number }>> {
  const filter =
    toolNames && toolNames.length > 0
      ? sql`where tool_name in ${sql.raw(
          `(${toolNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(",")})`,
        )}`
      : sql``;
  const result = await db.execute<RecentRow>(sql`
    select
      tool_name,
      count(*) as recent_total,
      sum(case when attempts = 1 and is_fallback = false then 1 else 0 end) as recent_first_try_ok
    from (
      select
        tool_name,
        attempts,
        is_fallback,
        row_number() over (partition by tool_name order by created_at desc) as rn
      from ai_request_metrics
      ${filter}
    ) t
    where rn <= ${ALERT_WINDOW}
    group by tool_name
  `);

  const map = new Map<string, { total: number; firstTryOk: number }>();
  for (const r of result.rows ?? []) {
    map.set(r.tool_name, {
      total: Number(r.recent_total ?? 0),
      firstTryOk: Number(r.recent_first_try_ok ?? 0),
    });
  }
  return map;
}

function formatBreachDuration(start: Date, end: Date): string {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "less than a minute";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  return parts.join(" ") || `${totalMinutes}m`;
}

async function sendRecoveredEmail(
  toolName: string,
  total: number,
  rate: number,
  firstBreachedAt: Date | null,
  now: Date,
): Promise<void> {
  const to = getFounderRecipient();
  const pct = (rate * 100).toFixed(1);
  const thresholdPct = (ALERT_THRESHOLD * 100).toFixed(0);
  const duration = firstBreachedAt
    ? formatBreachDuration(firstBreachedAt, now)
    : "unknown";
  const subject = `[NLDC] AI reliability recovered: ${toolName} back to ${pct}%`;
  const text = [
    `The "${toolName}" AI tool's first-try success rate has recovered above the alert threshold.`,
    "",
    `- Recent window: last ${total} requests`,
    `- First-try success rate: ${pct}%`,
    `- Threshold: ${thresholdPct}%`,
    `- Breach lasted: ${duration}`,
    "",
    "You won't be notified again unless it drops below the threshold again.",
  ].join("\n");

  if (!to) {
    logger.warn(
      { toolName, total, rate },
      "AI reliability recovery detected but FOUNDER_ALERT_EMAIL is not set; skipping email send",
    );
    return;
  }

  await sendMail({ to, subject, text });
  logger.info(
    { toolName, total, rate, to },
    "Sent AI reliability recovered notification",
  );
}

async function sendBreachEmail(
  toolName: string,
  total: number,
  rate: number,
): Promise<void> {
  const to = getFounderRecipient();
  const pct = (rate * 100).toFixed(1);
  const thresholdPct = (ALERT_THRESHOLD * 100).toFixed(0);
  const subject = `[NLDC] AI reliability alert: ${toolName} first-try rate dropped to ${pct}%`;
  const text = [
    `The "${toolName}" AI tool's first-try success rate has dropped below the alert threshold.`,
    "",
    `- Recent window: last ${total} requests`,
    `- First-try success rate: ${pct}%`,
    `- Threshold: ${thresholdPct}%`,
    "",
    "This is a one-time alert. You won't be notified again for this tool until it recovers above the threshold and then drops below it again.",
    "",
    "Open the founder dashboard to investigate.",
  ].join("\n");

  if (!to) {
    logger.warn(
      { toolName, total, rate },
      "AI reliability breach detected but FOUNDER_ALERT_EMAIL is not set; skipping email send",
    );
    return;
  }

  await sendMail({ to, subject, text });
  logger.info(
    { toolName, total, rate, to },
    "Sent AI reliability breach notification",
  );
}

async function recordSendFailure(
  toolName: string,
  kind: "breach" | "recovered",
  err: unknown,
  now: Date,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const upserted = await db
    .insert(aiToolAlertStateTable)
    .values({
      toolName,
      breached: false,
      consecutiveSendFailures: 1,
      lastSendFailureAt: now,
      lastSendFailureMessage: message,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiToolAlertStateTable.toolName,
      set: {
        consecutiveSendFailures: sql`${aiToolAlertStateTable.consecutiveSendFailures} + 1`,
        lastSendFailureAt: now,
        lastSendFailureMessage: message,
        updatedAt: now,
      },
    })
    .returning({
      consecutiveSendFailures: aiToolAlertStateTable.consecutiveSendFailures,
    });

  const failureCount = upserted[0]?.consecutiveSendFailures ?? 1;
  const threshold = getSendFailureAlertThreshold();

  if (failureCount >= threshold) {
    logger.error(
      {
        event: PERSISTENT_SEND_FAILURE_EVENT,
        toolName,
        kind,
        failureCount,
        threshold,
        err: message,
      },
      `AI reliability ${kind} email has failed ${failureCount} consecutive times; founder alerting for "${toolName}" is degraded`,
    );
  } else {
    logger.error(
      { err: message, toolName, failureCount },
      `Failed to send AI reliability ${kind} email; will retry on next check`,
    );
  }
}

async function resetSendFailureCounter(toolName: string): Promise<void> {
  await db
    .update(aiToolAlertStateTable)
    .set({
      consecutiveSendFailures: 0,
      lastSendFailureMessage: null,
    })
    .where(eq(aiToolAlertStateTable.toolName, toolName));
}

export async function checkAiReliabilityAlerts(
  options: { toolNames?: readonly string[] } = {},
): Promise<AlertCheckResult> {
  const { toolNames } = options;
  const recent = await fetchRecentByTool(toolNames);
  const allStates = await db.select().from(aiToolAlertStateTable);
  const states =
    toolNames && toolNames.length > 0
      ? allStates.filter((s) => toolNames.includes(s.toolName))
      : allStates;
  const stateByTool = new Map(states.map((s) => [s.toolName, s]));

  const breached: string[] = [];
  const cleared: string[] = [];

  for (const [toolName, r] of recent) {
    const rate = r.total > 0 ? r.firstTryOk / r.total : 0;
    const isBreached = r.total >= ALERT_MIN_SAMPLE && rate < ALERT_THRESHOLD;
    const prev = stateByTool.get(toolName);
    const wasBreached = prev?.breached ?? false;
    const now = new Date();

    if (isBreached && !wasBreached) {
      // Cooldown: if the tool recently recovered, suppress the new breach
      // email until enough healthy time has passed. We still record the
      // re-breach in state so the dashboard reflects reality.
      const cooldownMs = await getRebreachCooldownMs();
      const lastClearedAt = prev?.lastClearedAt ?? null;
      const inCooldown =
        lastClearedAt !== null &&
        now.getTime() - lastClearedAt.getTime() < cooldownMs;

      if (inCooldown) {
        logger.info(
          {
            toolName,
            total: r.total,
            rate,
            lastClearedAt,
            cooldownMs,
          },
          "Suppressing AI reliability breach email — tool re-breached inside cooldown window",
        );
        await db
          .update(aiToolAlertStateTable)
          .set({
            breached: true,
            firstBreachedAt: now,
            lastRecentTotal: r.total,
            lastRecentFirstTrySuccessRate: rate,
            updatedAt: now,
          })
          .where(eq(aiToolAlertStateTable.toolName, toolName));
        continue;
      }

      // Send notification FIRST. Only mark the tool as breached if delivery
      // succeeds (or there is no recipient configured — in which case the
      // logged warning counts as the one-time notification). If the email
      // throws, we leave state unchanged so the next scheduled run retries.
      let notified = false;
      let sendError: unknown = null;
      try {
        await sendBreachEmail(toolName, r.total, rate);
        notified = true;
      } catch (err) {
        sendError = err;
      }

      if (notified) {
        await db
          .insert(aiToolAlertStateTable)
          .values({
            toolName,
            breached: true,
            firstBreachedAt: now,
            lastNotifiedAt: now,
            lastRecentTotal: r.total,
            lastRecentFirstTrySuccessRate: rate,
            consecutiveSendFailures: 0,
            lastSendFailureMessage: null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: aiToolAlertStateTable.toolName,
            set: {
              breached: true,
              firstBreachedAt: now,
              lastNotifiedAt: now,
              lastRecentTotal: r.total,
              lastRecentFirstTrySuccessRate: rate,
              consecutiveSendFailures: 0,
              lastSendFailureMessage: null,
              updatedAt: now,
            },
          });
        breached.push(toolName);
      } else if (sendError !== null) {
        await recordSendFailure(toolName, "breach", sendError, now);
        if (prev) {
          await db
            .update(aiToolAlertStateTable)
            .set({
              lastRecentTotal: r.total,
              lastRecentFirstTrySuccessRate: rate,
              updatedAt: now,
            })
            .where(eq(aiToolAlertStateTable.toolName, toolName));
        }
      } else if (prev) {
        // Refresh observed stats without flipping breached, so the next
        // scheduled check still sees the breach and retries the email.
        await db
          .update(aiToolAlertStateTable)
          .set({
            lastRecentTotal: r.total,
            lastRecentFirstTrySuccessRate: rate,
            updatedAt: now,
          })
          .where(eq(aiToolAlertStateTable.toolName, toolName));
      }
    } else if (!isBreached && wasBreached) {
      let notified = false;
      let sendError: unknown = null;
      try {
        await sendRecoveredEmail(
          toolName,
          r.total,
          rate,
          prev?.firstBreachedAt ?? null,
          now,
        );
        notified = true;
      } catch (err) {
        sendError = err;
      }

      if (notified) {
        await db
          .update(aiToolAlertStateTable)
          .set({
            breached: false,
            lastClearedAt: now,
            lastRecentTotal: r.total,
            lastRecentFirstTrySuccessRate: rate,
            consecutiveSendFailures: 0,
            lastSendFailureMessage: null,
            updatedAt: now,
          })
          .where(eq(aiToolAlertStateTable.toolName, toolName));
        cleared.push(toolName);
      } else if (sendError !== null) {
        await recordSendFailure(toolName, "recovered", sendError, now);
        if (prev) {
          await db
            .update(aiToolAlertStateTable)
            .set({
              lastRecentTotal: r.total,
              lastRecentFirstTrySuccessRate: rate,
              updatedAt: now,
            })
            .where(eq(aiToolAlertStateTable.toolName, toolName));
        }
      } else if (prev) {
        await db
          .update(aiToolAlertStateTable)
          .set({
            lastRecentTotal: r.total,
            lastRecentFirstTrySuccessRate: rate,
            updatedAt: now,
          })
          .where(eq(aiToolAlertStateTable.toolName, toolName));
      }
    } else if (prev) {
      await db
        .update(aiToolAlertStateTable)
        .set({
          lastRecentTotal: r.total,
          lastRecentFirstTrySuccessRate: rate,
          updatedAt: now,
        })
        .where(eq(aiToolAlertStateTable.toolName, toolName));
    }
  }

  return { breached, cleared };
}

/**
 * Run a reliability check and record the job heartbeat on success.
 *
 * Pass `jobName` to write the heartbeat under a different key.
 * Production scheduler omits it (uses `AI_RELIABILITY_ALERTS_JOB`);
 * tests pass a unique per-test key so parallel workers never share the
 * same heartbeat row.
 */
export async function runAiReliabilityAlertsCheck(options?: {
  toolNames?: readonly string[];
  jobName?: string;
}): Promise<AlertCheckResult> {
  const heartbeatJobName = options?.jobName ?? AI_RELIABILITY_ALERTS_JOB;
  const res = await checkAiReliabilityAlerts({ toolNames: options?.toolNames });
  if (res.breached.length > 0 || res.cleared.length > 0) {
    logger.info(
      { breached: res.breached, cleared: res.cleared },
      "AI reliability alert state transitions",
    );
  }
  await recordJobHeartbeat(heartbeatJobName);
  return res;
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAiReliabilityAlertsJob(): void {
  if (scheduledTimer) return;
  const intervalMinutes = readPositiveNumberEnv(
    "AI_RELIABILITY_ALERT_INTERVAL_MINUTES",
    DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = (): void => {
    runAiReliabilityAlertsCheck().catch((err: unknown) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "AI reliability alerts check failed",
      );
    });
  };

  run();

  scheduledTimer = setInterval(run, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    {
      intervalMinutes,
      threshold: ALERT_THRESHOLD,
      window: ALERT_WINDOW,
      minSample: ALERT_MIN_SAMPLE,
      recipientConfigured: getFounderRecipient() !== null,
    },
    "Started AI reliability alerts job",
  );
}

export function stopAiReliabilityAlertsJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
