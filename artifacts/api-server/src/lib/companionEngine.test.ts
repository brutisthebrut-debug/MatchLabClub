import { describe, it, expect } from "vitest";
import { SIGNAL_REGISTRY, type ReadinessBreakdown } from "./signalRegistry";
import { computeOutcomeInsight, computeNextActions } from "./readiness";
import { buildMirrorPortrait, type MirrorPortrait } from "./aiEngine";
import {
  buildCompanionView,
  answerCompanion,
  deriveObservations,
  detectCommitment,
  reviewMessage,
  normalizePersona,
  clampCandor,
  personaLabel,
} from "./companionEngine";

const AI_TELL_WORDS =
  /\b(unlock|leverage|seamless|elevate|transformative|game-?changer|cutting-edge|dive in|in today's world|unleash)\b/i;

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
    nextActions: computeNextActions(breakdown, false, 1),
    outcome: NO_DATES,
  });
}

function assertVoiceClean(text: string) {
  expect(text).not.toMatch(/—/);
  expect(text).not.toMatch(AI_TELL_WORDS);
  // No emoji (rough surrogate-pair check).
  expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
}

describe("normalizePersona / clampCandor", () => {
  it("defaults unknown persona to best_friend", () => {
    expect(normalizePersona("nonsense")).toBe("best_friend");
    expect(normalizePersona(null)).toBe("best_friend");
    expect(normalizePersona("tough_coach")).toBe("tough_coach");
  });

  it("clamps candor into 1..3 with a default of 2", () => {
    expect(clampCandor(0)).toBe(1);
    expect(clampCandor(9)).toBe(3);
    expect(clampCandor(null)).toBe(2);
    expect(clampCandor(2)).toBe(2);
  });
});

describe("buildCompanionView", () => {
  it("is never blank for an empty user and names a blind spot as the challenge", () => {
    const view = buildCompanionView({
      portrait: makePortrait(emptyBreakdown(), 0),
      persona: "best_friend",
      candor: 2,
    });
    expect(view.greeting.length).toBeGreaterThan(0);
    expect(view.read.length).toBeGreaterThan(0);
    expect(view.oneThing).not.toBeNull();
    expect(view.challenge).toBeTruthy();
    assertVoiceClean(view.greeting);
    assertVoiceClean(view.read);
    assertVoiceClean(view.challenge ?? "");
  });

  it("leads an overdue commitment as the challenge regardless of blind spots", () => {
    const view = buildCompanionView({
      portrait: makePortrait(emptyBreakdown(), 0),
      persona: "tough_coach",
      candor: 3,
      openCommitments: [{ body: "text her back tonight", overdue: true }],
    });
    expect(view.challenge).toMatch(/text her back tonight/);
  });

  it("changes the challenge wording with candor but always tells the truth", () => {
    const portrait = makePortrait(emptyBreakdown(), 0);
    const gentle = buildCompanionView({ portrait, persona: "calm_mentor", candor: 1 });
    const blunt = buildCompanionView({ portrait, persona: "tough_coach", candor: 3 });
    expect(gentle.challenge).not.toEqual(blunt.challenge);
    assertVoiceClean(gentle.challenge ?? "");
    assertVoiceClean(blunt.challenge ?? "");
  });
});

describe("deriveObservations", () => {
  it("praises a real readiness rise and challenges a dip", () => {
    const portrait = makePortrait(emptyBreakdown(), 30);
    const rise = deriveObservations({ portrait, previousScore: 20 });
    expect(rise.some((o) => o.severity === "praise")).toBe(true);

    const dip = deriveObservations({ portrait, previousScore: 40 });
    expect(dip.some((o) => o.kind === "readiness_dip")).toBe(true);
    for (const o of [...rise, ...dip]) assertVoiceClean(o.body);
  });

  it("does not invent a readiness movement when there is no prior score", () => {
    const portrait = makePortrait(emptyBreakdown(), 30);
    const obs = deriveObservations({ portrait, previousScore: null });
    expect(obs.some((o) => o.kind === "readiness_rise")).toBe(false);
    expect(obs.some((o) => o.kind === "readiness_dip")).toBe(false);
  });
});

describe("detectCommitment", () => {
  it("extracts clear first-person future intent", () => {
    expect(detectCommitment("I'll message her back tonight")).toMatch(/message her back tonight/);
    expect(detectCommitment("I am going to update my bio")).toMatch(/update my bio/);
    expect(detectCommitment("i will finish the quiz")).toMatch(/finish the quiz/);
  });

  it("ignores text with no commitment", () => {
    expect(detectCommitment("how am I doing?")).toBeNull();
    expect(detectCommitment("hi")).toBeNull();
  });
});

describe("answerCompanion", () => {
  it("answers a where-do-I-stand question with the real score", () => {
    const view = buildCompanionView({
      portrait: makePortrait(emptyBreakdown(), 12),
      persona: "best_friend",
      candor: 2,
    });
    const res = answerCompanion(view, "where do I stand?");
    expect(res.answer).toMatch(/12/);
    expect(res.grounding).toContain("readiness score");
    assertVoiceClean(res.answer);
  });

  it("records a commitment surfaced inside a question", () => {
    const view = buildCompanionView({
      portrait: makePortrait(emptyBreakdown(), 12),
      persona: "best_friend",
      candor: 2,
    });
    const res = answerCompanion(view, "I'll redo my photos this weekend");
    expect(res.detectedCommitment).toMatch(/redo my photos this weekend/);
    assertVoiceClean(res.answer);
  });
});

describe("reviewMessage", () => {
  it("flags a low-effort outgoing opener as risky", () => {
    const r = reviewMessage("hey", "sending", "best_friend", 2);
    expect(r.risks.length).toBeGreaterThan(0);
    assertVoiceClean(r.verdict);
    r.risks.forEach(assertVoiceClean);
    assertVoiceClean(r.suggestion);
  });

  it("credits an outgoing message that asks a question", () => {
    const r = reviewMessage(
      "I saw you climb, what is the best route you have done lately?",
      "sending",
      "tough_coach",
      3,
    );
    expect(r.strengths.length).toBeGreaterThan(0);
    assertVoiceClean(r.verdict);
  });

  it("handles a received message with its own framing", () => {
    const r = reviewMessage("what are you up to this weekend?", "received", "calm_mentor", 2);
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.suggestion.length).toBeGreaterThan(0);
    assertVoiceClean(r.suggestion);
  });
});

describe("personaLabel", () => {
  it("returns a human label for every persona", () => {
    expect(personaLabel("best_friend")).toMatch(/Echo/);
    expect(personaLabel("witty_sibling")).toMatch(/Echo/);
  });
});
