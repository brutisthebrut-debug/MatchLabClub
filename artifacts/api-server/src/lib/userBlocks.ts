import { and, eq, or } from "drizzle-orm";
import { db, userBlocksTable, matchProposalsTable } from "@workspace/db";

// Create a one-directional block and clear any internal proposals between the
// pair in both directions. Blocking is a hard, symmetric gate in the matching
// engine (loadBlockedUserIds in matching.ts checks both directions), so a single
// directional row removes the pair from each other's candidate pool and stops
// any in-flight proposal from resurfacing. Idempotent via the unique
// (blocker, blocked) index. Shared by the explicit safety block route and the
// report-and-block path on a connection.
export async function blockUserPair(
  blockerUserId: string,
  blockedUserId: string,
  reason: string | null = null,
): Promise<void> {
  // One transaction so the block row and the proposal purge commit together. A
  // partial failure would otherwise either record a block while stale proposals
  // linger, or drop the proposals without recording the block, leaving the pair
  // able to resurface.
  await db.transaction(async (tx) => {
    await tx
      .insert(userBlocksTable)
      .values({ blockerUserId, blockedUserId, reason })
      .onConflictDoNothing({
        target: [userBlocksTable.blockerUserId, userBlocksTable.blockedUserId],
      });
    await tx
      .delete(matchProposalsTable)
      .where(
        or(
          and(
            eq(matchProposalsTable.userId, blockerUserId),
            eq(matchProposalsTable.proposedToUserId, blockedUserId),
          ),
          and(
            eq(matchProposalsTable.userId, blockedUserId),
            eq(matchProposalsTable.proposedToUserId, blockerUserId),
          ),
        ),
      );
  });
}

// True when a block exists between the pair in either direction.
export async function pairIsBlocked(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ blockerUserId: userBlocksTable.blockerUserId })
    .from(userBlocksTable)
    .where(
      or(
        and(
          eq(userBlocksTable.blockerUserId, a),
          eq(userBlocksTable.blockedUserId, b),
        ),
        and(
          eq(userBlocksTable.blockerUserId, b),
          eq(userBlocksTable.blockedUserId, a),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
