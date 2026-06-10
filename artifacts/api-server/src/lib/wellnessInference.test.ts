import { describe, it, expect } from "vitest";
import { inferWellnessSignals } from "./aiEngine";
import { WELLNESS_DIMENSIONS } from "./wellnessQuestionBank";

describe("inferWellnessSignals", () => {
  it("returns nothing for empty sources", () => {
    expect(inferWellnessSignals({ sources: [] })).toEqual([]);
    expect(
      inferWellnessSignals({ sources: [{ kind: "journal", text: "   " }] }),
    ).toEqual([]);
  });

  it("extracts a per-dimension candidate from matching text", () => {
    const out = inferWellnessSignals({
      sources: [
        {
          kind: "journal",
          text: "I went to the gym this morning and felt great. Money has been tight so I am sticking to a budget.",
        },
      ],
    });
    const dims = out.map((c) => c.dimension);
    expect(dims).toContain("physical");
    expect(dims).toContain("financial");
    for (const c of out) {
      expect(WELLNESS_DIMENSIONS).toContain(c.dimension);
      expect(c.questionText.length).toBeGreaterThan(0);
      expect(c.suggestedAnswer.length).toBeGreaterThan(0);
      expect(c.sourceKind).toBe("journal");
    }
  });

  it("captures at most one candidate per dimension and respects the cap", () => {
    const out = inferWellnessSignals({
      sources: [
        {
          kind: "journal",
          text: "gym run workout. friends party people. money budget save. read book learn. work job career. family mom dad. faith meditate purpose. value believe integrity.",
        },
      ],
      maxCandidates: 3,
    });
    expect(out.length).toBeLessThanOrEqual(3);
    const dims = out.map((c) => c.dimension);
    expect(new Set(dims).size).toBe(dims.length);
  });

  it("attributes a dimension to the first source that mentions it", () => {
    const out = inferWellnessSignals({
      sources: [
        { kind: "journal", text: "I have been hitting the gym a lot lately." },
        { kind: "coach", text: "I told her I love the gym." },
      ],
    });
    const physical = out.find((c) => c.dimension === "physical");
    expect(physical?.sourceKind).toBe("journal");
  });

  it("trims long snippets to a bounded length", () => {
    const long = `gym ${"x".repeat(400)}`;
    const out = inferWellnessSignals({
      sources: [{ kind: "journal", text: long }],
    });
    const physical = out.find((c) => c.dimension === "physical");
    expect(physical).toBeTruthy();
    expect(physical!.suggestedAnswer.length).toBeLessThanOrEqual(280);
  });
});
