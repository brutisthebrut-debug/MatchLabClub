import { lt } from "drizzle-orm";
import { db, handoffTokenRedemptionsTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";

const HANDOFF_REDEMPTION_CLEANUP_JOB = "handoff_redemption_cleanup";

/**
 * Once a handoff `jti` is past its embedded `exp`, the signed token can no
 * longer verify, so keeping the row around adds no security value — it would
 * just grow unbounded. A small grace window guards against clock skew across
 * processes.
 */
const DEFAULT_GRACE_MINUTES = 60;
const DEFAULT_INTERVAL_MINUTES = 60;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getGraceMinutes(): number {
  return readPositiveNumberEnv(
    "HANDOFF_REDEMPTION_CLEANUP_GRACE_MINUTES",
    DEFAULT_GRACE_MINUTES,
  );
}

export async function pruneExpiredHandoffRedemptions(
  graceMinutes: number = getGraceMinutes(),
): Promise<number> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  try {
    const result = await db
      .delete(handoffTokenRedemptionsTable)
      .where(lt(handoffTokenRedemptionsTable.expiresAt, cutoff))
      .returning({ jti: handoffTokenRedemptionsTable.jti });
    const deleted = result.length;
    if (deleted > 0) {
      logger.info(
        { deleted, graceMinutes, cutoff: cutoff.toISOString() },
        "Pruned expired handoff_token_redemptions rows",
      );
    }
    await recordJobHeartbeat(HANDOFF_REDEMPTION_CLEANUP_JOB);
    return deleted;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to prune expired handoff_token_redemptions rows",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startHandoffRedemptionCleanupJob(): void {
  if (scheduledTimer) return;
  const intervalMinutes = readPositiveNumberEnv(
    "HANDOFF_REDEMPTION_CLEANUP_INTERVAL_MINUTES",
    DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  void pruneExpiredHandoffRedemptions();

  scheduledTimer = setInterval(() => {
    void pruneExpiredHandoffRedemptions();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { graceMinutes: getGraceMinutes(), intervalMinutes },
    "Started handoff_token_redemptions cleanup job",
  );
}

export function stopHandoffRedemptionCleanupJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
