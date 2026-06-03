/**
 * The "time capsule" deck. Each prompt invites the user to write one short line
 * toward the partner they have not met yet. Naming what you want, in your own
 * words, is a low-friction read on intent and values, and returning to read
 * past notes is its own emotional payoff. The note bodies are the user's own
 * content, stored only so they can replay them; the matching signal is just the
 * count, and only derived themes (never the raw line) would ever leave the app.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export interface CapsulePrompt {
  /** Stable id, used to rotate prompts. */
  id: string;
  /** The invitation shown above the note field. */
  text: string;
  /** Short placeholder to lower the blank-page barrier. */
  placeholder: string;
}

export const CAPSULE_PROMPTS: readonly CapsulePrompt[] = [
  {
    id: "first-ordinary-day",
    text: "Write one line about an ordinary day you want to share with them.",
    placeholder: "Slow mornings, coffee, no rush to be anywhere",
  },
  {
    id: "what-im-becoming",
    text: "Tell your future partner who you are becoming while you wait.",
    placeholder: "Someone calmer, more honest about what I need",
  },
  {
    id: "what-i-hope-for-us",
    text: "Name one thing you hope is true about the two of you.",
    placeholder: "That we can disagree and still feel close",
  },
  {
    id: "what-i-bring",
    text: "Write one line about what you want to bring to them.",
    placeholder: "Steadiness, and someone who actually listens",
  },
  {
    id: "a-small-promise",
    text: "Make one small promise to the person you have not met yet.",
    placeholder: "I will keep showing up, even when it is hard",
  },
];

/** Days since the Unix epoch in local time, used to rotate the prompt. */
export function dayIndex(d: Date = new Date()): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(local.getTime() / 86400000);
}

/** Today's prompt, rotated by the local day so it changes day to day. */
export function todayPrompt(today: Date = new Date()): CapsulePrompt {
  return CAPSULE_PROMPTS[dayIndex(today) % CAPSULE_PROMPTS.length];
}

/**
 * Current consecutive-day streak from a set of note timestamps. Counts back
 * from today (or yesterday, so a streak does not break until a full day is
 * missed). Local-date based.
 */
export function computeDayStreak(timestamps: readonly string[]): number {
  if (timestamps.length === 0) return 0;
  const days = new Set<number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) days.add(dayIndex(d));
  }
  const today = dayIndex();
  let cursor = days.has(today) ? today : today - 1;
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

/**
 * Lightweight, on-device theme tags derived from a note for honest "what this
 * says about you" chips. This is the only kind of derived read we would ever
 * share; the raw note never leaves the user's own view. Keyword based, so it is
 * deterministic, explainable, and never makes a claim the words do not support.
 */
const THEME_RULES: readonly { theme: string; terms: readonly string[] }[] = [
  {
    theme: "Steadiness",
    terms: ["steady", "calm", "consistent", "reliable", "showing up", "show up"],
  },
  {
    theme: "Honesty",
    terms: ["honest", "truth", "real", "open", "vulnerable"],
  },
  {
    theme: "Closeness",
    terms: ["close", "warm", "together", "us", "we", "hold", "listen"],
  },
  {
    theme: "Growth",
    terms: ["becoming", "grow", "better", "learn", "change", "heal"],
  },
  {
    theme: "Everyday life",
    terms: ["morning", "coffee", "ordinary", "slow", "home", "walk", "cook"],
  },
  {
    theme: "Commitment",
    terms: ["promise", "always", "stay", "forever", "commit", "keep"],
  },
];

export function deriveThemes(body: string): string[] {
  const lower = body.toLowerCase();
  const found: string[] = [];
  for (const rule of THEME_RULES) {
    if (rule.terms.some((t) => lower.includes(t))) found.push(rule.theme);
  }
  return found.slice(0, 3);
}
