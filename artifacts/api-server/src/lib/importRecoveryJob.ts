/**
 * Import enrichment recovery sweep.
 *
 * AI enrichment for Hinge and Instagram imports is kicked off fire-and-forget
 * after the upload is acknowledged. That is fine on the happy path, but two
 * cases used to strand a row forever:
 *
 *  1. The process restarts (deploy, crash) between the insert (`status:pending`)
 *     and the enrichment finishing. The in-flight closure is gone, so the row
 *     sits `pending` with nothing left to complete it.
 *  2. A transient model/API failure pushed a Hinge row to `status:fallback`.
 *     The deterministic baseline still serves, but the richer read never lands
 *     even once the provider recovers.
 *
 * This job periodically picks up both cases and re-runs enrichment through the
 * shared `reenrichImportRow` dispatcher, which itself retries with backoff.
 * It is bounded: only signed-in rows, only after a settle delay (so we never
 * race an in-flight first attempt), capped batch size, and a per-row retry
 * ceiling for `fallback` rows so a permanently failing provider cannot loop.
 *
 * Terminal `fallback` reasons (the user has not granted consent, or the model
 * output could not be coerced to the schema) are skipped: re-running them just
 * burns calls without changing the outcome.
 */
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db, importedSourcesTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";
import { reenrichImportRow, MAX_ENRICH_RETRIES } from "./importEnrichment";

const IMPORT_RECOVERY_JOB = "import_recovery";
const ENRICHABLE_SOURCES = ["hinge", "instagram-paste"];

/** Reasons a `fallback` row will never improve on re-run. */
const TERMINAL_FALLBACK_REASONS = new Set([
  "consent_not_granted",
  "schema_validation_failed",
  "json_parse_failed",
]);

const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_STUCK_PENDING_MINUTES = 5;
const DEFAULT_FALLBACK_COOLDOWN_MINUTES = 60;
const DEFAULT_BATCH_LIMIT = 25;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Decide whether a candidate row is worth re-enriching right now. Pure so it
 * can be unit-tested without a DB. `now` is injectable for deterministic tests.
 */
export function shouldRecoverRow(
  row: {
    status: string;
    source: string;
    uploadedAt: Date;
    processedAt: Date | null;
    parsedSummary: Record<string, unknown> | null;
    userId: string | null;
  },
  opts: {
    now: number;
    stuckPendingMs: number;
    fallbackCooldownMs: number;
  },
): boolean {
  if (!row.userId) return false;
  if (!ENRICHABLE_SOURCES.includes(row.source)) return false;

  if (row.status === "pending") {
    return row.uploadedAt.getTime() <= opts.now - opts.stuckPendingMs;
  }

  if (row.status === "fallback") {
    // Only Hinge can land in fallback; Instagram always completes with a
    // deterministic read. Guard by source anyway for clarity.
    if (row.source !== "hinge") return false;
    const summary = row.parsedSummary ?? {};
    const reason =
      typeof summary.aiError === "string" ? summary.aiError : "unknown";
    if (TERMINAL_FALLBACK_REASONS.has(reason)) return false;
    const retryCount =
      typeof summary.aiRetryCount === "number" ? summary.aiRetryCount : 0;
    if (retryCount >= MAX_ENRICH_RETRIES) return false;
    const processedMs = row.processedAt
      ? row.processedAt.getTime()
      : row.uploadedAt.getTime();
    return processedMs <= opts.now - opts.fallbackCooldownMs;
  }

  return false;
}

export async function recoverStuckImports(options?: {
  jobName?: string;
  now?: number;
}): Promise<{ scanned: number; recovered: number }> {
  const heartbeatJobName = options?.jobName ?? IMPORT_RECOVERY_JOB;
  const now = options?.now ?? Date.now();
  const stuckPendingMs =
    readPositiveNumberEnv(
      "IMPORT_RECOVERY_STUCK_PENDING_MINUTES",
      DEFAULT_STUCK_PENDING_MINUTES,
    ) *
    60 *
    1000;
  const fallbackCooldownMs =
    readPositiveNumberEnv(
      "IMPORT_RECOVERY_FALLBACK_COOLDOWN_MINUTES",
      DEFAULT_FALLBACK_COOLDOWN_MINUTES,
    ) *
    60 *
    1000;
  const batchLimit = Math.floor(
    readPositiveNumberEnv("IMPORT_RECOVERY_BATCH_LIMIT", DEFAULT_BATCH_LIMIT),
  );

  let recovered = 0;
  let scanned = 0;

  try {
    const pendingCutoff = new Date(now - stuckPendingMs);
    const fallbackCutoff = new Date(now - fallbackCooldownMs);

    const candidates = await db
      .select({
        id: importedSourcesTable.id,
        userId: importedSourcesTable.userId,
        source: importedSourcesTable.source,
        status: importedSourcesTable.status,
        uploadedAt: importedSourcesTable.uploadedAt,
        processedAt: importedSourcesTable.processedAt,
        parsedSummary: importedSourcesTable.parsedSummary,
      })
      .from(importedSourcesTable)
      .where(
        and(
          isNull(importedSourcesTable.deletedAt),
          isNotNull(importedSourcesTable.userId),
          inArray(importedSourcesTable.source, ENRICHABLE_SOURCES),
          or(
            and(
              eq(importedSourcesTable.status, "pending"),
              lt(importedSourcesTable.uploadedAt, pendingCutoff),
            ),
            and(
              eq(importedSourcesTable.status, "fallback"),
              eq(importedSourcesTable.source, "hinge"),
              // Match shouldRecoverRow's cooldown source so the batch is not
              // starved by rows that are still inside their cooldown window.
              sql`coalesce(${importedSourcesTable.processedAt}, ${importedSourcesTable.uploadedAt}) < ${fallbackCutoff}`,
            ),
          ),
        ),
      )
      .orderBy(
        asc(
          sql`coalesce(${importedSourcesTable.processedAt}, ${importedSourcesTable.uploadedAt})`,
        ),
      )
      .limit(batchLimit);

    scanned = candidates.length;

    for (const row of candidates) {
      const uploadedAt =
        row.uploadedAt instanceof Date
          ? row.uploadedAt
          : new Date(String(row.uploadedAt));
      const processedAt = row.processedAt
        ? row.processedAt instanceof Date
          ? row.processedAt
          : new Date(String(row.processedAt))
        : null;

      if (
        !shouldRecoverRow(
          {
            status: row.status,
            source: row.source,
            uploadedAt,
            processedAt,
            parsedSummary: row.parsedSummary,
            userId: row.userId,
          },
          { now, stuckPendingMs, fallbackCooldownMs },
        )
      ) {
        continue;
      }

      try {
        const action = await reenrichImportRow({
          id: row.id,
          userId: row.userId,
          source: row.source,
          status: row.status,
          parsedSummary: row.parsedSummary,
        });
        if (action === "reenriched") recovered += 1;
      } catch (err) {
        logger.warn(
          {
            err: err instanceof Error ? err.message : String(err),
            importId: row.id,
            source: row.source,
          },
          "Import recovery re-enrichment failed for row",
        );
      }
    }

    await recordJobHeartbeat(heartbeatJobName);

    if (recovered > 0) {
      logger.info({ scanned, recovered }, "Import recovery sweep re-enriched rows");
    } else {
      logger.debug({ scanned }, "Import recovery sweep found nothing to recover");
    }

    return { scanned, recovered };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Import recovery sweep failed",
    );
    return { scanned, recovered };
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startImportRecoveryJob(): void {
  if (scheduledTimer) return;

  const intervalMinutes = readPositiveNumberEnv(
    "IMPORT_RECOVERY_INTERVAL_MINUTES",
    DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  void recoverStuckImports();

  scheduledTimer = setInterval(() => {
    void recoverStuckImports();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info({ intervalMinutes }, "Started import recovery job");
}

export function stopImportRecoveryJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
