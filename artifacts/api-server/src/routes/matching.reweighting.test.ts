import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, postDateNotesTable } from "@workspace/db";
import { saveBrainControls, resetBrainControls } from "../lib/brainConfig";
import { computeReadiness } from "./matching";

// A user with several fizzling post-date outcomes: this both gives them real
// postDate coverage AND tilts the outcome re-weighting toward in-person fit
// lanes, so base vs tilted scores diverge measurably.
const suffix = crypto.randomBytes(6).toString("hex");
const USER = `rw-${suffix}`;

async function seedFizzlingDates(userId: string, n: number): Promise<void> {
  const rows = Array.from({ length: n }, (_, i) => ({
    userId,
    summary: `seeded debrief ${i}`,
    outcome: i % 2 === 0 ? "no_more" : "ghosted",
  }));
  await db.insert(postDateNotesTable).values(rows);
}

describe("computeReadiness re-weighting", () => {
  beforeAll(async () => {
    await seedFizzlingDates(USER, 6);
  });

  afterAll(async () => {
    await db.delete(postDateNotesTable).where(eq(postDateNotesTable.userId, USER));
    await resetBrainControls();
    await pool.end();
  });

  it("hold mode: no re-weighting observation, base score served", async () => {
    await saveBrainControls({ reweightingMode: "hold" });
    const r = await computeReadiness(USER);
    expect(r.reweighting).toBeUndefined();
    expect(r.score).toBeGreaterThan(0);
  });

  it("shadow mode: reports the tilt impact but still serves the base score", async () => {
    await saveBrainControls({ reweightingMode: "shadow" });
    const r = await computeReadiness(USER);
    expect(r.reweighting).toBeDefined();
    const rw = r.reweighting!;
    // Shadow never changes what the user sees: served score equals the base.
    expect(rw.applied).toBe(false);
    expect(r.score).toBe(rw.baseScore);
    expect(rw.delta).toBe(rw.tiltedScore - rw.baseScore);
    // The seeded fizzling outcomes move the tilt, so there is real impact to see.
    expect(rw.tiltedScore).not.toBe(rw.baseScore);
  });

  it("applied + full cohort: serves the tilted score", async () => {
    await saveBrainControls({
      reweightingMode: "applied",
      reweightingCohortPercent: 100,
    });
    const r = await computeReadiness(USER);
    const rw = r.reweighting!;
    expect(rw.inCohort).toBe(true);
    expect(rw.applied).toBe(true);
    expect(r.score).toBe(rw.tiltedScore);
  });

  it("applied + empty cohort: holds the user back on the base score", async () => {
    await saveBrainControls({
      reweightingMode: "applied",
      reweightingCohortPercent: 0,
    });
    const r = await computeReadiness(USER);
    const rw = r.reweighting!;
    expect(rw.inCohort).toBe(false);
    expect(rw.applied).toBe(false);
    expect(r.score).toBe(rw.baseScore);
    // The preview is still computed so the founder can see what would happen.
    expect(rw.tiltedScore).not.toBe(rw.baseScore);
  });
});
