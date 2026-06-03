// ───────────────────────────────────────────────────────────────────────────
// Echo: the hybrid service layer. The deterministic companionEngine is always
// the baseline; this module layers Anthropic Claude on top for warmth, behind
// the same contract as every other deep-AI tool: account-level content consent,
// the daily cap, and a voice guard. Anything short of a clean, schema-valid,
// voice-clean result keeps the deterministic answer, so Echo never breaks and
// never drifts off voice.
//
// For the conversational reply Echo only ever sees aggregate, derived portrait
// lines (no raw content or PII), the same posture as the Mirror. For message
// review the user has explicitly handed Echo a single message to react to, so
// that text is the input and is consent-gated before any model sees it; nothing
// is stored.
// ───────────────────────────────────────────────────────────────────────────

import { generate } from "./aiService";
import { logger } from "./logger";
import type { MirrorPortrait } from "./aiEngine";
import {
  type CompanionView,
  type CompanionAnswer,
  type MessageReview,
  type MessageDirection,
  type CompanionPersona,
  type ReadinessReaction,
  personaVoice,
  personaLabel,
} from "./companionEngine";

const BANNED_TERMS = [
  "dive in",
  "unleash",
  "elevate",
  "leverage",
  "seamless",
  "unlock",
  "transformative",
  "game-changer",
  "game changer",
  "cutting-edge",
  "in today's world",
];

/**
 * Reject any deep-AI output that breaks our voice rules: em/en dash, emoji, or a
 * banned AI-tell term. We never trust generated copy, even though Claude is told
 * the rules.
 */
export function isVoiceClean(text: string): boolean {
  if (/[\u2014\u2013]/.test(text)) return false;
  if (
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u.test(
      text,
    )
  ) {
    return false;
  }
  const lower = text.toLowerCase();
  return !BANNED_TERMS.some((t) => lower.includes(t));
}

function candorInstruction(candor: number): string {
  if (candor >= 3) return "Be blunt. Lead with the hard truth. Praise only when earned.";
  if (candor <= 1) return "Be gentle, but still honest. Soften the delivery, never the truth.";
  return "Be honest and direct. Challenge by default. Never just agree to be liked.";
}

export interface EchoReplyResult {
  answer: string;
  followUp: string;
  grounding: string[];
  isFallback: boolean;
}

/**
 * Conversational reply. Deterministic answer is the baseline; Claude reshapes it
 * in the chosen persona voice using only the derived portrait lines.
 */
export async function echoReply(args: {
  userId: string;
  question: string;
  view: CompanionView;
  deterministic: CompanionAnswer;
  portrait: MirrorPortrait;
  persona: CompanionPersona;
  candor: number;
  recentSummary: string | null;
  openCommitments: string[];
}): Promise<EchoReplyResult> {
  const {
    userId,
    question,
    view,
    deterministic,
    portrait,
    persona,
    candor,
    recentSummary,
    openCommitments,
  } = args;

  let answer = deterministic.answer;
  let followUp = "";
  const grounding = deterministic.grounding;
  let isFallback = true;

  const knownLines = portrait.known
    .map((k) => `- ${k.label} (${k.coverage}% covered): ${k.insight}`)
    .join("\n");
  const blindLines = portrait.blindSpots
    .map((b) => `- ${b.label}: ${b.why}`)
    .join("\n");
  const nextLine = portrait.nextSignal
    ? `${portrait.nextSignal.label} (about ${portrait.nextSignal.points} points): ${portrait.nextSignal.detail}`
    : "none, the picture is fairly complete";

  const system = [
    `You are ${personaLabel(persona)} inside MatchLab Club. You are one persistent`,
    "companion who travels with this user across the whole product. You are their",
    `friend, not an assistant. Your voice is ${personaVoice(persona)}.`,
    candorInstruction(candor),
    "You never invent facts. You reason only from the derived lines below, which",
    "are aggregate signal coverage, never the user's raw content. If something is",
    "not covered, say plainly you cannot see it yet and point at the signal that",
    "would fill the gap. Keep it to 2 to 5 sentences. Talk like a real person who",
    "knows them, not a report.",
    "",
    `Readiness: ${portrait.readinessScore} out of 100 (matching opens at ${portrait.threshold}; ${portrait.eligible ? "eligible now" : "not yet eligible"}).`,
    `Stage: ${portrait.stageLabel}.`,
    `Headline read: ${portrait.headline}`,
    recentSummary ? `What you have learned about them so far: ${recentSummary}` : "",
    openCommitments.length
      ? `Open commitments they made to you:\n${openCommitments.map((c) => `- ${c}`).join("\n")}`
      : "No open commitments on record.",
    "",
    knownLines ? `What you can see:\n${knownLines}` : "You cannot see anything yet; they have fed nothing.",
    "",
    blindLines ? `Blind spots:\n${blindLines}` : "No notable blind spots.",
    "",
    `Single best next signal for them to feed: ${nextLine}`,
    view.challenge ? `An honest challenge worth making: ${view.challenge}` : "",
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "answer": "your reply, grounded only in the lines above",',
    '  "followUp": "one short question they could ask you next" }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge',",
    "'dive in', 'unleash', or 'in today's world'. No emojis. Vary sentence length.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: question,
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: { toolName: "Echo" },
        maxTokens: 600,
      },
      "",
    );
    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = JSON.parse(aiResult.output) as {
        answer?: string;
        followUp?: string;
      };
      const candidate = ai.answer?.trim();
      if (candidate && isVoiceClean(candidate)) {
        answer = candidate;
        followUp = (ai.followUp ?? "").trim();
        if (followUp && !isVoiceClean(followUp)) followUp = "";
        isFallback = false;
      } else if (candidate) {
        logger.info("echo reply failed voice check; using deterministic baseline");
      }
    } else if (aiResult.fallbackReason) {
      logger.info(
        { fallbackReason: aiResult.fallbackReason },
        "echo reply fell back to deterministic baseline",
      );
    }
  } catch (err) {
    answer = deterministic.answer;
    followUp = "";
    isFallback = true;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "echo deep-AI lane threw; using deterministic baseline",
    );
  }

  return { answer, followUp, grounding, isFallback };
}

export interface EchoReviewResult extends MessageReview {
  isFallback: boolean;
}

/**
 * Message review. The user explicitly shares a message; the deterministic review
 * is the baseline. Claude adds a sharper, persona-voiced read only when consent
 * is on. The message itself is consent-gated by `requireContentConsent` before
 * any model sees it, and nothing is stored.
 */
export async function echoReviewMessage(args: {
  userId: string;
  text: string;
  direction: MessageDirection;
  deterministic: MessageReview;
  persona: CompanionPersona;
  candor: number;
}): Promise<EchoReviewResult> {
  const { userId, text, direction, deterministic, persona, candor } = args;

  let result: MessageReview = deterministic;
  let isFallback = true;

  const system = [
    `You are ${personaLabel(persona)} inside MatchLab Club, reacting to one`,
    `message the user is ${direction === "sending" ? "about to send" : "just received"}.`,
    `Your voice is ${personaVoice(persona)}.`,
    candorInstruction(candor),
    "Give an honest read. You are their friend, so tell them the truth even if it",
    "is not what they want to hear. Be specific to this message, not generic.",
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "verdict": "one or two sentence overall take",',
    '  "strengths": ["short specific points, may be empty"],',
    '  "risks": ["short specific points, may be empty"],',
    '  "suggestion": "one concrete next step" }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge',",
    "'dive in', 'unleash', or 'in today's world'. No emojis.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: text,
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: { toolName: "Echo Review" },
        maxTokens: 600,
      },
      "",
    );
    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = JSON.parse(aiResult.output) as Partial<MessageReview>;
      const verdict = ai.verdict?.trim();
      const suggestion = ai.suggestion?.trim();
      const strengths = (ai.strengths ?? []).map((s) => s.trim()).filter(Boolean);
      const risks = (ai.risks ?? []).map((s) => s.trim()).filter(Boolean);
      const allClean =
        !!verdict &&
        !!suggestion &&
        isVoiceClean(verdict) &&
        isVoiceClean(suggestion) &&
        strengths.every(isVoiceClean) &&
        risks.every(isVoiceClean);
      if (allClean) {
        result = { verdict, strengths, risks, suggestion };
        isFallback = false;
      } else if (verdict) {
        logger.info("echo review failed voice check; using deterministic baseline");
      }
    } else if (aiResult.fallbackReason) {
      logger.info(
        { fallbackReason: aiResult.fallbackReason },
        "echo review fell back to deterministic baseline",
      );
    }
  } catch (err) {
    result = deterministic;
    isFallback = true;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "echo review deep-AI lane threw; using deterministic baseline",
    );
  }

  return { ...result, isFallback };
}

export interface EchoReactResult {
  reaction: ReadinessReaction;
  isFallback: boolean;
}

/**
 * In-the-moment reaction enrichment. The deterministic `buildReaction` already
 * decided the tone, the magnitude, which lanes moved, and the next move; this
 * only reshapes the two voiced strings (headline + nowSee) in the user's persona
 * voice when the deep AI lane is on. Claude sees only derived numbers and lane
 * labels, never raw content. Anything short of a clean, voice-clean result keeps
 * the deterministic copy, so the reaction never breaks or drifts off voice.
 */
export async function echoReact(args: {
  userId: string;
  deterministic: ReadinessReaction;
  persona: CompanionPersona;
  candor: number;
}): Promise<EchoReactResult> {
  const { userId, deterministic, persona, candor } = args;

  // Nothing to voice for a non-event; never spend a Claude call on silence.
  if (!deterministic.moved || !deterministic.headline) {
    return { reaction: deterministic, isFallback: true };
  }

  let reaction = deterministic;
  let isFallback = true;

  const toneNote =
    deterministic.tone === "crossing"
      ? "They just crossed the line into matching. This is the payoff moment, own it without being saccharine."
      : deterministic.tone === "dip"
        ? "Their readiness slipped. Name it honestly and kindly, do not scold, point at a way back."
        : "Their readiness rose. React in proportion to the size, do not oversell a small move.";

  const laneLines = deterministic.lanesMoved
    .map((l) => `- ${l.label}: ${l.from} to ${l.to} (out of 100)`)
    .join("\n");

  const facts = [
    `Readiness moved from ${deterministic.fromScore} to ${deterministic.toScore} (delta ${deterministic.delta}).`,
    `Matching threshold is ${deterministic.threshold}. Eligible for matching now: ${deterministic.eligible ? "yes" : "no"}.`,
    deterministic.lanesMoved.length
      ? `Lanes that deepened (these are derived coverage scores, not raw content):\n${laneLines}`
      : "No single lane stood out; the overall picture shifted.",
    `Deterministic headline to improve on: ${deterministic.headline}`,
    deterministic.nowSee ? `Deterministic "what I can now see": ${deterministic.nowSee}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    `You are ${personaLabel(persona)} inside MatchLab Club, reacting in real time`,
    "the instant the user's Match Readiness score changed.",
    `Your voice is ${personaVoice(persona)}.`,
    candorInstruction(candor),
    toneNote,
    "You are perceptive and specific, never a generic cheerleader. Two short",
    "sentences at most for the headline. Ground what you can now see in the lane",
    "that actually moved. Speak only to what these numbers show; invent nothing.",
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "headline": "one or two sentence in-the-moment reaction",',
    '  "nowSee": "one sentence on what you can now see more clearly, may be empty" }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge',",
    "'dive in', 'unleash', or 'in today's world'. No emojis.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: facts,
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: { toolName: "Echo Pulse" },
        maxTokens: 300,
      },
      "",
    );
    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = JSON.parse(aiResult.output) as {
        headline?: string;
        nowSee?: string;
      };
      const headline = ai.headline?.trim();
      const nowSee = ai.nowSee?.trim() ?? "";
      const cleanHeadline = !!headline && isVoiceClean(headline);
      const cleanNowSee = !nowSee || isVoiceClean(nowSee);
      if (cleanHeadline && cleanNowSee) {
        reaction = {
          ...deterministic,
          headline,
          nowSee: nowSee || deterministic.nowSee,
        };
        isFallback = false;
      } else if (headline) {
        logger.info("echo pulse failed voice check; using deterministic baseline");
      }
    } else if (aiResult.fallbackReason) {
      logger.info(
        { fallbackReason: aiResult.fallbackReason },
        "echo pulse fell back to deterministic baseline",
      );
    }
  } catch (err) {
    reaction = deterministic;
    isFallback = true;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "echo pulse deep-AI lane threw; using deterministic baseline",
    );
  }

  return { reaction, isFallback };
}
