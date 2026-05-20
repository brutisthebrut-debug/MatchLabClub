import { db, jobHeartbeatsTable } from "@workspace/db";
import { logger } from "./logger";

const STALE_THRESHOLDS_MS: Record<string, number> = {
  ai_metrics_rollup:          36 * 60 * 60 * 1000,
  ai_reliability_alerts:      10 * 60 * 1000,
  audit_trash_purge:          36 * 60 * 60 * 1000,
  export_token_cleanup:       30 * 60 * 1000,
  handoff_redemption_cleanup: 2 * 60 * 60 * 1000,
  ocr_learning:               48 * 60 * 60 * 1000,
};

const DEFAULT_STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000;

export const KNOWN_JOB_NAMES: readonly string[] = [
  "ai_metrics_rollup",
  "ai_reliability_alerts",
  "audit_trash_purge",
  "export_token_cleanup",
  "handoff_redemption_cleanup",
  "ocr_learning",
];

export function getStaleThresholdMs(jobName: string): number {
  return STALE_THRESHOLDS_MS[jobName] ?? DEFAULT_STALE_THRESHOLD_MS;
}

export async function recordJobHeartbeat(jobName: string): Promise<void> {
  try {
    const now = new Date();
    await db
      .insert(jobHeartbeatsTable)
      .values({ jobName, lastSuccessAt: now })
      .onConflictDoUpdate({
        target: jobHeartbeatsTable.jobName,
        set: { lastSuccessAt: now },
      });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), jobName },
      "Failed to record job heartbeat",
    );
  }
}
