import { describe, it, expect } from "vitest";
import { SIGNAL_REGISTRY, type ReadinessBreakdown } from "./signalRegistry";
import { computeOutcomeInsight, computeNextActions } from "./readiness";
import {
  buildMirrorPortrait,
  buildMirrorDigest,
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
): MirrorPortrait {
  return buildMirrorPortrait({
    breakdown,
    score,
    eligible: score >= threshold,
    threshold,
    nextActions: computeNextActions(breakdown, score >= threshold, 3),
    outcome: NO_DATES,
  });
}

function allStrings(digest: ReturnType<typeof buildMirrorDigest>): string[] {
  return [
    digest.subject,
    digest.intro,
    digest.scoreLine,
    ...digest.changed,
    digest.nudge ?? "",
    digest.nextSignal?.label ?? "",
    digest.nextSignal?.detail ?? "",
  ];
}

describe("buildMirrorDigest", () => {
  it("produces a cold first-send digest when there is no prior state", () => {
    const breakdown = emptyBreakdown();
    breakdown.wellness = 60;
    const portrait = makePortrait(breakdown, 28);
    const digest = buildMirrorDigest({
      portrait,
      previousScore: null,
      previousBreakdown: null,
      cadenceLabel: "this week",
    });
    expect(digest.mode).toBe("cold");
    expect(digest.subject.length).toBeGreaterThan(0);
    // Cold send describes what the machine can already read, not a delta.
    expect(digest.scoreLine).not.toMatch(/climbed/);
    expect(digest.changed.length).toBeGreaterThan(0);
    expect(digest.engineVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("reports a positive delta and gained lanes in progress mode", () => {
    const previous = emptyBreakdown();
    previous.wellness = 20;
    const current = emptyBreakdown();
    current.wellness = 80;
    current.compass = 40;
    const portrait = makePortrait(current, 62);
    const digest = buildMirrorDigest({
      portrait,
      previousScore: 50,
      previousBreakdown: previous,
      cadenceLabel: "this week",
    });
    expect(digest.mode).toBe("progress");
    expect(digest.scoreLine).toContain("12");
    expect(digest.subject).toContain("+12");
    expect(digest.changed.length).toBeGreaterThan(0);
  });

  it("falls into stall mode with a nudge when nothing moved", () => {
    const breakdown = emptyBreakdown();
    breakdown.wellness = 40;
    const portrait = makePortrait(breakdown, 38);
    const digest = buildMirrorDigest({
      portrait,
      previousScore: 38,
      previousBreakdown: breakdown,
      cadenceLabel: "in the last two weeks",
    });
    expect(digest.mode).toBe("stall");
    expect(digest.nudge).not.toBeNull();
    expect(digest.nudge).toContain("in the last two weeks");
    // Stall send shows no fresh gains.
    expect(digest.changed).toHaveLength(0);
  });

  it("never emits em dashes, AI-tell words, or emojis", () => {
    const current = emptyBreakdown();
    current.wellness = 80;
    current.compass = 30;
    const portrait = makePortrait(current, 62);
    const modes = [
      buildMirrorDigest({
        portrait,
        previousScore: null,
        previousBreakdown: null,
        cadenceLabel: "this week",
      }),
      buildMirrorDigest({
        portrait,
        previousScore: 40,
        previousBreakdown: emptyBreakdown(),
        cadenceLabel: "this week",
      }),
      buildMirrorDigest({
        portrait,
        previousScore: 62,
        previousBreakdown: current,
        cadenceLabel: "this week",
      }),
    ];
    for (const digest of modes) {
      for (const text of allStrings(digest)) {
        expect(text).not.toContain("\u2014");
        expect(text).not.toMatch(AI_TELL_WORDS);
        expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    }
  });
});
