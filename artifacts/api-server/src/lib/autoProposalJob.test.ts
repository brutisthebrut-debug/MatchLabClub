import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
} from "@workspace/db";
import { runAutoProposalSweep } from "./autoProposalJob";

const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `auto-a-${suffix}`;
const USER_B = `auto-b-${suffix}`;
const USER_FAR = `auto-far-${suffix}`;
const ALL_USERS = [USER_A, USER_B, USER_FAR];

async function seedMember(
  userId: string,
  opts: {
    status: string;
    age: number;
    gender: string;
    genderPreference: string;
    cityHint: string;
    distanceKm?: number;
  },
): Promise<void> {
  await db
    .insert(matchPoolMembershipTable)
    .values({ userId, status: opts.status })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: { status: opts.status },
    });
  await db
    .insert(matchPreferencesTable)
    .values({
      userId,
      ageMin: 18,
      ageMax: 99,
      genderPreference: opts.genderPreference,
      cityHint: opts.cityHint,
      distanceKm: opts.distanceKm ?? null,
    })
    .onConflictDoUpdate({
      target: matchPreferencesTable.userId,
      set: {
        ageMin: 18,
        ageMax: 99,
        genderPreference: opts.genderPreference,
        cityHint: opts.cityHint,
        distanceKm: opts.distanceKm ?? null,
      },
    });
  await db.insert(auditsTable).values({
    userId,
    firstName: "Test",
    age: opts.age,
    gender: opts.gender,
    datingGoal: "relationship",
    bio: "A real, thoughtful bio used for the auto-proposal job test fixture.",
    status: "complete",
    readinessScore: 80,
    reportGeneratedAt: new Date(),
  });
}

async function cleanup(): Promise<void> {
  await db.delete(auditsTable).where(inArray(auditsTable.userId, ALL_USERS));
  await db
    .delete(matchPreferencesTable)
    .where(inArray(matchPreferencesTable.userId, ALL_USERS));
  await db
    .delete(matchPoolMembershipTable)
    .where(inArray(matchPoolMembershipTable.userId, ALL_USERS));
  for (const u of ALL_USERS) {
    await db.delete(matchProposalsTable).where(eq(matchProposalsTable.userId, u));
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.proposedToUserId, u));
  }
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("runAutoProposalSweep", () => {
  it("mints mutual internal proposals across the pool and is idempotent", async () => {
    // Use a city away from other test fixtures (which seed Austin). With the
    // radius gate now active, cross-file members in distant cities cannot match,
    // and scoping the sweep to our own user ids keeps the count deterministic.
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Seattle",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Seattle",
    });

    const first = await runAutoProposalSweep({
      jobName: `test-${suffix}`,
      userIds: [USER_A, USER_B],
    });
    expect(first).toBeGreaterThan(0);

    // Scope every assertion to the A<->B pair. The match pool is one shared
    // Postgres table and sibling test files seed their own ready members; when
    // no radius is set those members can legitimately match our fixtures, so a
    // raw per-user count is non-deterministic under parallel runs. Idempotency
    // is a property of the pair, and the partial unique index guarantees it
    // stays single.
    const aRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const bRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_B));
    const aToB = aRows.filter((r) => r.proposedToUserId === USER_B);
    const bToA = bRows.filter((r) => r.proposedToUserId === USER_A);
    expect(aToB.length).toBe(1);
    expect(bToA.length).toBe(1);

    // A second sweep must not create duplicate pairs. Scope it to our fixture
    // users so the count is deterministic under a shared test database.
    const second = await runAutoProposalSweep({
      jobName: `test-${suffix}`,
      userIds: [USER_A, USER_B],
    });
    expect(second).toBe(0);
    const aAfter = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const aAfterToB = aAfter.filter((r) => r.proposedToUserId === USER_B);
    expect(aAfterToB.length).toBe(1);
  });

  it("respects the radius hard filter: far members are never paired", async () => {
    // Both want each other on gender/age, but each caps radius at 25 miles and
    // they sit thousands of miles apart, so the radius gate must exclude them.
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "New York",
      distanceKm: 40,
    });
    await seedMember(USER_FAR, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Los Angeles",
      distanceKm: 40,
    });

    const minted = await runAutoProposalSweep({
      jobName: `test-${suffix}`,
      userIds: [USER_A, USER_FAR],
    });
    expect(minted).toBe(0);
    const aRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    expect(aRows.length).toBe(0);
  });
});
