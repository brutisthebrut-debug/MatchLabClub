// ───────────────────────────────────────────────────────────────────────────
// Echo: the deterministic companion engine. This is the always-on baseline that
// gives Echo a voice, a read on the person, honest challenges, and the ability
// to review a message, with no external calls and no rate limits. The hybrid
// service (companionService.ts) layers Claude on top for warmth when the account
// has opted into the deep AI lane; everything here works when it has not.
//
// Echo reasons ONLY from derived signal coverage (the Mirror portrait) plus the
// notes and commitments it has already stored. It never invents facts and never
// reads raw user content here.
// ───────────────────────────────────────────────────────────────────────────

import type { MirrorPortrait } from "./aiEngine";

export type CompanionPersona =
  | "best_friend"
  | "tough_coach"
  | "witty_sibling"
  | "calm_mentor";

export const COMPANION_PERSONAS: CompanionPersona[] = [
  "best_friend",
  "tough_coach",
  "witty_sibling",
  "calm_mentor",
];

export const DEFAULT_COMPANION_PERSONA: CompanionPersona = "witty_sibling";

export function normalizePersona(raw: string | null | undefined): CompanionPersona {
  if (raw && (COMPANION_PERSONAS as string[]).includes(raw)) {
    return raw as CompanionPersona;
  }
  return DEFAULT_COMPANION_PERSONA;
}

export function clampCandor(raw: number | null | undefined): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 2;
  return Math.min(3, Math.max(1, n));
}

const PERSONA_LABEL: Record<CompanionPersona, string> = {
  best_friend: "Echo, your honest best friend",
  tough_coach: "Echo, your tough coach",
  witty_sibling: "Echo, the sibling who tells you the truth",
  calm_mentor: "Echo, your calm mentor",
};

export function personaLabel(persona: CompanionPersona): string {
  return PERSONA_LABEL[persona];
}

// A one-line description of how Echo should sound, fed to the deep-AI lane and
// reused to shape deterministic phrasing.
const PERSONA_VOICE: Record<CompanionPersona, string> = {
  best_friend:
    "warm and in their corner, but tells the truth even when it stings",
  tough_coach: "direct, leads with the hard thing, praise is earned not given",
  witty_sibling: "teasing and loyal, sharp, names patterns without flinching",
  calm_mentor: "steady and reflective, challenges gently but does not let go",
};

export function personaVoice(persona: CompanionPersona): string {
  return PERSONA_VOICE[persona];
}

function candorWord(candor: number): string {
  if (candor >= 3) return "bluntly";
  if (candor <= 1) return "gently";
  return "honestly";
}

function greetingFor(persona: CompanionPersona, stageLabel: string): string {
  const base = stageLabel.toLowerCase();
  switch (persona) {
    case "tough_coach":
      return `Here is where you actually stand. Your picture is at "${base}". No spin.`;
    case "witty_sibling":
      return `Okay, I have a read. You are at "${base}". I know enough to be useful and not enough to get cocky.`;
    case "calm_mentor":
      return `Let us take an honest look together. I know you at "${base}" right now.`;
    case "best_friend":
    default:
      return `Hey, it is me. Here is the real read on you right now: "${base}".`;
  }
}

export interface CompanionView {
  persona: CompanionPersona;
  candor: number;
  headline: string;
  greeting: string;
  read: string;
  oneThing: { label: string; detail: string; href: string; points: number } | null;
  challenge: string | null;
  readinessScore: number;
  threshold: number;
  eligible: boolean;
}

export interface CompanionViewInput {
  portrait: MirrorPortrait;
  persona: CompanionPersona;
  candor: number;
  openCommitments?: { body: string; overdue: boolean }[];
}

// The single highest-leverage, honest challenge Echo can make from the portrait.
// It is allowed to be uncomfortable: that is the whole point of not being a yes
// person. Candor tunes how softly it lands, never whether the truth is told.
function buildChallenge(input: CompanionViewInput): string | null {
  const { portrait, candor, openCommitments } = input;
  const word = candorWord(candor);

  const overdue = (openCommitments ?? []).find((c) => c.overdue);
  if (overdue) {
    return `You told me you would ${overdue.body.replace(/\.$/, "")}, and it has not happened. I am going to keep ${word} reminding you, because you asked me to hold you to it.`;
  }

  // A blind spot the person keeps avoiding is the most honest thing to name.
  if (portrait.blindSpots.length > 0) {
    const spot = portrait.blindSpots[0];
    if (candor >= 3) {
      return `Straight up: I still cannot see your ${spot.label.toLowerCase()}. You keep skipping it. That is the gap holding your matches back, not bad luck.`;
    }
    if (candor <= 1) {
      return `One soft nudge: we have never looked at your ${spot.label.toLowerCase()} together. When you are ready, that is the piece that would teach me the most about you.`;
    }
    return `Here is the honest part: I still have a blind spot on your ${spot.label.toLowerCase()}. Until we fill it, I am guessing where I could be sure.`;
  }

  if (!portrait.eligible && portrait.nextSignal) {
    return `You are ${Math.max(0, portrait.threshold - portrait.readinessScore)} points from matching and I know exactly what would move it. Do not tell me you are too busy, this one is small.`;
  }

  return null;
}

export function buildCompanionView(input: CompanionViewInput): CompanionView {
  const { portrait, persona, candor } = input;
  const next = portrait.nextSignal;

  const read = portrait.headline;
  const oneThing = next
    ? {
        label: next.label,
        detail: next.detail,
        href: next.href,
        points: next.points,
      }
    : null;

  return {
    persona,
    candor,
    headline: portrait.headline,
    greeting: greetingFor(persona, portrait.stageLabel),
    read,
    oneThing,
    challenge: buildChallenge(input),
    readinessScore: portrait.readinessScore,
    threshold: portrait.threshold,
    eligible: portrait.eligible,
  };
}

// ── Observations ────────────────────────────────────────────────────────────
// Echo's own notes about the person, derived from how their coverage moved. We
// store derived language only, never raw content.

export type ObservationSeverity = "praise" | "note" | "challenge";

export interface DerivedObservation {
  kind: string;
  severity: ObservationSeverity;
  body: string;
  signalId: string | null;
}

export interface DeriveObservationsInput {
  portrait: MirrorPortrait;
  previousScore: number | null;
  previousCoverageByKey?: Record<string, number> | null;
}

export function deriveObservations(
  input: DeriveObservationsInput,
): DerivedObservation[] {
  const { portrait, previousScore, previousCoverageByKey } = input;
  const out: DerivedObservation[] = [];

  if (previousScore !== null) {
    const delta = portrait.readinessScore - previousScore;
    if (delta >= 4) {
      out.push({
        kind: "readiness_rise",
        severity: "praise",
        body: `Your readiness climbed ${delta} points since I last looked. That is real momentum, not noise.`,
        signalId: null,
      });
    } else if (delta <= -4) {
      out.push({
        kind: "readiness_dip",
        severity: "challenge",
        body: `Your readiness slipped ${Math.abs(delta)} points. Something went quiet. I would rather name it than pretend it did not happen.`,
        signalId: null,
      });
    }
  }

  // A lane that jumped in coverage is worth a genuine note.
  if (previousCoverageByKey) {
    for (const dim of portrait.known) {
      const prev = previousCoverageByKey[dim.key];
      if (typeof prev === "number" && dim.coverage - prev >= 20) {
        out.push({
          kind: "lane_growth",
          severity: "praise",
          body: `You fed your ${dim.label.toLowerCase()} a lot lately. I can see you much more clearly there now.`,
          signalId: dim.key,
        });
      }
    }
  }

  // The most persistent blind spot, named once.
  if (portrait.blindSpots.length > 0) {
    const spot = portrait.blindSpots[0];
    out.push({
      kind: "blind_spot",
      severity: "challenge",
      body: `I still have no read on your ${spot.label.toLowerCase()}. ${spot.why}`,
      signalId: spot.key,
    });
  }

  return out;
}

// ── In-the-moment reaction ───────────────────────────────────────────────────
// The instant a user's readiness moves, Echo reacts: it names the change, what
// it can now see that it could not before, and the single next move. This is the
// deterministic baseline; companionService.echoReact reshapes the voice when the
// account has opted into the deep AI lane. It reasons only from the portrait and
// the prior per-lane coverage, never raw content.

export type ReactionTone = "rise" | "crossing" | "dip" | "steady";

export interface ReactionLaneMove {
  key: string;
  label: string;
  from: number;
  to: number;
}

export interface ReadinessReaction {
  // True when there is a real movement worth surfacing. False on the first ever
  // look (no prior baseline) and on a flat read, so Echo never fakes a reaction.
  moved: boolean;
  tone: ReactionTone;
  delta: number;
  fromScore: number;
  toScore: number;
  threshold: number;
  eligible: boolean;
  crossedThreshold: boolean;
  headline: string;
  nowSee: string | null;
  lanesMoved: ReactionLaneMove[];
  nextMove: { label: string; detail: string; href: string; points: number } | null;
}

export interface BuildReactionInput {
  portrait: MirrorPortrait;
  previousScore: number | null;
  previousCoverageByKey: Record<string, number> | null;
  persona: CompanionPersona;
  candor: number;
}

type RiseSize = "small" | "solid" | "big";

function riseSize(delta: number): RiseSize {
  if (delta >= 6) return "big";
  if (delta >= 3) return "solid";
  return "small";
}

function riseHeadline(
  persona: CompanionPersona,
  candor: number,
  delta: number,
): string {
  const size = riseSize(delta);
  const plus = `plus ${delta}`;
  if (persona === "tough_coach") {
    if (size === "big")
      return `Good. ${capitalize(plus)}. That is what real work looks like. Do not coast on it.`;
    if (size === "solid")
      return `${capitalize(plus)}. Earned, not handed to you. Keep going.`;
    return `${capitalize(plus)}. It counts, but I want a bigger one from you next.`;
  }
  if (persona === "witty_sibling") {
    if (size === "big") return `Look at you. ${capitalize(plus)} in one move. I am almost impressed.`;
    if (size === "solid") return `${capitalize(plus)}. Not bad at all, honestly.`;
    return `${capitalize(plus)}. I saw it. Barely, but I saw it.`;
  }
  if (persona === "calm_mentor") {
    if (size === "big")
      return `That mattered. ${capitalize(plus)}, and the picture of you just came into clearer focus.`;
    if (size === "solid") return `${capitalize(plus)}. The kind of steady progress that lasts.`;
    return `${capitalize(plus)}. Small, and still a real step toward who you are becoming.`;
  }
  // best_friend
  if (size === "big") return `That was a real jump. ${capitalize(plus)}, and I felt the picture of you sharpen.`;
  if (size === "solid") return `${capitalize(plus)}. That nudged you up and I can see you a little better now.`;
  const soft = candor <= 1 ? " No pressure, just keep stacking these." : " Keep stacking these.";
  return `${capitalize(plus)}, small but it counts.${soft}`;
}

function crossingHeadline(
  persona: CompanionPersona,
  toScore: number,
  threshold: number,
): string {
  switch (persona) {
    case "tough_coach":
      return `There it is. ${toScore}, past ${threshold}. Matching is open. Now the real work starts.`;
    case "witty_sibling":
      return `Well, well. ${toScore}. You crossed it. Matching is open, try to act surprised.`;
    case "calm_mentor":
      return `You reached it. ${toScore}, past the line. Matching is open. Take a breath, then keep building.`;
    case "best_friend":
    default:
      return `You did it. Readiness ${toScore}, past ${threshold}. Matching is open now, and I have been waiting to tell you.`;
  }
}

function dipHeadline(
  persona: CompanionPersona,
  candor: number,
  drop: number,
): string {
  const word = candorWord(candor);
  switch (persona) {
    case "tough_coach":
      return `Down ${drop}. Something went quiet. I am telling you ${word} so it does not become a trend.`;
    case "witty_sibling":
      return `Minus ${drop}. I noticed. I always notice. Want to fix it?`;
    case "calm_mentor":
      return `You slipped ${drop}. It happens. Let us look at what went quiet, no judgment.`;
    case "best_friend":
    default:
      return `Heads up, you slipped ${drop}. I would rather name it ${word} than let it slide. Want to climb back?`;
  }
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function reactionNowSee(
  tone: ReactionTone,
  lanesMoved: ReactionLaneMove[],
): string | null {
  if (tone === "dip" || tone === "steady") return null;
  const top = lanesMoved[0];
  if (!top) {
    return tone === "crossing"
      ? "I can see enough of you now to start finding people who actually fit."
      : "The picture of you just got a little sharper.";
  }
  const lane = top.label.toLowerCase();
  // Post-date notes are the outcome lane that feeds the learning loop. When that
  // is what moved, name it for what it is: the person telling Echo how real
  // dates actually went, not just another signal getting a little clearer.
  if (top.key === "postDate") {
    return top.from <= 0
      ? "Now that you have started telling me how your dates actually go, I can read what fits you in person, not just on paper."
      : "Because you told me how those dates actually went, I can read what fits you in person a little better than I could a moment ago.";
  }
  if (top.from <= 0) {
    return `Because of that, I can finally read your ${lane} instead of guessing at it.`;
  }
  return `I can see your ${lane} more clearly now than I could a moment ago.`;
}

/**
 * The deterministic in-the-moment reaction. Pure and total. `moved` is false on
 * the first look (no baseline) and on a flat read, so Echo only ever reacts to a
 * real change.
 */
export function buildReaction(input: BuildReactionInput): ReadinessReaction {
  const { portrait, previousScore, previousCoverageByKey, persona, candor } = input;
  const toScore = portrait.readinessScore;
  const threshold = portrait.threshold;
  const eligible = portrait.eligible;

  // No prior baseline means this is the first look; establish it silently.
  if (previousScore === null) {
    return {
      moved: false,
      tone: "steady",
      delta: 0,
      fromScore: toScore,
      toScore,
      threshold,
      eligible,
      crossedThreshold: false,
      headline: "",
      nowSee: null,
      lanesMoved: [],
      nextMove: null,
    };
  }

  const fromScore = previousScore;
  const delta = toScore - fromScore;

  const lanesMoved: ReactionLaneMove[] = previousCoverageByKey
    ? portrait.known
        .map((dim) => {
          const prev = previousCoverageByKey[dim.key] ?? 0;
          return { key: dim.key, label: dim.label, from: prev, to: dim.coverage };
        })
        .filter((m) => m.to - m.from >= 1)
        .sort((a, b) => b.to - b.from - (a.to - a.from))
        .slice(0, 3)
    : [];

  const crossedThreshold = fromScore < threshold && toScore >= threshold;

  let tone: ReactionTone;
  if (crossedThreshold) tone = "crossing";
  else if (delta >= 1) tone = "rise";
  else if (delta <= -1) tone = "dip";
  else tone = "steady";

  const moved = tone !== "steady" || lanesMoved.length > 0;

  let headline: string;
  if (tone === "crossing") headline = crossingHeadline(persona, toScore, threshold);
  else if (tone === "dip") headline = dipHeadline(persona, candor, Math.abs(delta));
  else if (tone === "rise") headline = riseHeadline(persona, candor, delta);
  else if (lanesMoved.length > 0) {
    // Score held flat but a lane deepened; still worth a quiet, honest note.
    headline =
      persona === "tough_coach"
        ? "The number held, but you did feed me something. I logged it."
        : "Your score held steady, and I still picked up something new about you.";
  } else {
    headline = "";
  }

  const next = portrait.nextSignal;
  const nextMove = next
    ? { label: next.label, detail: next.detail, href: next.href, points: next.points }
    : null;

  return {
    moved,
    tone,
    delta,
    fromScore,
    toScore,
    threshold,
    eligible,
    crossedThreshold,
    headline,
    nowSee: moved ? reactionNowSee(tone, lanesMoved) : null,
    lanesMoved,
    nextMove,
  };
}

// ── Commitments ─────────────────────────────────────────────────────────────
// Lightweight detection of "I will ..." style commitments in something the user
// typed to Echo, so it can follow up. This is intentionally conservative: it
// only fires on clear first-person future intent.

const COMMITMENT_PATTERNS = [
  /\bi(?:'| a)?ll\s+(.+)/i,
  /\bi am going to\s+(.+)/i,
  /\bi'm going to\s+(.+)/i,
  /\bi will\s+(.+)/i,
  /\bi promise to\s+(.+)/i,
  /\bi plan to\s+(.+)/i,
];

export function detectCommitment(userText: string): string | null {
  const text = userText.trim();
  if (text.length < 6) return null;
  // Only look at the first sentence-ish chunk so we do not capture a paragraph.
  const firstChunk = text.split(/[.!?\n]/)[0]?.trim() ?? text;
  for (const re of COMMITMENT_PATTERNS) {
    const m = firstChunk.match(re);
    if (m && m[1]) {
      const body = m[1].trim().replace(/[.!,;:]+$/, "");
      if (body.length >= 3 && body.length <= 160) {
        return body.charAt(0).toLowerCase() + body.slice(1);
      }
    }
  }
  return null;
}

// ── Deterministic chat answer ────────────────────────────────────────────────

export interface CompanionAnswer {
  answer: string;
  grounding: string[];
  detectedCommitment: string | null;
}

export function answerCompanion(
  view: CompanionView,
  question: string,
): CompanionAnswer {
  const q = question.toLowerCase();
  const grounding: string[] = [];
  const lines: string[] = [];

  const detectedCommitment = detectCommitment(question);

  const asksWhereStand =
    /(where|how).*(stand|doing|at)|ready|progress|score|readiness/.test(q);
  const asksWhatNext = /(what|next|should i|do now|improve|better|move)/.test(q);
  const asksAboutMe = /(who am i|about me|see in me|know about me|read on me)/.test(q);

  if (asksAboutMe || (!asksWhereStand && !asksWhatNext)) {
    lines.push(view.read);
    grounding.push("readiness portrait");
  }

  if (asksWhereStand) {
    if (view.eligible) {
      lines.push(
        `You are past the line. Readiness is ${view.readinessScore} and matching opens at ${view.threshold}. You earned it.`,
      );
    } else {
      lines.push(
        `You are at ${view.readinessScore} out of ${view.threshold}. ${Math.max(0, view.threshold - view.readinessScore)} points to go before I can start matching you.`,
      );
    }
    grounding.push("readiness score");
  }

  if (asksWhatNext && view.oneThing) {
    lines.push(
      `The one thing I would do next: ${view.oneThing.label.toLowerCase()}. ${view.oneThing.detail}`,
    );
    grounding.push("next best signal");
  }

  if (view.challenge) {
    lines.push(view.challenge);
    grounding.push("honest challenge");
  }

  if (detectedCommitment) {
    lines.push(
      `And I heard that: you said you would ${detectedCommitment}. I am writing it down and I will check in on it.`,
    );
  }

  if (lines.length === 0) {
    lines.push(view.read);
    grounding.push("readiness portrait");
  }

  return {
    answer: lines.join(" "),
    grounding,
    detectedCommitment,
  };
}

// ── Message review ───────────────────────────────────────────────────────────
// The user explicitly shares a message they are sending or received and asks
// Echo to react. Deterministic baseline gives an honest, structured read. The
// user's own content is consent-gated at the service layer before any LLM sees
// it; this function works on the text in the moment and stores nothing.

export type MessageDirection = "sending" | "received";

export interface MessageReview {
  verdict: string;
  strengths: string[];
  risks: string[];
  suggestion: string;
}

export function reviewMessage(
  text: string,
  direction: MessageDirection,
  persona: CompanionPersona,
  candor: number,
): MessageReview {
  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const strengths: string[] = [];
  const risks: string[] = [];

  const hasQuestion = /\?/.test(trimmed);
  const exclaimCount = (trimmed.match(/!/g) ?? []).length;
  const lower = trimmed.toLowerCase();
  const lowEffort = /^(hey|hi|hello|sup|yo|wyd|hbu|nm u)[.!? ]*$/i.test(trimmed);
  const allCaps =
    trimmed.length > 12 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const apologyOpen = /^(sorry|sry|apolog)/i.test(trimmed);

  if (direction === "sending") {
    if (hasQuestion) {
      strengths.push("You asked a question, which gives them a real reason to reply.");
    } else {
      risks.push("There is no question here, so the burden to keep it going falls on them.");
    }
    if (lowEffort) {
      risks.push("This reads as low effort. It tells them almost nothing about you.");
    }
    if (wordCount > 90) {
      risks.push("It is long. Early on, a wall of text can feel like pressure.");
    } else if (wordCount >= 8 && wordCount <= 60) {
      strengths.push("The length is in a good range, enough to land, not so much it overwhelms.");
    }
    if (exclaimCount >= 3) {
      risks.push("The exclamation marks are doing a lot of work. Let the words carry it.");
    }
    if (allCaps) {
      risks.push("All caps reads as shouting. Drop it to normal case.");
    }
    if (apologyOpen) {
      risks.push("Opening with an apology puts you on the back foot before you have said anything.");
    }
  } else {
    if (hasQuestion) {
      strengths.push("They asked you something, which means there is interest and an easy opening.");
    } else {
      risks.push("They did not ask anything, so you will have to create the next thread yourself.");
    }
    if (lowEffort) {
      risks.push("Their message is thin. Match a little above their effort, not below it.");
    }
  }

  const verdictWord = candor >= 3 ? "Straight read" : candor <= 1 ? "Soft read" : "Honest read";
  let verdict: string;
  if (risks.length === 0) {
    verdict = `${verdictWord}: this is solid. I would send it close to as-is.`;
  } else if (risks.length >= strengths.length) {
    verdict =
      candor >= 3
        ? `${verdictWord}: I would not send this yet. It needs work.`
        : `${verdictWord}: there is something to build on, but I would tweak it first.`;
  } else {
    verdict = `${verdictWord}: good bones, a couple of fixable things.`;
  }

  let suggestion: string;
  if (direction === "sending") {
    suggestion = hasQuestion
      ? "Keep the question, cut anything that is just throat-clearing, and send it."
      : "Add one specific question that ties to something they said. That is the whole difference.";
  } else {
    suggestion =
      "Reply to the most interesting thing they said, then add one detail of your own and a light question back.";
  }

  // Persona only colors the framing, never the substance of the read.
  if (persona === "witty_sibling" && risks.length > 0) {
    verdict += " I say this with love.";
  }

  return {
    verdict,
    strengths,
    risks,
    suggestion,
  };
}
