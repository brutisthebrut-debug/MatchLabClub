import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool, jobHeartbeatsTable } from "@workspace/db";
import {
  matchingNudgeTick,
  getMatchingNudgeHeartbeat,
} from "./matchingNudgeJob";
import { saveBrainControls, resetBrainControls } from "./brainConfig";

// Stub the Expo push transport so the "enabled" sweep never makes a network
// call, regardless of any push tokens that happen to live in the dev database.
// With no valid tokens the sweep sends nothing but still records its heartbeat,
// which is the observable signal these tests assert on.
vi.mock("./expoPush", () => ({
  sendExpoPushNotifications: vi.fn(async () => {}),
  isValidExpoPushToken: vi.fn(async () => false),
}));

const MATCHING_NUDGE_JOB = "matching_nudge";

async function clearHeartbeat(): Promise<void> {
  await db
    .delete(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, MATCHING_NUDGE_JOB));
}

beforeEach(async () => {
  await resetBrainControls();
  await clearHeartbeat();
});

afterAll(async () => {
  await resetBrainControls();
  await clearHeartbeat();
  await pool.end();
});

describe("matchingNudgeTick", () => {
  it("skips the sweep when the founder control is off", async () => {
    await saveBrainControls({ matchingNudgeEnabled: false });
    await matchingNudgeTick();
    // Gated off: the tick returns before the sweep, so no heartbeat is written.
    expect(await getMatchingNudgeHeartbeat()).toBeNull();
  });

  it("runs the sweep when the founder control is on", async () => {
    await saveBrainControls({ matchingNudgeEnabled: true });
    await matchingNudgeTick();
    // Gated on: the sweep runs and records a heartbeat even with no recipients.
    expect(await getMatchingNudgeHeartbeat()).not.toBeNull();
  });
});
