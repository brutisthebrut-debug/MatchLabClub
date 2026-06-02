import { describe, it, expect } from "vitest";
import { buildReweightingRecommendation } from "./founder";

const BANNED_TELLS = [
  "dive in",
  "unleash",
  "elevate",
  "in today's world",
  "delve",
  "tapestry",
];

function assertVoice(text: string): void {
  expect(text).not.toContain("\u2014");
  for (const tell of BANNED_TELLS) {
    expect(text.toLowerCase()).not.toContain(tell);
  }
}

describe("buildReweightingRecommendation", () => {
  const base = {
    mode: "shadow" as const,
    cohortPercent: 0,
    scoredUsers: 10,
    changedUsers: 4,
    averageAbsDelta: 3,
    thresholdCrossingsUp: 0,
    thresholdCrossingsDown: 0,
    topLane: null as string | null,
  };

  it("tells the founder to keep gathering when nothing would move", () => {
    const out = buildReweightingRecommendation({ ...base, changedUsers: 0 });
    expect(out).toContain("No scores would move yet");
    assertVoice(out);
  });

  it("reads net positive and suggests graduating when up crossings lead", () => {
    const out = buildReweightingRecommendation({
      ...base,
      thresholdCrossingsUp: 3,
      thresholdCrossingsDown: 1,
    });
    expect(out).toContain("net positive");
    expect(out).toContain("Graduating to applied");
    assertVoice(out);
  });

  it("treats an even split as net positive", () => {
    const out = buildReweightingRecommendation({
      ...base,
      thresholdCrossingsUp: 2,
      thresholdCrossingsDown: 2,
    });
    expect(out).toContain("net positive");
    assertVoice(out);
  });

  it("recommends holding in shadow when down crossings lead", () => {
    const out = buildReweightingRecommendation({
      ...base,
      thresholdCrossingsUp: 1,
      thresholdCrossingsDown: 4,
    });
    expect(out).toContain("hold in shadow");
    assertVoice(out);
  });

  it("frames the live cohort when already applied", () => {
    const out = buildReweightingRecommendation({
      ...base,
      mode: "applied",
      cohortPercent: 20,
      thresholdCrossingsUp: 5,
      thresholdCrossingsDown: 1,
    });
    expect(out).toContain("Live for 20% of users");
    expect(out).not.toContain("Graduating to applied");
    assertVoice(out);
  });

  it("surfaces the dominant lane when present", () => {
    const out = buildReweightingRecommendation({
      ...base,
      thresholdCrossingsUp: 2,
      thresholdCrossingsDown: 0,
      topLane: "post-date reflections",
    });
    expect(out).toContain("post-date reflections");
    assertVoice(out);
  });
});
