import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  companionStateTable,
  companionMessagesTable,
  companionCommitmentsTable,
  companionNotificationsTable,
  companionChannelPrefsTable,
} from "@workspace/db";
import {
  runCompanionNudgeSweep,
  isCompanionNudgeEnabled,
} from "./companionNudgeJob";

const suffix = crypto.randomBytes(6).toString("hex");
const USER_QUIET = `nudge-quiet-${suffix}`;
const USER_MISSED = `nudge-missed-${suffix}`;
const ALL_USERS = [USER_QUIET, USER_MISSED];

async function cleanup(): Promise<void> {
  await db
    .delete(companionNotificationsTable)
    .where(inArray(companionNotificationsTable.userId, ALL_USERS));
  await db
    .delete(companionCommitmentsTable)
    .where(inArray(companionCommitmentsTable.userId, ALL_USERS));
  await db
    .delete(companionMessagesTable)
    .where(inArray(companionMessagesTable.userId, ALL_USERS));
  await db
    .delete(companionChannelPrefsTable)
    .where(inArray(companionChannelPrefsTable.userId, ALL_USERS));
  await db
    .delete(companionStateTable)
    .where(inArray(companionStateTable.userId, ALL_USERS));
}

async function seedState(userId: string, lastSeenScore: number): Promise<void> {
  await db.insert(companionStateTable).values({
    userId,
    evolvingSummary: "test fixture",
    lastSeenScore,
    persona: "best_friend",
    candor: 2,
  });
  // Email off in tests so the sweep never reaches the mailer, keeping it pure.
  await db.insert(companionChannelPrefsTable).values({
    userId,
    inApp: true,
    email: false,
    sms: false,
  });
}

async function notificationsFor(userId: string) {
  return db
    .select()
    .from(companionNotificationsTable)
    .where(eq(companionNotificationsTable.userId, userId));
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("companion nudge job", () => {
  it("is off by default", () => {
    const prev = process.env.COMPANION_NUDGE_ENABLED;
    delete process.env.COMPANION_NUDGE_ENABLED;
    expect(isCompanionNudgeEnabled()).toBe(false);
    process.env.COMPANION_NUDGE_ENABLED = "true";
    expect(isCompanionNudgeEnabled()).toBe(true);
    if (prev === undefined) delete process.env.COMPANION_NUDGE_ENABLED;
    else process.env.COMPANION_NUDGE_ENABLED = prev;
  });

  it("writes a gone-quiet nudge for an engaged user with no messages", async () => {
    await seedState(USER_QUIET, 0);

    const written = await runCompanionNudgeSweep({
      jobName: `test_${suffix}`,
      userIds: [USER_QUIET],
    });
    expect(written).toBeGreaterThanOrEqual(1);

    const notes = await notificationsFor(USER_QUIET);
    expect(notes.length).toBe(1);
    expect(notes[0]?.kind).toBe("gone_quiet");
    expect(notes[0]?.source).toBe("proactive");
  });

  it("is idempotent: a second sweep does not duplicate the same nudge", async () => {
    await seedState(USER_QUIET, 0);

    await runCompanionNudgeSweep({
      jobName: `test_${suffix}`,
      userIds: [USER_QUIET],
    });
    await runCompanionNudgeSweep({
      jobName: `test_${suffix}`,
      userIds: [USER_QUIET],
    });

    const notes = await notificationsFor(USER_QUIET);
    expect(notes.length).toBe(1);
  });

  it("prioritizes a missed commitment over other nudges", async () => {
    await seedState(USER_MISSED, 0);
    await db.insert(companionCommitmentsTable).values({
      userId: USER_MISSED,
      body: "message her back",
      status: "open",
      dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const written = await runCompanionNudgeSweep({
      jobName: `test_${suffix}`,
      userIds: [USER_MISSED],
    });
    expect(written).toBeGreaterThanOrEqual(1);

    const notes = await notificationsFor(USER_MISSED);
    expect(notes.length).toBe(1);
    expect(notes[0]?.kind).toBe("missed_commitment");
  });
});
