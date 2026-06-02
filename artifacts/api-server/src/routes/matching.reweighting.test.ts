import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, postDateNotesTable } from "@workspace/db";
import {
  saveBrainControls,
  resetBrainControls,
  defaultControls,
} from "../lib/brainConfig";
import { computeReadiness, buildReadinessLearning } from "./matching";

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

describe("buildReadinessLearning privacy contract", () => {
  // The raw debrief text a user might type. It must NEVER appear in the
  // user-facing learning read; only derived counts, scores, and lane labels do.
  const RAW_NOTE = "he ghosted me after I overshared about my ex at dinner";

  const readiness = {
    score: 58,
    breakdown: {} as never,
    weights: {},
    reweighting: {
      baseScore: 58,
      tiltedScore: 63,
      delta: 5,
      inCohort: false,
      applied: false,
    },
  };

  const outcome = {
    anotherDate: 0,
    noMore: 3,
    ghosted: 2,
    unsure: 1,
    totalDates: 6,
    headline: "Most of your recent dates fizzled. Let us look at why.",
  };

  it("returns only derived fields and never leaks raw outcome text", () => {
    const learning = buildReadinessLearning(
      { ...defaultControls(), reweightingMode: "shadow" },
      readiness,
      outcome,
    );

    // Exact key allowlist: no extra fields can smuggle data out.
    expect(Object.keys(learning).sort()).toEqual(
      [
        "baseScore",
        "delta",
        "headline",
        "leaningInto",
        "observedScore",
        "observing",
        "totalDates",
      ].sort(),
    );

    // Derived scalars mirror the observation, nothing more.
    expect(learning.observing).toBe(true);
    expect(learning.baseScore).toBe(58);
    expect(learning.observedScore).toBe(63);
    expect(learning.delta).toBe(5);
    expect(learning.totalDates).toBe(6);

    // leaningInto carries registry lane LABELS, not raw content.
    expect(Array.isArray(learning.leaningInto)).toBe(true);
    expect(learning.leaningInto).not.toContain(RAW_NOTE);

    // The whole serialized payload is free of any raw debrief text.
    expect(JSON.stringify(learning)).not.toContain(RAW_NOTE);
  });

  it("hold mode reports observing=false", () => {
    const learning = buildReadinessLearning(
      { ...defaultControls(), reweightingMode: "hold" },
      { ...readiness, reweighting: undefined },
      outcome,
    );
    expect(learning.observing).toBe(false);
    expect(learning.baseScore).toBe(58);
    expect(learning.observedScore).toBe(58);
    expect(learning.delta).toBe(0);
  });
});
