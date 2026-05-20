import { test } from "vitest";
import assert from "node:assert/strict";
import { generateAuditReport } from "./aiEngine.ts";

const baseParams = {
  firstName: "Jordan",
  bio: "I love to travel, big on authenticity, looking for my person. I work in design and care about the people around me. Coffee in the morning, books at night, and a good question over dinner.",
  prompts: "The way to win me over is...\nI'm looking for...\nA green flag I look for...",
  datingGoal: "find a relationship",
  currentApps: ["Hinge"],
  biggestChallenge: "not getting matches",
  recentMessageSample: null,
};

function findPlatformFit(
  guidance: ReturnType<typeof generateAuditReport>["photoGuidance"],
) {
  return guidance.find((g) => g.category.endsWith("platform fit"));
}

test("generateAuditReport: Hinge branches use Hinge-specific copy and include the user's first name", () => {
  const out = generateAuditReport({ ...baseParams, sourceApp: "Hinge" });

  assert.match(out.bioAudit, /Jordan/);
  assert.doesNotMatch(out.bioAudit, /your match/);
  assert.doesNotMatch(out.bioAudit, /\bMatch\b/);
  assert.match(
    out.bioAudit,
    /Hinge specifically|prompts do most of the heavy lifting/,
  );

  const hingePromptTip = out.rewrittenPrompts.find((p) =>
    /Hinge weights prompts heavily/.test(p.tip),
  );
  assert.ok(hingePromptTip, "expected at least one Hinge-specific prompt tip");

  const fit = findPlatformFit(out.photoGuidance);
  assert.ok(fit, "Hinge platform fit photo guidance should be present");
  assert.equal(fit!.category, "Hinge platform fit");
  assert.match(fit!.advice, /Hinge surfaces individual photos/);
});

test("generateAuditReport: Bumble branches use Bumble-specific copy and include the user's first name", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: "Bumble",
    currentApps: ["Bumble"],
  });

  assert.match(out.bioAudit, /Jordan/);
  assert.doesNotMatch(out.bioAudit, /your match/);
  assert.match(out.bioAudit, /Bumble readers skim bios fast/);

  const bumblePromptTip = out.rewrittenPrompts.find((p) =>
    /On Bumble, prompts/.test(p.tip),
  );
  assert.ok(bumblePromptTip, "expected at least one Bumble-specific prompt tip");

  const fit = findPlatformFit(out.photoGuidance);
  assert.ok(fit, "Bumble platform fit photo guidance should be present");
  assert.equal(fit!.category, "Bumble platform fit");
  assert.match(fit!.advice, /Bumble shows the lead photo/);
});

test("generateAuditReport: Tinder branches use Tinder-specific copy and include the user's first name", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: "Tinder",
    currentApps: ["Tinder"],
  });

  assert.match(out.bioAudit, /Jordan/);
  assert.doesNotMatch(out.bioAudit, /your match/);
  assert.match(out.bioAudit, /Tinder bios are read in the half-second/);

  const tinderPromptTip = out.rewrittenPrompts.find((p) =>
    /Tinder doesn't have prompts the way Hinge does/.test(p.tip),
  );
  assert.ok(tinderPromptTip, "expected at least one Tinder-specific prompt tip");

  const fit = findPlatformFit(out.photoGuidance);
  assert.ok(fit, "Tinder platform fit photo guidance should be present");
  assert.equal(fit!.category, "Tinder platform fit");
  assert.match(fit!.advice, /Tinder is photo-first/);
});

test("generateAuditReport: case-insensitive sourceApp still matches Hinge branch", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: "  hinge  ",
    currentApps: [],
  });

  const fit = findPlatformFit(out.photoGuidance);
  assert.ok(fit, "lowercased 'hinge' should still resolve to Hinge platform fit");
  assert.equal(fit!.category, "Hinge platform fit");
  assert.match(out.bioAudit, /Hinge specifically/);
});

test("generateAuditReport: unknown sourceApp omits app-specific photo guidance and flavor", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: "OkCupid",
    currentApps: ["OkCupid"],
  });

  assert.match(out.bioAudit, /Jordan/);
  assert.doesNotMatch(out.bioAudit, /Hinge specifically/);
  assert.doesNotMatch(out.bioAudit, /Bumble readers skim/);
  assert.doesNotMatch(out.bioAudit, /Tinder bios are read/);

  const fit = findPlatformFit(out.photoGuidance);
  assert.equal(fit, undefined, "unknown app should not add a platform fit item");

  for (const item of out.photoGuidance) {
    assert.doesNotMatch(item.category, /^(Hinge|Bumble|Tinder) platform fit$/);
  }
});

test("generateAuditReport: null sourceApp with no known currentApps omits platform fit guidance", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: null,
    currentApps: [],
  });

  assert.match(out.bioAudit, /Jordan/);
  const fit = findPlatformFit(out.photoGuidance);
  assert.equal(fit, undefined);

  const genericPromptTip = out.rewrittenPrompts.find((p) =>
    /Specificity beats sincerity/.test(p.tip),
  );
  assert.ok(genericPromptTip, "expected the generic prompt tip when no app is known");
});

test("generateAuditReport: falls back to 'your match' when no first name is provided", () => {
  const out = generateAuditReport({
    ...baseParams,
    firstName: "   ",
    sourceApp: "Hinge",
  });

  assert.match(out.bioAudit, /your match/);
  assert.doesNotMatch(out.bioAudit, /Jordan/);
});

test("generateAuditReport: null sourceApp still resolves to known app via currentApps[0]", () => {
  const out = generateAuditReport({
    ...baseParams,
    sourceApp: null,
    currentApps: ["Bumble"],
  });

  const fit = findPlatformFit(out.photoGuidance);
  assert.ok(fit, "expected platform fit derived from currentApps[0]");
  assert.equal(fit!.category, "Bumble platform fit");
  assert.match(out.bioAudit, /Bumble readers skim/);
});

import { generateEmailInsightAnalysis } from "./aiEngine.ts";

const insightBase = {
  pastedContent:
    "Hey - thanks for the long reply. I think I overthink things sometimes. I feel like we could keep talking. haha sorry for the wall of text.",
  sourceLabel: "exported chat",
};

const SOURCE_EXPECTATIONS: Record<
  "Hinge" | "Bumble" | "Tinder" | "iMessage" | "Email",
  { growth: RegExp; profile: RegExp; summary: RegExp }
> = {
  Hinge: {
    growth: /Hinge, tie at least one reply back to whatever prompt/,
    profile: /Your Hinge prompts are doing most of the matchmaking/,
    summary: /Tuned to Hinge conventions/,
  },
  Bumble: {
    growth: /On Bumble, when she opens, your reply within the first few hours/,
    profile: /On Bumble, the lead photo and first bio line/,
    summary: /Tuned to Bumble dynamics/,
  },
  Tinder: {
    growth: /On Tinder, set a soft deadline/,
    profile: /On Tinder, a two-line bio with one specific hook/,
    summary: /Tuned to Tinder pacing/,
  },
  iMessage: {
    growth: /Once you're texting, stop performing/,
    profile: /Since you're getting numbers, your profile is converting/,
    summary: /Calibrated for iMessage/,
  },
  Email: {
    growth: /Email rewards brevity even more than apps/,
    profile: /If conversations are moving to email/,
    summary: /Calibrated for email/,
  },
};

for (const [source, expected] of Object.entries(SOURCE_EXPECTATIONS)) {
  test(`generateEmailInsightAnalysis: ${source} produces source-specific growth, profile tip, and summary addendum`, () => {
    const out = generateEmailInsightAnalysis({
      ...insightBase,
      sourceApp: source,
    });

    assert.equal(out.sourceApp, source);
    assert.ok(
      out.growthAreas.some((g) => expected.growth.test(g)),
      `expected ${source}-specific growth area`,
    );
    assert.ok(
      out.datingProfileTips.some((p) => expected.profile.test(p)),
      `expected ${source}-specific profile tip`,
    );
    assert.match(out.summary, expected.summary);
  });
}

test("generateEmailInsightAnalysis: explicit sourceApp wins over a mismatched sourceLabel", () => {
  const out = generateEmailInsightAnalysis({
    pastedContent: "totally unrelated content with no app names",
    sourceLabel: "Bumble export",
    sourceApp: "Hinge",
  });

  assert.equal(out.sourceApp, "Hinge");
  assert.match(out.summary, /Tuned to Hinge conventions/);
  assert.doesNotMatch(out.summary, /Tuned to Bumble/);
});

test("generateEmailInsightAnalysis: sourceLabel wins when sourceApp is missing, even if pasted content names another app", () => {
  const out = generateEmailInsightAnalysis({
    pastedContent: "we matched on tinder and chatted for a while",
    sourceLabel: "Bumble export",
    sourceApp: null,
  });

  assert.equal(out.sourceApp, "Bumble");
  assert.match(out.summary, /Tuned to Bumble dynamics/);
});

test("generateEmailInsightAnalysis: falls back to detecting the source from pasted content when neither sourceApp nor sourceLabel match", () => {
  const out = generateEmailInsightAnalysis({
    pastedContent: "we matched on tinder and then moved off the app",
    sourceLabel: "exported chat",
    sourceApp: null,
  });

  assert.equal(out.sourceApp, "Tinder");
  assert.match(out.summary, /Tuned to Tinder pacing/);
});

test("generateEmailInsightAnalysis: unknown source returns a valid analysis with sourceApp null and no addendum", () => {
  const out = generateEmailInsightAnalysis({
    pastedContent: "just generic chatter about weekend plans and coffee",
    sourceLabel: "untitled clipboard paste",
    sourceApp: null,
  });

  assert.equal(out.sourceApp, null);
  assert.ok(out.communicationPatterns.length >= 4);
  assert.ok(out.growthAreas.length >= 3);
  assert.ok(out.datingProfileTips.length >= 3);
  assert.ok(out.summary.length > 0);
  for (const expected of Object.values(SOURCE_EXPECTATIONS)) {
    assert.doesNotMatch(out.summary, expected.summary);
  }
});
