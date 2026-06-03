import { and, eq, inArray } from "drizzle-orm";
import { db, matchPoolMembershipTable, jobHeartbeatsTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat, getStaleThresholdMs } from "./jobHeartbeat";
import { mintInternalProposalsForMember } from "../routes/matching";

const AUTO_PROPOSAL_JOB = "auto_proposal";

const DEFAULT_INTERVAL_HOURS = 6;
// Bound a single sweep so a large pool never turns into an unbounded scan.
const MAX_MEMBERS_PER_SWEEP = 200;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// The job is OFF by default. It only runs when AUTO_PROPOSAL_ENABLED is set to a
// truthy value ("1", "true", "yes"). This keeps automated pairing dark until we
// explicitly choose to turn it on, exactly like the rest of the matching roadmap.
export function isAutoProposalEnabled(): boolean {
  const raw = (process.env.AUTO_PROPOSAL_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// One sweep: for every live pool member, mint any fresh internal proposals. The
// minting itself is idempotent (mirror rows + partial unique index), so running
// the sweep repeatedly never creates duplicates. Returns the total new matches
// minted across the pool in this sweep. `userIds` narrows the sweep to a
// specific set of members (used by tests for determinism); production runs it
// with no filter so it scans the whole live pool.
export async function runAutoProposalSweep(options?: {
  jobName?: string;
  userIds?: string[];
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? AUTO_PROPOSAL_JOB;
  try {
    const statusFilter = inArray(matchPoolMembershipTable.status, [
      "building",
      "ready",
    ]);
    const memberRows = await db
      .select({ userId: matchPoolMembershipTable.userId })
      .from(matchPoolMembershipTable)
      .where(
        options?.userIds && options.userIds.length > 0
          ? and(
              statusFilter,
              inArray(matchPoolMembershipTable.userId, options.userIds),
            )
          : statusFilter,
      )
      .limit(MAX_MEMBERS_PER_SWEEP);
    const members = memberRows
      .map((r) => r.userId)
      .filter((id): id is string => Boolean(id));

    let minted = 0;
    for (const userId of members) {
      try {
        minted += await mintInternalProposalsForMember(userId);
      } catch (err) {
        logger.warn(
          {
            err: err instanceof Error ? err.message : String(err),
          },
          "Auto-proposal sweep failed for one member; continuing",
        );
      }
    }

    if (minted > 0) {
      logger.info(
        { minted, members: members.length },
        "Auto-proposal sweep minted internal matches",
      );
    } else {
      logger.debug(
        { members: members.length },
        "Auto-proposal sweep found no new matches",
      );
    }
    await recordJobHeartbeat(heartbeatJobName);
    return minted;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Auto-proposal sweep failed",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startAutoProposalJob(): void {
  if (scheduledTimer) return;
  if (!isAutoProposalEnabled()) {
    logger.info(
      "Auto-proposal job is disabled (set AUTO_PROPOSAL_ENABLED to turn it on)",
    );
    return;
  }
  const intervalHours = readPositiveNumberEnv(
    "AUTO_PROPOSAL_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void runAutoProposalSweep();

  scheduledTimer = setInterval(() => {
    void runAutoProposalSweep();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info({ intervalHours }, "Started auto-proposal job");
}

export function stopAutoProposalJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}

export function getAutoProposalStaleThresholdMs(): number {
  return getStaleThresholdMs(AUTO_PROPOSAL_JOB);
}

export async function getAutoProposalHeartbeat(): Promise<Date | null> {
  const rows = await db
    .select({ lastSuccessAt: jobHeartbeatsTable.lastSuccessAt })
    .from(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, AUTO_PROPOSAL_JOB))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.lastSuccessAt instanceof Date
    ? row.lastSuccessAt
    : new Date(row.lastSuccessAt as unknown as string);
}
