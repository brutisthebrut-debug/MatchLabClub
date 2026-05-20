import { lt, sql } from "drizzle-orm";
import { db, aiRequestMetricsTable, aiRequestMetricsDailyTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_INTERVAL_HOURS = 24;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getRetentionDays(): number {
  return readPositiveNumberEnv("AI_METRICS_RETENTION_DAYS", DEFAULT_RETENTION_DAYS);
}

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregate raw rows for the given UTC day into ai_request_metrics_daily.
 * Idempotent: re-running for the same day overwrites the existing rollup
 * via ON CONFLICT (day, tool_name).
 *
 * Returns the number of (tool_name, day) rollup rows written.
 * Throws on failure so callers can decide whether it is safe to prune.
 */
export async function rollupAiMetricsForDay(day: Date): Promise<number> {
  const dayStr = toDayString(day);
  const result = await db.execute<{ tool_name: string }>(sql`
    insert into ai_request_metrics_daily (
      day, tool_name, total, first_try_ok, retried_ok, fallbacks,
      validation_failures, avg_attempts, avg_duration_ms
    )
    select
      ${dayStr}::date as day,
      tool_name,
      count(*)::int as total,
      sum(case when attempts = 1 and is_fallback = false then 1 else 0 end)::int as first_try_ok,
      sum(case when attempts >= 2 and is_fallback = false then 1 else 0 end)::int as retried_ok,
      sum(case when is_fallback = true then 1 else 0 end)::int as fallbacks,
      sum(case when validated = false then 1 else 0 end)::int as validation_failures,
      coalesce(avg(attempts), 0)::double precision as avg_attempts,
      coalesce(avg(duration_ms), 0)::double precision as avg_duration_ms
    from ai_request_metrics
    where (created_at at time zone 'UTC') >= (${dayStr}::date at time zone 'UTC')
      and (created_at at time zone 'UTC') < ((${dayStr}::date + interval '1 day') at time zone 'UTC')
    group by tool_name
    on conflict (day, tool_name) do update set
      total = excluded.total,
      first_try_ok = excluded.first_try_ok,
      retried_ok = excluded.retried_ok,
      fallbacks = excluded.fallbacks,
      validation_failures = excluded.validation_failures,
      avg_attempts = excluded.avg_attempts,
      avg_duration_ms = excluded.avg_duration_ms
    returning tool_name
  `);
  const written = result.rows?.length ?? 0;
  if (written > 0) {
    logger.info({ day: dayStr, written }, "Wrote ai_request_metrics_daily rollup");
  } else {
    logger.debug({ day: dayStr }, "No ai_request_metrics rows to roll up for day");
  }
  return written;
}

/**
 * Roll up every UTC day from the oldest raw row up to (but not including) today.
 * This guarantees that no raw rows are pruned before being captured in the
 * daily rollup, even if the job has been offline for several days.
 *
 * Throws on failure — pruning must be skipped if rollup did not complete,
 * otherwise old raw rows would be deleted without their history captured.
 */
export async function rollupOldAiMetrics(): Promise<number> {
  const rows = await db.execute<{ min_day: string | null; today: string }>(sql`
    select
      to_char(min(created_at) at time zone 'UTC', 'YYYY-MM-DD') as min_day,
      to_char(now() at time zone 'UTC', 'YYYY-MM-DD') as today
    from ai_request_metrics
  `);
  const first = rows.rows?.[0];
  if (!first || !first.min_day) return 0;
  const start = new Date(`${first.min_day}T00:00:00Z`);
  const today = new Date(`${first.today}T00:00:00Z`);
  let total = 0;
  for (
    let d = new Date(start);
    d.getTime() < today.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    total += await rollupAiMetricsForDay(new Date(d));
  }
  return total;
}

export async function pruneOldAiMetrics(retentionDays: number = getRetentionDays()): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    const result = await db
      .delete(aiRequestMetricsTable)
      .where(lt(aiRequestMetricsTable.createdAt, cutoff))
      .returning({ id: aiRequestMetricsTable.id });
    const deleted = result.length;
    if (deleted > 0) {
      logger.info(
        { deleted, retentionDays, cutoff: cutoff.toISOString() },
        "Pruned old ai_request_metrics rows",
      );
    } else {
      logger.debug(
        { retentionDays, cutoff: cutoff.toISOString() },
        "No old ai_request_metrics rows to prune",
      );
    }
    return deleted;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to prune old ai_request_metrics rows",
    );
    return 0;
  }
}

/**
 * Roll up first, then prune. Fail-closed: if the rollup step throws, we
 * skip pruning entirely so raw rows are never deleted without their
 * history being captured in ai_request_metrics_daily.
 */
export async function rollupThenPruneAiMetrics(): Promise<{
  rolledUp: number;
  pruned: number;
  skippedPrune: boolean;
}> {
  let rolledUp: number;
  try {
    rolledUp = await rollupOldAiMetrics();
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "ai_request_metrics rollup failed — skipping prune to preserve trend history",
    );
    return { rolledUp: 0, pruned: 0, skippedPrune: true };
  }
  const pruned = await pruneOldAiMetrics();
  return { rolledUp, pruned, skippedPrune: false };
}

// Touch the typed table import so future direct queries stay type-checked.
void aiRequestMetricsDailyTable;

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAiMetricsRetentionJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "AI_METRICS_RETENTION_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void rollupThenPruneAiMetrics();

  scheduledTimer = setInterval(() => {
    void rollupThenPruneAiMetrics();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { retentionDays: getRetentionDays(), intervalHours },
    "Started ai_request_metrics retention job",
  );
}

export function stopAiMetricsRetentionJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
