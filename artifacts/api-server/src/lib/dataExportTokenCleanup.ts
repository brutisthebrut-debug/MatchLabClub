import { lt, or, and, isNotNull } from "drizzle-orm";
import { db, dataExportTokensTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";

const EXPORT_TOKEN_CLEANUP_JOB = "export_token_cleanup";

const DEFAULT_GRACE_MINUTES = 60;
const DEFAULT_INTERVAL_MINUTES = 15;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getGraceMinutes(): number {
  return readPositiveNumberEnv(
    "EXPORT_TOKEN_CLEANUP_GRACE_MINUTES",
    DEFAULT_GRACE_MINUTES,
  );
}

export async function pruneExpiredExportTokens(
  graceMinutes: number = getGraceMinutes(),
): Promise<number> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  try {
    const result = await db
      .delete(dataExportTokensTable)
      .where(
        or(
          lt(dataExportTokensTable.expiresAt, cutoff),
          and(
            isNotNull(dataExportTokensTable.usedAt),
            lt(dataExportTokensTable.usedAt, cutoff),
          ),
        ),
      )
      .returning({ token: dataExportTokensTable.token });
    const deleted = result.length;
    if (deleted > 0) {
      logger.info(
        { deleted, graceMinutes, cutoff: cutoff.toISOString() },
        "Pruned expired data_export_tokens rows",
      );
    } else {
      logger.debug(
        { graceMinutes, cutoff: cutoff.toISOString() },
        "No expired data_export_tokens rows to prune",
      );
    }
    await recordJobHeartbeat(EXPORT_TOKEN_CLEANUP_JOB);
    return deleted;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to prune expired data_export_tokens rows",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startDataExportTokenCleanupJob(): void {
  if (scheduledTimer) return;
  const intervalMinutes = readPositiveNumberEnv(
    "EXPORT_TOKEN_CLEANUP_INTERVAL_MINUTES",
    DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  void pruneExpiredExportTokens();

  scheduledTimer = setInterval(() => {
    void pruneExpiredExportTokens();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { graceMinutes: getGraceMinutes(), intervalMinutes },
    "Started data_export_tokens cleanup job",
  );
}

export function stopDataExportTokenCleanupJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
