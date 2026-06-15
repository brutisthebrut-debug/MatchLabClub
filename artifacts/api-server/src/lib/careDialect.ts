/**
 * Care Dialect — an original-terminology model of how a person gives and receives
 * care. Six dialects across two axes (how you GIVE care, how you RECEIVE care).
 * The terminology is ours; this is not the trademarked five-love-languages
 * framework.
 *
 * This module is the single, deterministic source of truth for scoring a Care
 * Dialect profile. The frontend renders the quiz and reports, per answer, which
 * dialect the chosen option maps to; this module tallies those choices into
 * normalized distributions and a top key per axis, and builds the self-vs-tested
 * comparison. No external calls, no stored raw answers: only the derived
 * distributions and top keys are persisted. The optional Claude narrative is
 * layered on at the route via the existing enhance path and always falls back to
 * the deterministic comparison string built here.
 */

/** Stable enum keys. Never rename; ids feed the contract, DB, and matching. */
export const CARE_DIALECT_KEYS = [
  "spokenWarmth",
  "helpingHands",
  "thoughtfulTokens",
  "undividedTime",
  "closeContact",
  "steadyPresence",
] as const;

export type CareDialectKey = (typeof CARE_DIALECT_KEYS)[number];

/** Human-readable name and short blurb per dialect, voice-compliant copy. */
export const CARE_DIALECTS: Record<
  CareDialectKey,
  { name: string; blurb: string }
> = {
  spokenWarmth: {
    name: "Spoken Warmth",
    blurb:
      "Words that land. Being told what you mean to someone, hearing the appreciation out loud.",
  },
  helpingHands: {
    name: "Helping Hands",
    blurb:
      "Care shown through doing. Someone lightening your load before you have to ask.",
  },
  thoughtfulTokens: {
    name: "Thoughtful Tokens",
    blurb:
      "Small things that prove you were on someone's mind when they were not with you.",
  },
  undividedTime: {
    name: "Undivided Time",
    blurb:
      "Full presence. Real attention with nothing else competing for it.",
  },
  closeContact: {
    name: "Close Contact",
    blurb: "Warmth you can feel. Closeness, a hand, being near.",
  },
  steadyPresence: {
    name: "Steady Presence",
    blurb:
      "Showing up the same way tomorrow. Consistency you can lean on over time.",
  },
};

export function isCareDialectKey(value: unknown): value is CareDialectKey {
  return (
    typeof value === "string" &&
    (CARE_DIALECT_KEYS as readonly string[]).includes(value)
  );
}

/** Distribution over the six dialects, keys always present, values sum to ~1. */
export type CareDialectDistribution = Record<CareDialectKey, number>;

export function emptyDistribution(): CareDialectDistribution {
  return {
    spokenWarmth: 0,
    helpingHands: 0,
    thoughtfulTokens: 0,
    undividedTime: 0,
    closeContact: 0,
    steadyPresence: 0,
  };
}

export interface TestedAxis {
  distribution: CareDialectDistribution;
  top: CareDialectKey;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Tally per-answer dialect choices into a normalized distribution and a top key.
 * The distribution sums to exactly 1 (the rounding remainder is folded into the
 * top key). The top is the argmax by raw count, ties broken by CARE_DIALECT_KEYS
 * order so the result is deterministic. Returns null for an empty answer list.
 */
export function tallyAxis(answers: readonly CareDialectKey[]): TestedAxis | null {
  if (answers.length === 0) return null;

  const counts = emptyDistribution();
  for (const a of answers) counts[a] += 1;

  const total = answers.length;
  const distribution = emptyDistribution();
  for (const k of CARE_DIALECT_KEYS) {
    distribution[k] = round3(counts[k] / total);
  }

  let top: CareDialectKey = CARE_DIALECT_KEYS[0];
  for (const k of CARE_DIALECT_KEYS) {
    if (counts[k] > counts[top]) top = k;
  }

  const sum = CARE_DIALECT_KEYS.reduce((s, k) => s + distribution[k], 0);
  distribution[top] = round3(distribution[top] + (1 - sum));

  return { distribution, top };
}

/** A complete profile has a tested distribution on both axes. */
export interface CareDialectProfileData {
  selfGive: CareDialectKey | null;
  selfReceive: CareDialectKey | null;
  testedGive: TestedAxis | null;
  testedReceive: TestedAxis | null;
}

export type CareDialectAlignment =
  | "aligned"
  | "partial"
  | "surprising"
  | "unknown";

export interface CareDialectComparison {
  /** null when either the self pick or the tested top for that axis is missing. */
  giveMatch: boolean | null;
  receiveMatch: boolean | null;
  alignment: CareDialectAlignment;
  insight: string;
}

function nameOf(key: CareDialectKey | null): string {
  return key ? CARE_DIALECTS[key].name : "";
}

/**
 * Deterministic self-vs-tested comparison. Compares what the user guessed
 * (selfGive / selfReceive) against what the quiz found (tested top per axis) and
 * returns a plain-language insight. Voice rules: no em dashes, no AI-tell words,
 * no emojis. This string is the always-on baseline; the route may replace it
 * with a Claude-enhanced version when the deep AI lane is on, and falls back
 * here when it is not.
 */
export function buildComparison(
  p: CareDialectProfileData,
): CareDialectComparison {
  const giveMatch =
    p.selfGive && p.testedGive ? p.selfGive === p.testedGive.top : null;
  const receiveMatch =
    p.selfReceive && p.testedReceive
      ? p.selfReceive === p.testedReceive.top
      : null;

  if (giveMatch === null && receiveMatch === null) {
    return {
      giveMatch,
      receiveMatch,
      alignment: "unknown",
      insight:
        "Pick what you think your dialect is and take the quiz to see how your read on yourself compares to what your answers reveal.",
    };
  }

  const matches = [giveMatch, receiveMatch].filter((m) => m === true).length;
  const mismatches = [giveMatch, receiveMatch].filter((m) => m === false)
    .length;

  if (mismatches === 0) {
    return {
      giveMatch,
      receiveMatch,
      alignment: "aligned",
      insight:
        "What you guessed about yourself lines up with what your answers reveal. You know your own Care Dialect well, which makes it easier to ask for what you need.",
    };
  }

  if (matches === 0) {
    const giveLine =
      giveMatch === false && p.testedGive
        ? `Your answers point to ${nameOf(p.testedGive.top)} as how you actually give, not ${nameOf(p.selfGive)}.`
        : "";
    const receiveLine =
      receiveMatch === false && p.testedReceive
        ? `And you seem to feel cared for most through ${nameOf(p.testedReceive.top)}, not ${nameOf(p.selfReceive)}.`
        : "";
    return {
      giveMatch,
      receiveMatch,
      alignment: "surprising",
      insight:
        `There is a real gap between how you think you love and how it shows up. ${giveLine} ${receiveLine} That gap is worth sitting with, because the people around you respond to what you actually do.`.replace(
          /\s+/g,
          " ",
        ).trim(),
    };
  }

  const surprisingAxis =
    giveMatch === false && p.testedGive
      ? `your giving leans more toward ${nameOf(p.testedGive.top)} than you expected`
      : receiveMatch === false && p.testedReceive
        ? `you feel cared for most through ${nameOf(p.testedReceive.top)}, more than you expected`
        : "one side surprised you";
  return {
    giveMatch,
    receiveMatch,
    alignment: "partial",
    insight: `You read one side of yourself well, but ${surprisingAxis}. Knowing the difference helps you ask for the right thing instead of the thing you assumed you needed.`,
  };
}
