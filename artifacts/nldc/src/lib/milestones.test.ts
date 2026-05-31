import { describe, it, expect } from "vitest";
import { buildMilestones, nextMilestone } from "./milestones";

const sorted = (ms: { threshold: number }[]) =>
  ms.map((m) => m.threshold);

describe("buildMilestones", () => {
  it("is sorted ascending for a normal threshold", () => {
    expect(sorted(buildMilestones(50))).toEqual([1, 25, 50, 75]);
  });

  it("stays sorted when the threshold is below the fixed steps", () => {
    const t = sorted(buildMilestones(20));
    expect(t).toEqual([...t].sort((a, b) => a - b));
    expect(t).toContain(20);
  });

  it("stays sorted when the threshold is high", () => {
    const t = sorted(buildMilestones(90));
    expect(t).toEqual([...t].sort((a, b) => a - b));
    expect(t).toContain(90);
  });

  it("dedupes a threshold collision, match ready wins", () => {
    const at25 = buildMilestones(25).filter((m) => m.threshold === 25);
    expect(at25).toHaveLength(1);
    expect(at25[0].title).toBe("Match ready");
  });

  it("clamps out-of-range thresholds into 1-100", () => {
    expect(buildMilestones(0).every((m) => m.threshold >= 1)).toBe(true);
    expect(buildMilestones(150).every((m) => m.threshold <= 100)).toBe(true);
  });
});

describe("nextMilestone", () => {
  it("returns the first milestone above the score", () => {
    const ms = buildMilestones(50);
    expect(nextMilestone(0, ms)?.threshold).toBe(1);
    expect(nextMilestone(30, ms)?.title).toBe("Match ready");
    expect(nextMilestone(50, ms)?.threshold).toBe(75);
  });

  it("returns undefined when every milestone is cleared", () => {
    expect(nextMilestone(100, buildMilestones(50))).toBeUndefined();
  });
});
