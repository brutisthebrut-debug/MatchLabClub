import { describe, it, expect } from "vitest";
import {
  WELLNESS_QUESTION_BANK,
  WELLNESS_BANK_TOTAL,
  WELLNESS_DIMENSIONS,
  pickDailyQuestion,
} from "./wellnessQuestionBank";

describe("wellnessQuestionBank", () => {
  it("has unique, stably-namespaced question ids", () => {
    const ids = WELLNESS_QUESTION_BANK.map((q) => q.questionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WELLNESS_BANK_TOTAL).toBe(ids.length);
    for (const q of WELLNESS_QUESTION_BANK) {
      expect(q.questionId.startsWith(`daily:${q.dimension}:`)).toBe(true);
    }
  });

  it("covers every wellness dimension", () => {
    for (const dim of WELLNESS_DIMENSIONS) {
      expect(WELLNESS_QUESTION_BANK.some((q) => q.dimension === dim)).toBe(true);
    }
  });

  it("starts with the first question of the first dimension when nothing is answered", () => {
    const q = pickDailyQuestion({
      answeredQuestionIds: new Set(),
      dimensionAnsweredCounts: new Map(),
    });
    expect(q?.questionId).toBe(WELLNESS_QUESTION_BANK[0]!.questionId);
  });

  it("moves on from a fully-covered dimension to a less-covered one", () => {
    const first = WELLNESS_DIMENSIONS[0];
    const answered = new Set(
      WELLNESS_QUESTION_BANK.filter((q) => q.dimension === first).map(
        (q) => q.questionId,
      ),
    );
    const counts = new Map<string, number>([[first, answered.size]]);
    const q = pickDailyQuestion({
      answeredQuestionIds: answered,
      dimensionAnsweredCounts: counts,
    });
    expect(q).not.toBeNull();
    expect(q!.dimension).not.toBe(first);
  });

  it("returns null once every question is answered", () => {
    const answered = new Set(WELLNESS_QUESTION_BANK.map((q) => q.questionId));
    const counts = new Map(WELLNESS_DIMENSIONS.map((d) => [d, 4] as const));
    const q = pickDailyQuestion({
      answeredQuestionIds: answered,
      dimensionAnsweredCounts: counts,
    });
    expect(q).toBeNull();
  });
});
