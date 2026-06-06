import { and, eq, inArray, lt } from "drizzle-orm";
import { db, matchProposalsTable, jobHeartbeatsTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat, getStaleThresholdMs } from "./jobHeartbeat";

const PROPOSAL_EXPIRY_JOB = "proposal_expiry";

const DEFAULT_INTERVAL_HOURS = 12;
const DEFAULT_MAX_AGE_DAYS = 14;

// Proposals waiting on a member that never get a final answer go stale. These
// are the still-open states: the pair has not reached mutual_yes, and the
// proposal has not already been declined/expired/completed. Once a proposal is
// older than the max age and still sitting in one of these, the sweep moves it
// to "expired" so discover stops resurfacing it and the dashboards stay honest.
const OPEN_STATES = ["proposed", "user_yes", "user_no"] as const;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// The job is OFF by default, matching the rest of the matching roadmap. It only
// sweeps when PROPOSAL_EXPIRY_ENABLED is truthy; otherwise it logs and no-ops so
// the behavior is observable without silently mutating data.
export function isProposalExpiryEnabled(): boolean {
  const raw = (process.env.PROPOSAL_EXPIRY_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// One sweep: expire every open proposal whose last update predates the cutoff.
// Keyed on updatedAt so a proposal a member recently said yes/no to (waiting on
// the other side) gets the full window from that action, not from creation.
// Returns the number of proposals expired.
export async function runProposalExpirySweep(options?: {
  jobName?: string;
  maxAgeDays?: number;
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? PROPOSAL_EXPIRY_JOB;
  const maxAgeDays =
    options?.maxAgeDays ??
    readPositiveNumberEnv("PROPOSAL_EXPIRY_MAX_AGE_DAYS", DEFAULT_MAX_AGE_DAYS);
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  try {
    const expired = await db
      .update(matchProposalsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          inArray(matchProposalsTable.status, [...OPEN_STATES]),
          lt(matchProposalsTable.updatedAt, cutoff),
        ),
      )
      .returning({ id: matchProposalsTable.id });

    if (expired.length > 0) {
      logger.info(
        { expired: expired.length, maxAgeDays },
        "Proposal expiry sweep expired stale proposals",
      );
    } else {
      logger.debug({ maxAgeDays }, "Proposal expiry sweep found nothing stale");
    }
    await recordJobHeartbeat(heartbeatJobName);
    return expired.length;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Proposal expiry sweep failed",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export async function proposalExpiryTick(): Promise<void> {
  if (!isProposalExpiryEnabled()) return;
  await runProposalExpirySweep();
}

export function startProposalExpiryJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "PROPOSAL_EXPIRY_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  if (!isProposalExpiryEnabled()) {
    logger.info(
      "Proposal expiry job disabled (set PROPOSAL_EXPIRY_ENABLED=true to enable)",
    );
    return;
  }

  void proposalExpiryTick();

  scheduledTimer = setInterval(() => {
    void proposalExpiryTick();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info({ intervalHours, maxAgeDays: DEFAULT_MAX_AGE_DAYS }, "Started proposal expiry job");
}

export function stopProposalExpiryJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}

export function getProposalExpiryStaleThresholdMs(): number {
  return getStaleThresholdMs(PROPOSAL_EXPIRY_JOB);
}

export async function getProposalExpiryHeartbeat(): Promise<Date | null> {
  const rows = await db
    .select({ lastSuccessAt: jobHeartbeatsTable.lastSuccessAt })
    .from(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, PROPOSAL_EXPIRY_JOB))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.lastSuccessAt instanceof Date
    ? row.lastSuccessAt
    : new Date(row.lastSuccessAt as unknown as string);
}
