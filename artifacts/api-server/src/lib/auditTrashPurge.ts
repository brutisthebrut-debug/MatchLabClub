import { and, isNotNull, lt } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";

const AUDIT_TRASH_PURGE_JOB = "audit_trash_purge";

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
  return readPositiveNumberEnv(
    "AUDIT_TRASH_RETENTION_DAYS",
    DEFAULT_RETENTION_DAYS,
  );
}

export async function purgeExpiredTrashedAudits(
  retentionDays: number = getRetentionDays(),
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    const result = await db
      .delete(auditsTable)
      .where(
        and(
          isNotNull(auditsTable.deletedAt),
          lt(auditsTable.deletedAt, cutoff),
        ),
      )
      .returning({ id: auditsTable.id });
    const deleted = result.length;
    if (deleted > 0) {
      logger.info(
        { deleted, retentionDays, cutoff: cutoff.toISOString() },
        "Purged soft-deleted audits past retention window",
      );
    } else {
      logger.debug(
        { retentionDays, cutoff: cutoff.toISOString() },
        "No soft-deleted audits past retention window",
      );
    }
    await recordJobHeartbeat(AUDIT_TRASH_PURGE_JOB);
    return deleted;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to purge soft-deleted audits",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAuditTrashPurgeJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "AUDIT_TRASH_PURGE_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void purgeExpiredTrashedAudits();

  scheduledTimer = setInterval(() => {
    void purgeExpiredTrashedAudits();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { retentionDays: getRetentionDays(), intervalHours },
    "Started audit trash purge job",
  );
}

export function stopAuditTrashPurgeJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
