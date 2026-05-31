import { describe, it, expect } from "vitest";
import { SIGNAL_REGISTRY, type ReadinessBreakdown } from "./signalRegistry";
import { computeOutcomeInsight, computeNextActions } from "./readiness";
import {
  buildMirrorPortrait,
  answerMirrorQuestion,
  type MirrorPortrait,
} from "./aiEngine";

const AI_TELL_WORDS =
  /\b(unlock|leverage|seamless|elevate|transformative|game-?changer|cutting-edge|dive in|in today's world)\b/i;

function emptyBreakdown(): ReadinessBreakdown {
  return Object.fromEntries(
    SIGNAL_REGISTRY.map((c) => [c.id, 0]),
  ) as ReadinessBreakdown;
}

const NO_DATES = computeOutcomeInsight({
  anotherDate: 0,
  noMore: 0,
  ghosted: 0,
  unsure: 0,
});

function makePortrait(
  breakdown: ReadinessBreakdown,
  score: number,
  threshold = 50,
  outcome = NO_DATES,
): MirrorPortrait {
  return buildMirrorPortrait({
    breakdown,
    score,
    eligible: score >= threshold,
    threshold,
    nextActions: computeNextActions(breakdown, false, 1),
    outcome,
  });
}

describe("buildMirrorPortrait", () => {
  it("is never blank for a user who has fed nothing", () => {
    const portrait = makePortrait(emptyBreakdown(), 0);
    expect(portrait.stage).toBe("outline");
    expect(portrait.known).toHaveLength(0);
    expect(portrait.blindSpots.length).toBeGreaterThan(0);
    expect(portrait.nextSignal).not.toBeNull();
    expect(portrait.headline.length).toBeGreaterThan(0);
    expect(portrait.coveragePercent).toBe(0);
    expect(portrait.engineVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("surfaces known dimensions sorted by coverage and confidence", () => {
    const breakdown = emptyBreakdown();
    breakdown.wellness = 80;
    breakdown.compass = 40;
    const portrait = makePortrait(breakdown, 62);
    expect(portrait.stage).toBe("sharp");
    expect(portrait.eligible).toBe(true);
    const keys = portrait.known.map((k) => k.key);
    expect(keys).toContain("wellness");
    expect(keys).toContain("compass");
    expect(portrait.known[0]!.key).toBe("wellness");
    expect(portrait.coveragePercent).toBeGreaterThan(0);
  });

  it("moves through stages with the score", () => {
    expect(makePortrait(emptyBreakdown(), 10).stage).toBe("outline");
    expect(makePortrait(emptyBreakdown(), 30).stage).toBe("forming");
    expect(makePortrait(emptyBreakdown(), 55).stage).toBe("sharp");
    expect(makePortrait(emptyBreakdown(), 85).stage).toBe("vivid");
  });

  it("keeps every user-facing string voice-clean", () => {
    const breakdown = emptyBreakdown();
    breakdown.wellness = 50;
    const portrait = makePortrait(breakdown, 40);
    const strings = [
      portrait.headline,
      portrait.stageLabel,
      portrait.stageBlurb,
      ...portrait.known.map((k) => k.insight),
      ...portrait.blindSpots.map((b) => b.why),
    ];
    for (const s of strings) {
      expect(s).not.toContain("\u2014");
      expect(s).not.toMatch(AI_TELL_WORDS);
    }
  });
});

describe("answerMirrorQuestion", () => {
  const breakdown = emptyBreakdown();
  breakdown.wellness = 80;
  breakdown.compass = 40;
  const portrait = makePortrait(breakdown, 62);

  it("answers a readiness question grounded in Match Readiness", () => {
    const ans = answerMirrorQuestion(portrait, "Am I ready to match?");
    expect(ans.answer).toMatch(/readiness/i);
    expect(ans.grounding).toContain("Match Readiness");
    expect(ans.followUp.length).toBeGreaterThan(0);
  });

  it("describes what it knows, grounded in real signals", () => {
    const ans = answerMirrorQuestion(portrait, "What do you know about me?");
    expect(ans.answer.length).toBeGreaterThan(0);
    expect(ans.grounding.length).toBeGreaterThan(0);
  });

  it("is honest when it knows nothing", () => {
    const blank = makePortrait(emptyBreakdown(), 0);
    const ans = answerMirrorQuestion(blank, "What do you see in me?");
    expect(ans.answer.toLowerCase()).toContain("not much");
    expect(ans.grounding).toHaveLength(0);
  });

  it("always returns a non-empty, voice-clean answer for any question", () => {
    for (const q of [
      "what should I work on next?",
      "who should I be looking for?",
      "do I keep sabotaging myself?",
      "tell me something random",
    ]) {
      const ans = answerMirrorQuestion(portrait, q);
      expect(ans.answer.length).toBeGreaterThan(0);
      expect(ans.followUp.length).toBeGreaterThan(0);
      expect(ans.answer).not.toContain("\u2014");
      expect(ans.answer).not.toMatch(AI_TELL_WORDS);
    }
  });
});
