import { describe, it, expect } from "vitest";
import {
  FEATURE_USAGE_MAP,
  WELLNESS_QUESTIONS,
  getFeatureReadiness,
} from "./wellnessQuestionBank";

describe("getFeatureReadiness", () => {
  it("returns 0% coverage and 3 next questions when nothing is answered", () => {
    const r = getFeatureReadiness("compass", new Set<string>(), 3);
    expect(r.feature).toBe("compass");
    expect(r.coveredDimensions).toBe(0);
    expect(r.totalDimensions).toBe(FEATURE_USAGE_MAP.compass.length);
    expect(r.answeredQuestions).toBe(0);
    expect(r.coveragePct).toBe(0);
    expect(r.nextQuestions).toHaveLength(3);
    // Each next-question should belong to a compass-feeding dimension.
    for (const q of r.nextQuestions) {
      expect(FEATURE_USAGE_MAP.compass).toContain(q.dimension);
    }
  });

  it("prioritises uncovered dimensions over deepening covered ones", () => {
    // Answer every question in the first compass dimension.
    const firstDim = FEATURE_USAGE_MAP.compass[0]!;
    const answered = new Set(
      WELLNESS_QUESTIONS.filter(q => q.dimension === firstDim).map(q => q.id),
    );
    const r = getFeatureReadiness("compass", answered, 3);
    expect(r.coveredDimensions).toBe(1);
    expect(r.coveragePct).toBeGreaterThan(0);
    // None of the next questions should be in the already-covered dimension.
    for (const q of r.nextQuestions) {
      expect(q.dimension).not.toBe(firstDim);
    }
  });

  it("de-prioritises sensitive questions in the next-up list", () => {
    const r = getFeatureReadiness("coach", new Set<string>(), 3);
    // At least the first recommended question should be non-sensitive.
    expect(r.nextQuestions[0]?.sensitive).not.toBe(true);
  });

  it("reports 100% coverage and an empty next list when fully answered", () => {
    const allCompassQs = WELLNESS_QUESTIONS.filter(q =>
      FEATURE_USAGE_MAP.compass.includes(q.dimension),
    );
    const answered = new Set(allCompassQs.map(q => q.id));
    const r = getFeatureReadiness("compass", answered, 3);
    expect(r.coveragePct).toBe(100);
    expect(r.coveredDimensions).toBe(r.totalDimensions);
    expect(r.nextQuestions).toHaveLength(0);
  });
});
