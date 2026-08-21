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

export function normalizePersona(raw: string | null | undefined): CompanionPersona {
  if (raw && (COMPANION_PERSONAS as string[]).includes(raw)) {
    return raw as CompanionPersona;
  }
  return "best_friend";
}

export function clampCandor(raw: number | null | undefined): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 2;
  return Math.min(3, Math.max(1, n));
}

const PERSONA_LABEL: Record<CompanionPersona, string> = {
  best_friend: "Echo, your honest best friend",
  tough_coach: "Echo, your tough coach",
  witty_sibling: "Echo, your sharp sibling",
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
      return `Alright, let me read you back to you. Right now you are at "${base}".`;
    case "calm_mentor":
      return `Let us take an honest look together. Your model is at "${base}".`;
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
  oneThing: EchoNextMove | null;
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

export interface EchoNextMove {
  label: string;
  detail: string;
  href: string;
  points: number;
}

export interface EchoJourneyState {
  pendingProposal: boolean;
  unreadConnection: { id: string; unreadCount: number } | null;
  overdueCommitment: string | null;
  profileMove: EchoNextMove | null;
}

// Echo owns the one move surfaced across the signed-in experience. Relationship
// activity comes first, followed by promises the member asked Echo to remember,
// then the single profile uncertainty that would improve Echo's understanding.
export function chooseEchoNextMove(input: EchoJourneyState): EchoNextMove {
  if (input.pendingProposal) {
    return {
      label: "Consider your proposal",
      detail:
        "I have a real proposal ready for you. Nothing reveals unless both people choose yes.",
      href: "/matches",
      points: 0,
    };
  }

  if (input.unreadConnection) {
    const count = input.unreadConnection.unreadCount;
    return {
      label: "Return to your conversation",
      detail: `${count} unread ${count === 1 ? "message" : "messages"} in a mutual introduction.`,
      href: `/matches/${input.unreadConnection.id}`,
      points: 0,
    };
  }

  if (input.overdueCommitment) {
    return {
      label: "Keep the promise you made",
      detail: `You asked me to remember that you would ${input.overdueCommitment.replace(/\.$/, "")}. Let us deal with it honestly.`,
      href: "/echo",
      points: 0,
    };
  }

  if (input.profileMove) {
    return { ...input.profileMove, points: 0 };
  }

  return {
    label: "Tell Echo what is happening",
    detail:
      "A short check-in gives me something real to work with instead of making you browse for a task.",
    href: "/echo",
    points: 0,
  };
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
      return `Straight up: I still do not understand your ${spot.label.toLowerCase()}. You keep skipping it, so I am left guessing. Let us stop doing that.`;
    }
    if (candor <= 1) {
      return `One soft nudge: we have never looked at your ${spot.label.toLowerCase()} together. When you are ready, that is the piece that would teach me the most about you.`;
    }
    return `Here is the honest part: I still have a blind spot on your ${spot.label.toLowerCase()}. Until we fill it, I am guessing where I could be sure.`;
  }

  if (!portrait.eligible && portrait.nextSignal) {
    return "I still have a meaningful gap in how I understand you. The next step is small, but it would replace a guess with evidence.";
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
        points: 0,
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
        body:
          "I have a clearer read than the last time I looked. That is real progress, not a number pretending to know you.",
        signalId: null,
      });
    } else if (delta <= -4) {
      out.push({
        kind: "readiness_dip",
        severity: "challenge",
        body:
          "Part of the picture became less certain. Something went quiet, and I would rather name it than pretend I still know.",
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
  if (persona === "tough_coach") {
    if (size === "big")
      return "Good. That gave me a much clearer read. Do not coast on it.";
    if (size === "solid")
      return "That mattered. Keep going while the thread is honest.";
    return "I caught something useful there. Now give me enough context to trust it.";
  }
  if (persona === "witty_sibling") {
    if (size === "big")
      return "Look at you. The picture just got a lot clearer. I am almost impressed.";
    if (size === "solid") return "Not bad at all. I can actually use that.";
    return "I saw it. Give me a little more before I act like I know the whole story.";
  }
  if (persona === "calm_mentor") {
    if (size === "big")
      return "That mattered. The picture of you just came into much clearer focus.";
    if (size === "solid")
      return "That is the kind of steady learning that lasts.";
    return "Small, and still a real step toward understanding the pattern.";
  }
  // best_friend
  if (size === "big")
    return "That changed my read in a real way. The picture of you just sharpened.";
  if (size === "solid")
    return "That helped. I can see you a little better now.";
  const soft =
    candor <= 1
      ? "No pressure. Give me a little more when you are ready."
      : "It is useful, and I still want the fuller story.";
  return soft;
}

function crossingHeadline(persona: CompanionPersona): string {
  switch (persona) {
    case "tough_coach":
      return "I have enough breadth for a real profile review now. That is evidence, not a promise about another person.";
    case "witty_sibling":
      return "Well, well. I finally have enough context to give you a proper read. No, that does not mean I know everything.";
    case "calm_mentor":
      return "The picture has enough breadth for a thoughtful review now. We can still keep learning without rushing certainty.";
    case "best_friend":
    default:
      return "I can give you a real profile read now. That does not promise a match, but it means I can be honest about what I see and what I still do not.";
  }
}

function dipHeadline(
  persona: CompanionPersona,
  candor: number,
): string {
  const word = candorWord(candor);
  switch (persona) {
    case "tough_coach":
      return `Something went quiet. I am telling you ${word} so I do not build advice on stale evidence.`;
    case "witty_sibling":
      return "Something went fuzzy. I noticed. I always notice. Want to sort it out?";
    case "calm_mentor":
      return "Part of the picture became less certain. It happens. Let us look at what changed, no judgment.";
    case "best_friend":
    default:
      return `Heads up, part of my read got less certain. I would rather name it ${word} than fake confidence.`;
  }
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
  if (tone === "crossing") headline = crossingHeadline(persona);
  else if (tone === "dip") headline = dipHeadline(persona, candor);
  else if (tone === "rise") headline = riseHeadline(persona, candor, delta);
  else if (lanesMoved.length > 0) {
    // Score held flat but a lane deepened; still worth a quiet, honest note.
    headline =
      persona === "tough_coach"
        ? "The number held, but you did feed me something. I logged it."
        : "The overall picture held steady, and I still picked up something new about you.";
  } else {
    headline = "";
  }

  const next = portrait.nextSignal;
  const nextMove = next
    ? { label: next.label, detail: next.detail, href: next.href, points: 0 }
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
        "I have enough profile breadth to give you a meaningful review. That does not promise a match, change market availability, or give anyone access to a person.",
      );
    } else {
      lines.push(
        "I still have meaningful gaps in how I understand you. I will show you the clearest next question, but I will not pretend profile work earns access to another person.",
      );
    }
    grounding.push("profile evidence");
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
