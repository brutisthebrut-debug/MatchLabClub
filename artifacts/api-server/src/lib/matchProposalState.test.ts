import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", async () => await import("./testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
  const fake = await import("./testDb");
  return {
    ...actual,
    and: fake.and,
    eq: fake.eq,
    inArray: fake.inArray,
    or: fake.or,
    sql: fake.sql,
  };
});

import {
  db,
  dumpTable,
  matchConnectionsTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  resetTestDb,
  userBlocksTable,
} from "./testDb";
import { applyInternalProposalResponse } from "./matchProposalState";

const USER_A = "pair-state-a";
const USER_B = "pair-state-b";

async function seedReadyPair(): Promise<{
  proposalA: string;
  proposalB: string;
}> {
  await db.insert(matchPoolMembershipTable).values([
    { userId: USER_A, status: "ready" },
    { userId: USER_B, status: "ready" },
  ]);
  const proposals = await db
    .insert(matchProposalsTable)
    .values([
      {
        id: "pair-state-proposal-a",
        userId: USER_A,
        proposedToUserId: USER_B,
        source: "internal",
        compatibilityScore: 84,
        status: "proposed",
      },
      {
        id: "pair-state-proposal-b",
        userId: USER_B,
        proposedToUserId: USER_A,
        source: "internal",
        compatibilityScore: 84,
        status: "proposed",
      },
    ])
    .returning();
  return {
    proposalA: String(proposals[0]!.id),
    proposalB: String(proposals[1]!.id),
  };
}

beforeEach(() => {
  resetTestDb();
});

describe("applyInternalProposalResponse", () => {
  it("keeps a decline terminal and expires the mirror", async () => {
    const pair = await seedReadyPair();
    const result = await applyInternalProposalResponse({
      proposalId: pair.proposalA,
      userId: USER_A,
      counterpartUserId: USER_B,
      interested: false,
    });

    expect(result.proposal?.status).toBe("user_no");
    const rows = dumpTable("match_proposals");
    expect(rows.find((row) => row.userId === USER_A)?.status).toBe("user_no");
    expect(rows.find((row) => row.userId === USER_B)?.status).toBe("expired");
  });

  it("creates one active connection only after both members say yes", async () => {
    const pair = await seedReadyPair();
    const first = await applyInternalProposalResponse({
      proposalId: pair.proposalA,
      userId: USER_A,
      counterpartUserId: USER_B,
      interested: true,
    });
    expect(first.proposal?.status).toBe("user_yes");
    expect(first.connection).toBeNull();

    const second = await applyInternalProposalResponse({
      proposalId: pair.proposalB,
      userId: USER_B,
      counterpartUserId: USER_A,
      interested: true,
    });
    expect(second.proposal?.status).toBe("mutual_yes");
    expect(second.connectionCreated).toBe(true);
    expect(second.connection?.status).toBe("active");
    expect(dumpTable("match_connections")).toHaveLength(1);
    expect(
      dumpTable("match_proposals").every(
        (proposal) => proposal.status === "mutual_yes",
      ),
    ).toBe(true);
  });

  it("does not reopen a connection that was deliberately closed", async () => {
    const pair = await seedReadyPair();
    await db.insert(matchConnectionsTable).values({
      userLowId: USER_A,
      userHighId: USER_B,
      status: "closed",
      closedReason: "unmatch",
      closedByUserId: USER_A,
    });
    await applyInternalProposalResponse({
      proposalId: pair.proposalA,
      userId: USER_A,
      counterpartUserId: USER_B,
      interested: true,
    });
    const result = await applyInternalProposalResponse({
      proposalId: pair.proposalB,
      userId: USER_B,
      counterpartUserId: USER_A,
      interested: true,
    });

    expect(result.proposal?.status).toBe("completed");
    expect(result.connection?.status).toBe("closed");
    expect(dumpTable("match_connections")[0]?.closedReason).toBe("unmatch");
  });

  it("self-heals a blocked pair instead of creating a connection", async () => {
    const pair = await seedReadyPair();
    await db.insert(userBlocksTable).values({
      blockerUserId: USER_A,
      blockedUserId: USER_B,
    });
    const result = await applyInternalProposalResponse({
      proposalId: pair.proposalA,
      userId: USER_A,
      counterpartUserId: USER_B,
      interested: true,
    });

    expect(result.unavailable).toBe(true);
    expect(result.proposal).toBeNull();
    expect(dumpTable("match_proposals")).toHaveLength(0);
    expect(dumpTable("match_connections")).toHaveLength(0);
  });
});
