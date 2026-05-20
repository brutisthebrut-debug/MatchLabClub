/**
 * Retention policy for audit_report_versions.
 *
 * Every regenerate appends a row.  Without a cap the table grows without
 * bound.  The policy is a simple count cap: keep the N most-recent versions
 * per audit (ordered by generated_at DESC) and delete the rest.
 *
 * Default cap: 25 versions per audit.
 * Override via env: AUDIT_VERSION_MAX_COUNT (positive integer).
 *
 * A background job runs at startup and then on a configurable interval to
 * catch any audits that somehow accumulated excess rows (e.g. race
 * conditions or legacy data).  The inline prune that fires immediately after
 * each insert is the primary guard; the job is the safety net.
 */

import { eq, sql, and, notInArray } from "drizzle-orm";
import { db, auditReportVersionsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_VERSION_MAX_COUNT = 25;
const DEFAULT_INTERVAL_HOURS = 24;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getVersionMaxCount(): number {
  return readPositiveIntEnv("AUDIT_VERSION_MAX_COUNT", DEFAULT_VERSION_MAX_COUNT);
}

/**
 * Delete all versions for `auditId` that fall outside the newest `maxCount`
 * rows (ordered by generated_at DESC).  Returns the number of rows deleted.
 *
 * Uses a single DELETE … WHERE id NOT IN (SELECT … LIMIT n) so it is safe
 * to call inside a transaction or right after an insert.
 */
export async function pruneVersionsForAudit(
  auditId: number,
  maxCount: number = getVersionMaxCount(),
): Promise<number> {
  const keepIds = await db
    .select({ id: auditReportVersionsTable.id })
    .from(auditReportVersionsTable)
    .where(eq(auditReportVersionsTable.auditId, auditId))
    .orderBy(sql`${auditReportVersionsTable.generatedAt} DESC`)
    .limit(maxCount);

  if (keepIds.length < maxCount) {
    return 0;
  }

  const keepIdList = keepIds.map((r) => r.id);
  const deleted = await db
    .delete(auditReportVersionsTable)
    .where(
      and(
        eq(auditReportVersionsTable.auditId, auditId),
        notInArray(auditReportVersionsTable.id, keepIdList),
      ),
    )
    .returning({ id: auditReportVersionsTable.id });

  return deleted.length;
}

/**
 * Find every audit that has more than `maxCount` versions and prune each one.
 * Returns the total number of rows deleted.
 */
export async function pruneAllAuditVersions(
  maxCount: number = getVersionMaxCount(),
): Promise<number> {
  const overLimitRows = await db
    .select({ auditId: auditReportVersionsTable.auditId })
    .from(auditReportVersionsTable)
    .groupBy(auditReportVersionsTable.auditId)
    .having(sql`count(*) > ${maxCount}`);

  if (overLimitRows.length === 0) {
    logger.debug({ maxCount }, "audit version prune: nothing to do");
    return 0;
  }

  let totalDeleted = 0;
  for (const { auditId } of overLimitRows) {
    try {
      const n = await pruneVersionsForAudit(auditId, maxCount);
      totalDeleted += n;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), auditId },
        "audit version prune: failed to prune versions for audit",
      );
    }
  }

  if (totalDeleted > 0) {
    logger.info(
      { totalDeleted, maxCount, affectedAudits: overLimitRows.length },
      "audit version prune: deleted excess version rows",
    );
  }

  return totalDeleted;
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAuditVersionPurgeJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveIntEnv(
    "AUDIT_VERSION_PURGE_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void pruneAllAuditVersions();

  scheduledTimer = setInterval(() => {
    void pruneAllAuditVersions();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { maxCount: getVersionMaxCount(), intervalHours },
    "Started audit version purge job",
  );
}

export function stopAuditVersionPurgeJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
