import { describe, it, expect } from "vitest";
import { computeClimb } from "./climb";

describe("computeClimb", () => {
  it("starts at the getting-started stage with nothing cleared", () => {
    const c = computeClimb(0, 50);
    expect(c.level).toBe(0);
    expect(c.stageTitle).toBe("Getting started");
    expect(c.eligible).toBe(false);
    expect(c.next?.title).toBe("First signals");
    expect(c.pointsToNext).toBe(1);
  });

  it("advances the level as milestones are cleared", () => {
    const c = computeClimb(30, 50);
    // First signals (1) and Patterns forming (25) are cleared.
    expect(c.level).toBe(2);
    expect(c.stageTitle).toBe("Patterns forming");
    expect(c.next?.title).toBe("Match ready");
    expect(c.eligible).toBe(false);
  });

  it("marks the user eligible once the threshold is reached", () => {
    const c = computeClimb(55, 50);
    expect(c.eligible).toBe(true);
    const ready = c.unlocks.find((u) => u.iconKey === "ready");
    expect(ready?.unlocked).toBe(true);
  });

  it("tops out cleanly at full readiness", () => {
    const c = computeClimb(100, 50);
    expect(c.level).toBe(c.totalLevels);
    expect(c.next).toBeUndefined();
    expect(c.pointsToNext).toBe(0);
    expect(c.progressToNextPct).toBe(100);
  });

  it("reports band progress toward the next level", () => {
    const c = computeClimb(13, 50);
    // Between First signals (1) and Patterns forming (25): (13-1)/(25-1) = 50%.
    expect(c.next?.title).toBe("Patterns forming");
    expect(c.progressToNextPct).toBe(50);
  });

  it("respects a custom threshold for the match-ready level", () => {
    const c = computeClimb(40, 35);
    expect(c.eligible).toBe(true);
    expect(c.threshold).toBe(35);
  });

  it("keeps all copy free of em dashes", () => {
    const c = computeClimb(30, 50);
    const copy = [
      c.stageTitle,
      c.stageBlurb,
      ...c.unlocks.map((u) => `${u.title} ${u.unlocks}`),
    ].join(" ");
    expect(copy).not.toContain("\u2014");
  });
});
