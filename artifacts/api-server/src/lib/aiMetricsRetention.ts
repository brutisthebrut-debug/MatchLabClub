import { lt } from "drizzle-orm";
import { db, aiRequestMetricsTable } from "@workspace/db";
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

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAiMetricsRetentionJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "AI_METRICS_RETENTION_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void pruneOldAiMetrics();

  scheduledTimer = setInterval(() => {
    void pruneOldAiMetrics();
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
