import { sql, eq } from "drizzle-orm";
import { db, aiToolAlertStateTable } from "@workspace/db";
import { sendMail } from "./mailer";
import { logger } from "./logger";

export const ALERT_WINDOW = 50;
export const ALERT_MIN_SAMPLE = 10;
export const ALERT_THRESHOLD = 0.7;

const DEFAULT_INTERVAL_MINUTES = 5;

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

async function fetchRecentByTool(): Promise<
  Map<string, { total: number; firstTryOk: number }>
> {
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

export async function checkAiReliabilityAlerts(): Promise<AlertCheckResult> {
  const recent = await fetchRecentByTool();
  const states = await db.select().from(aiToolAlertStateTable);
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
      // Send notification FIRST. Only mark the tool as breached if delivery
      // succeeds (or there is no recipient configured — in which case the
      // logged warning counts as the one-time notification). If the email
      // throws, we leave state unchanged so the next scheduled run retries.
      let notified = false;
      try {
        await sendBreachEmail(toolName, r.total, rate);
        notified = true;
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err), toolName },
          "Failed to send AI reliability breach email; will retry on next check",
        );
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
              updatedAt: now,
            },
          });
        breached.push(toolName);
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
      await db
        .update(aiToolAlertStateTable)
        .set({
          breached: false,
          lastClearedAt: now,
          lastRecentTotal: r.total,
          lastRecentFirstTrySuccessRate: rate,
          updatedAt: now,
        })
        .where(eq(aiToolAlertStateTable.toolName, toolName));
      cleared.push(toolName);
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

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAiReliabilityAlertsJob(): void {
  if (scheduledTimer) return;
  const intervalMinutes = readPositiveNumberEnv(
    "AI_RELIABILITY_ALERT_INTERVAL_MINUTES",
    DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = (): void => {
    checkAiReliabilityAlerts()
      .then((res) => {
        if (res.breached.length > 0 || res.cleared.length > 0) {
          logger.info(
            { breached: res.breached, cleared: res.cleared },
            "AI reliability alert state transitions",
          );
        }
      })
      .catch((err: unknown) => {
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
