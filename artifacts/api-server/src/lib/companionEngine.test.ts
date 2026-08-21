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
  buildReaction,
  chooseEchoNextMove,
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
    const gentle = buildCompanionView({
      portrait,
      persona: "calm_mentor",
      candor: 1,
    });
    const blunt = buildCompanionView({
      portrait,
      persona: "tough_coach",
      candor: 3,
    });
    expect(gentle.challenge).not.toEqual(blunt.challenge);
    assertVoiceClean(gentle.challenge ?? "");
    assertVoiceClean(blunt.challenge ?? "");
  });
});

describe("chooseEchoNextMove", () => {
  const profileMove = {
    label: "Share a little more",
    detail: "Help Echo replace a guess with evidence.",
    href: "/play",
    points: 12,
  };

  it("prioritizes a real proposal over every lower-priority task", () => {
    const move = chooseEchoNextMove({
      pendingProposal: true,
      unreadConnection: { id: "connection-1", unreadCount: 2 },
      pendingDebriefConnectionId: "connection-2",
      overdueCommitment: "send the message",
      pendingLearning: true,
      profileMove,
    });
    expect(move.label).toMatch(/proposal/i);
    expect(move.href).toBe("/matches");
    expect(move.points).toBe(0);
  });

  it("returns an unread mutual conversation before profile work", () => {
    const move = chooseEchoNextMove({
      pendingProposal: false,
      unreadConnection: { id: "connection-1", unreadCount: 2 },
      pendingDebriefConnectionId: "connection-2",
      overdueCommitment: null,
      pendingLearning: false,
      profileMove,
    });
    expect(move.href).toBe("/matches/connection-1");
    expect(move.detail).toMatch(/2 unread messages/i);
  });

  it("brings a completed date back to Echo for a private debrief", () => {
    const move = chooseEchoNextMove({
      pendingProposal: false,
      unreadConnection: null,
      pendingDebriefConnectionId: "connection-2",
      overdueCommitment: "send the message.",
      pendingLearning: true,
      profileMove,
    });
    expect(move.href).toBe("/copilot/debrief?connectionId=connection-2");
    expect(move.label).toMatch(/date felt/i);
    expect(move.detail).toMatch(/before anything becomes profile truth/i);
  });

  it("holds the member to an overdue commitment before suggesting a tool", () => {
    const move = chooseEchoNextMove({
      pendingProposal: false,
      unreadConnection: null,
      pendingDebriefConnectionId: null,
      overdueCommitment: "send the message.",
      pendingLearning: true,
      profileMove,
    });
    expect(move.label).toMatch(/promise/i);
    expect(move.detail).toMatch(/send the message/i);
  });

  it("asks the member to confirm a pending learning before profile work", () => {
    const move = chooseEchoNextMove({
      pendingProposal: false,
      unreadConnection: null,
      pendingDebriefConnectionId: null,
      overdueCommitment: null,
      pendingLearning: true,
      profileMove,
    });
    expect(move.href).toBe("/echo#echo-learning");
    expect(move.label).toMatch(/Echo thinks it learned/i);
    expect(move.detail).toMatch(/confirm|correct|set it aside/i);
    expect(move.points).toBe(0);
  });

  it("keeps profile suggestions qualitative and removes score rewards", () => {
    const move = chooseEchoNextMove({
      pendingProposal: false,
      unreadConnection: null,
      pendingDebriefConnectionId: null,
      overdueCommitment: null,
      pendingLearning: false,
      profileMove,
    });
    expect(move.href).toBe("/play");
    expect(move.points).toBe(0);
    expect(move.detail).not.toMatch(/score|points?|earn/i);
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
    expect(detectCommitment("I'll message her back tonight")).toMatch(
      /message her back tonight/,
    );
    expect(detectCommitment("I am going to update my bio")).toMatch(
      /update my bio/,
    );
    expect(detectCommitment("i will finish the quiz")).toMatch(
      /finish the quiz/,
    );
  });

  it("ignores text with no commitment", () => {
    expect(detectCommitment("how am I doing?")).toBeNull();
    expect(detectCommitment("hi")).toBeNull();
  });
});

describe("answerCompanion", () => {
  it("answers a where-do-I-stand question with qualitative evidence", () => {
    const view = buildCompanionView({
      portrait: makePortrait(emptyBreakdown(), 12),
      persona: "best_friend",
      candor: 2,
    });
    const res = answerCompanion(view, "where do I stand?");
    expect(res.answer).toMatch(/meaningful gaps/i);
    expect(res.answer).not.toMatch(/12|score|points?|earned/i);
    expect(res.grounding).toContain("profile evidence");
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
    const r = reviewMessage(
      "what are you up to this weekend?",
      "received",
      "calm_mentor",
      2,
    );
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

describe("buildReaction", () => {
  function coverageOf(portrait: MirrorPortrait): Record<string, number> {
    return Object.fromEntries(portrait.known.map((k) => [k.key, k.coverage]));
  }

  function breakdownWith(
    overrides: Record<string, number>,
  ): ReadinessBreakdown {
    return { ...emptyBreakdown(), ...overrides } as ReadinessBreakdown;
  }

  it("is silent on the first look with no prior baseline", () => {
    const portrait = makePortrait(emptyBreakdown(), 20);
    const r = buildReaction({
      portrait,
      previousScore: null,
      previousCoverageByKey: null,
      persona: "best_friend",
      candor: 2,
    });
    expect(r.moved).toBe(false);
    expect(r.tone).toBe("steady");
    expect(r.headline).toBe("");
    expect(r.nowSee).toBeNull();
  });

  it("reacts to a rise and attributes the lane that deepened", () => {
    const before = makePortrait(breakdownWith({ wellness: 20 }), 30);
    const after = makePortrait(breakdownWith({ wellness: 60 }), 38);
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.moved).toBe(true);
    expect(r.tone).toBe("rise");
    expect(r.delta).toBe(after.readinessScore - before.readinessScore);
    expect(r.lanesMoved.length).toBeGreaterThan(0);
    expect(r.lanesMoved[0]!.key).toBe("wellness");
    expect(r.lanesMoved[0]!.to).toBeGreaterThan(r.lanesMoved[0]!.from);
    expect(r.nowSee).toBeTruthy();
  });

  it("marks a lane read for the first time when it went from zero", () => {
    const before = makePortrait(emptyBreakdown(), 30);
    const after = makePortrait(breakdownWith({ compass: 70 }), 40);
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "calm_mentor",
      candor: 2,
    });
    expect(r.lanesMoved[0]!.from).toBe(0);
    expect(r.nowSee).toMatch(/finally read/i);
  });

  it("attributes an outcomes rise to what the user logged about real dates", () => {
    const before = makePortrait(emptyBreakdown(), 30);
    const after = makePortrait(breakdownWith({ postDate: 60 }), 40);
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.tone).toBe("rise");
    expect(r.lanesMoved[0]!.key).toBe("postDate");
    expect(r.nowSee).toMatch(/dates actually (go|went)/i);
    expect(r.nowSee).not.toMatch(/post-date notes/i);
  });

  it("does not use the dates copy when another lane moved more than post-date", () => {
    const before = makePortrait(emptyBreakdown(), 30);
    const after = makePortrait(
      breakdownWith({ wellness: 80, postDate: 30 }),
      42,
    );
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.lanesMoved[0]!.key).toBe("wellness");
    expect(r.nowSee).not.toMatch(/dates actually (go|went)/i);
    expect(r.nowSee).toMatch(/finally read/i);
  });

  it("marks the internal evidence threshold without promising matching access", () => {
    const before = makePortrait(breakdownWith({ wellness: 40 }), 45);
    const after = makePortrait(
      breakdownWith({ wellness: 80, compass: 70 }),
      55,
    );
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.tone).toBe("crossing");
    expect(r.crossedThreshold).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.headline).toMatch(
      /profile read|profile review|thoughtful review|proper read/i,
    );
    expect(r.headline).not.toMatch(/matching is open|earned|\b55\b|\b50\b/i);
  });

  it("names a dip honestly without a nowSee", () => {
    const before = makePortrait(breakdownWith({ wellness: 60 }), 40);
    const after = makePortrait(breakdownWith({ wellness: 60 }), 34);
    const r = buildReaction({
      portrait: after,
      previousScore: before.readinessScore,
      previousCoverageByKey: coverageOf(before),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.tone).toBe("dip");
    expect(r.delta).toBeLessThan(0);
    expect(r.nowSee).toBeNull();
    expect(r.headline).toMatch(/less certain|went quiet|fuzzy/i);
  });

  it("treats a flat read with no lane movement as steady and silent", () => {
    const portrait = makePortrait(breakdownWith({ wellness: 50 }), 40);
    const r = buildReaction({
      portrait,
      previousScore: 40,
      previousCoverageByKey: coverageOf(portrait),
      persona: "best_friend",
      candor: 2,
    });
    expect(r.tone).toBe("steady");
    expect(r.moved).toBe(false);
    expect(r.headline).toBe("");
  });

  it("scales the headline by magnitude and stays voice-clean for every persona", () => {
    const personas = [
      "best_friend",
      "tough_coach",
      "witty_sibling",
      "calm_mentor",
    ] as const;
    const deltas = [
      { from: 30, to: 31 },
      { from: 30, to: 34 },
      { from: 30, to: 40 },
    ];
    for (const persona of personas) {
      for (const { from, to } of deltas) {
        const before = makePortrait(breakdownWith({ wellness: 20 }), from);
        const after = makePortrait(breakdownWith({ wellness: 50 }), to);
        const r = buildReaction({
          portrait: after,
          previousScore: before.readinessScore,
          previousCoverageByKey: coverageOf(before),
          persona,
          candor: 2,
        });
        assertVoiceClean(r.headline);
        if (r.nowSee) assertVoiceClean(r.nowSee);
      }
      // Dip and crossing copy must also be clean.
      const dipBefore = makePortrait(breakdownWith({ wellness: 60 }), 42);
      const dipAfter = makePortrait(breakdownWith({ wellness: 60 }), 35);
      assertVoiceClean(
        buildReaction({
          portrait: dipAfter,
          previousScore: dipBefore.readinessScore,
          previousCoverageByKey: coverageOf(dipBefore),
          persona,
          candor: 3,
        }).headline,
      );
    }
  });
});
