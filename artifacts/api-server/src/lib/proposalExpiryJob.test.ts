import { describe, it, expect, afterAll, beforeEach } from "vitest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, matchProposalsTable } from "@workspace/db";
import {
  runProposalExpirySweep,
  proposalExpiryTick,
} from "./proposalExpiryJob";
import { saveBrainControls, resetBrainControls } from "./brainConfig";

const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `expiry-a-${suffix}`;
const USER_B = `expiry-b-${suffix}`;
const ALL_USERS = [USER_A, USER_B];

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedProposal(
  userId: string,
  proposedToUserId: string,
  ageDays: number,
  status = "proposed",
): Promise<string> {
  const ts = new Date(Date.now() - ageDays * DAY_MS);
  const [row] = await db
    .insert(matchProposalsTable)
    .values({
      userId,
      proposedToUserId,
      source: "internal",
      compatibilityScore: 80,
      summary: "Test proposal fixture for the expiry sweep.",
      status,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning({ id: matchProposalsTable.id });
  return row!.id;
}

async function statusOf(id: string): Promise<string | undefined> {
  const rows = await db
    .select({ status: matchProposalsTable.status })
    .from(matchProposalsTable)
    .where(eq(matchProposalsTable.id, id));
  return rows[0]?.status;
}

async function cleanup(): Promise<void> {
  for (const u of ALL_USERS) {
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, u));
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.proposedToUserId, u));
  }
  await resetBrainControls();
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("runProposalExpirySweep", () => {
  it("expires stale open proposals and leaves fresh or settled ones", async () => {
    const staleProposed = await seedProposal(USER_A, USER_B, 30, "proposed");
    const staleUserNo = await seedProposal(USER_B, USER_A, 30, "user_no");
    const fresh = await seedProposal(USER_A, `${USER_B}-x`, 1, "proposed");
    // Stale but already settled (mutual_yes): the sweep must never touch it.
    const settled = await seedProposal(USER_A, `${USER_B}-y`, 30, "mutual_yes");

    const expiredCount = await runProposalExpirySweep({
      jobName: `test-${suffix}`,
    });
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    expect(await statusOf(staleProposed)).toBe("expired");
    expect(await statusOf(staleUserNo)).toBe("user_no");
    expect(await statusOf(fresh)).toBe("proposed");
    expect(await statusOf(settled)).toBe("mutual_yes");
  });
});

describe("proposalExpiryTick", () => {
  it("only sweeps when the founder control is enabled", async () => {
    const stale = await seedProposal(USER_A, USER_B, 30, "proposed");

    // Control off: the tick is a no-op even with a stale proposal present.
    await saveBrainControls({ proposalExpiryEnabled: false });
    await proposalExpiryTick();
    expect(await statusOf(stale)).toBe("proposed");

    // Control on: the same tick runs the sweep and expires the stale proposal.
    await saveBrainControls({ proposalExpiryEnabled: true });
    await proposalExpiryTick();
    expect(await statusOf(stale)).toBe("expired");
  });
});
