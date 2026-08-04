import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  matchConnectionsTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  orderConnectionPair,
  userBlocksTable,
  type MatchConnection,
  type MatchProposal,
} from "@workspace/db";

const ACTIVE_POOL_STATUSES = ["building", "ready"] as const;
const OPEN_PROPOSAL_STATUSES = ["proposed", "user_yes"] as const;

export function matchPairLockKey(userA: string, userB: string): string {
  const pair = orderConnectionPair(userA, userB);
  return `match-pair:${pair.userLowId}:${pair.userHighId}`;
}

export function matchMemberLockKey(userId: string): string {
  return `match-member:${userId}`;
}

export interface InternalProposalResponseResult {
  handled: boolean;
  proposal: MatchProposal | null;
  connection: MatchConnection | null;
  connectionCreated: boolean;
  unavailable: boolean;
}

// Apply one member's answer to a mirrored internal proposal while holding a
// transaction-scoped lock for the pair. The same lock is used by blocking and
// pool opt-out, so those transitions have one durable order instead of racing
// into contradictory proposal/connection states.
export async function applyInternalProposalResponse(input: {
  proposalId: string;
  userId: string;
  counterpartUserId: string;
  interested: boolean;
}): Promise<InternalProposalResponseResult> {
  const { proposalId, userId, counterpartUserId, interested } = input;
  const pair = orderConnectionPair(userId, counterpartUserId);

  return db.transaction(async (tx) => {
    const memberLockKeys = [
      matchMemberLockKey(userId),
      matchMemberLockKey(counterpartUserId),
    ].sort();
    for (const lockKey of memberLockKeys) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${matchPairLockKey(
        userId,
        counterpartUserId,
      )}))`,
    );

    const [proposal] = await tx
      .select()
      .from(matchProposalsTable)
      .where(
        and(
          eq(matchProposalsTable.id, proposalId),
          eq(matchProposalsTable.userId, userId),
        ),
      )
      .limit(1);
    if (
      !proposal ||
      proposal.source !== "internal" ||
      proposal.proposedToUserId !== counterpartUserId
    ) {
      return {
        handled: false,
        proposal: proposal ?? null,
        connection: null,
        connectionCreated: false,
        unavailable: false,
      };
    }
    if (proposal.status !== "proposed") {
      return {
        handled: true,
        proposal,
        connection: null,
        connectionCreated: false,
        unavailable: false,
      };
    }

    const pairPredicate = or(
      and(
        eq(matchProposalsTable.userId, userId),
        eq(matchProposalsTable.proposedToUserId, counterpartUserId),
      ),
      and(
        eq(matchProposalsTable.userId, counterpartUserId),
        eq(matchProposalsTable.proposedToUserId, userId),
      ),
    );

    const [block] = await tx
      .select({ id: userBlocksTable.id })
      .from(userBlocksTable)
      .where(
        or(
          and(
            eq(userBlocksTable.blockerUserId, userId),
            eq(userBlocksTable.blockedUserId, counterpartUserId),
          ),
          and(
            eq(userBlocksTable.blockerUserId, counterpartUserId),
            eq(userBlocksTable.blockedUserId, userId),
          ),
        ),
      )
      .limit(1);
    if (block) {
      await tx.delete(matchProposalsTable).where(pairPredicate);
      await tx
        .update(matchConnectionsTable)
        .set({ status: "closed", closedReason: "block" })
        .where(
          and(
            eq(matchConnectionsTable.userLowId, pair.userLowId),
            eq(matchConnectionsTable.userHighId, pair.userHighId),
          ),
        );
      return {
        handled: true,
        proposal: null,
        connection: null,
        connectionCreated: false,
        unavailable: true,
      };
    }

    if (!interested) {
      const [declined] = await tx
        .update(matchProposalsTable)
        .set({ status: "user_no", updatedAt: new Date() })
        .where(
          and(
            eq(matchProposalsTable.id, proposalId),
            eq(matchProposalsTable.status, "proposed"),
          ),
        )
        .returning();
      await tx
        .update(matchProposalsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(matchProposalsTable.userId, counterpartUserId),
            eq(matchProposalsTable.proposedToUserId, userId),
            inArray(matchProposalsTable.status, [...OPEN_PROPOSAL_STATUSES]),
          ),
        );
      return {
        handled: true,
        proposal: declined ?? proposal,
        connection: null,
        connectionCreated: false,
        unavailable: false,
      };
    }

    const memberships = await tx
      .select({
        userId: matchPoolMembershipTable.userId,
        status: matchPoolMembershipTable.status,
      })
      .from(matchPoolMembershipTable)
      .where(
        inArray(matchPoolMembershipTable.userId, [userId, counterpartUserId]),
      );
    const activeMembers = new Set(
      memberships
        .filter((membership) =>
          ACTIVE_POOL_STATUSES.includes(
            membership.status as (typeof ACTIVE_POOL_STATUSES)[number],
          ),
        )
        .map((membership) => membership.userId),
    );
    if (!activeMembers.has(userId) || !activeMembers.has(counterpartUserId)) {
      const expiredAt = new Date();
      await tx
        .update(matchProposalsTable)
        .set({ status: "expired", updatedAt: expiredAt })
        .where(
          and(
            pairPredicate,
            inArray(matchProposalsTable.status, [...OPEN_PROPOSAL_STATUSES]),
          ),
        );
      return {
        handled: true,
        proposal: { ...proposal, status: "expired", updatedAt: expiredAt },
        connection: null,
        connectionCreated: false,
        unavailable: true,
      };
    }

    const [accepted] = await tx
      .update(matchProposalsTable)
      .set({ status: "user_yes", updatedAt: new Date() })
      .where(
        and(
          eq(matchProposalsTable.id, proposalId),
          eq(matchProposalsTable.status, "proposed"),
        ),
      )
      .returning();
    if (!accepted) {
      const [current] = await tx
        .select()
        .from(matchProposalsTable)
        .where(eq(matchProposalsTable.id, proposalId))
        .limit(1);
      return {
        handled: true,
        proposal: current ?? null,
        connection: null,
        connectionCreated: false,
        unavailable: current == null,
      };
    }

    const [reciprocal] = await tx
      .select()
      .from(matchProposalsTable)
      .where(
        and(
          eq(matchProposalsTable.source, "internal"),
          eq(matchProposalsTable.userId, counterpartUserId),
          eq(matchProposalsTable.proposedToUserId, userId),
        ),
      )
      .limit(1);
    if (!reciprocal || reciprocal.status !== "user_yes") {
      if (
        reciprocal &&
        ["user_no", "expired", "completed"].includes(reciprocal.status)
      ) {
        const expiredAt = new Date();
        const [expired] = await tx
          .update(matchProposalsTable)
          .set({ status: "expired", updatedAt: expiredAt })
          .where(eq(matchProposalsTable.id, accepted.id))
          .returning();
        return {
          handled: true,
          proposal: expired ?? {
            ...accepted,
            status: "expired",
            updatedAt: expiredAt,
          },
          connection: null,
          connectionCreated: false,
          unavailable: true,
        };
      }
      return {
        handled: true,
        proposal: accepted,
        connection: null,
        connectionCreated: false,
        unavailable: false,
      };
    }

    const [existingConnection] = await tx
      .select()
      .from(matchConnectionsTable)
      .where(
        and(
          eq(matchConnectionsTable.userLowId, pair.userLowId),
          eq(matchConnectionsTable.userHighId, pair.userHighId),
        ),
      )
      .limit(1);
    if (existingConnection?.status === "closed") {
      const completedAt = new Date();
      const completed = await tx
        .update(matchProposalsTable)
        .set({ status: "completed", updatedAt: completedAt })
        .where(inArray(matchProposalsTable.id, [accepted.id, reciprocal.id]))
        .returning();
      return {
        handled: true,
        proposal: completed.find((row) => row.id === accepted.id) ?? {
          ...accepted,
          status: "completed",
          updatedAt: completedAt,
        },
        connection: existingConnection,
        connectionCreated: false,
        unavailable: true,
      };
    }

    let connection = existingConnection ?? null;
    let connectionCreated = false;
    if (!connection) {
      const [inserted] = await tx
        .insert(matchConnectionsTable)
        .values({
          userLowId: pair.userLowId,
          userHighId: pair.userHighId,
        })
        .onConflictDoNothing({
          target: [
            matchConnectionsTable.userLowId,
            matchConnectionsTable.userHighId,
          ],
        })
        .returning();
      connection = inserted ?? null;
      connectionCreated = Boolean(inserted);
      if (!connection) {
        const [concurrent] = await tx
          .select()
          .from(matchConnectionsTable)
          .where(
            and(
              eq(matchConnectionsTable.userLowId, pair.userLowId),
              eq(matchConnectionsTable.userHighId, pair.userHighId),
            ),
          )
          .limit(1);
        connection = concurrent ?? null;
      }
    }

    const matchedAt = new Date();
    const matched = await tx
      .update(matchProposalsTable)
      .set({ status: "mutual_yes", updatedAt: matchedAt })
      .where(inArray(matchProposalsTable.id, [accepted.id, reciprocal.id]))
      .returning();
    return {
      handled: true,
      proposal: matched.find((row) => row.id === accepted.id) ?? {
        ...accepted,
        status: "mutual_yes",
        updatedAt: matchedAt,
      },
      connection,
      connectionCreated,
      unavailable: connection == null,
    };
  });
}
