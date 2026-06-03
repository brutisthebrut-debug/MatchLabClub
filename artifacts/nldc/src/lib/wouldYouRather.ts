/**
 * The Would You Rather deck. A forced binary tradeoff reveals what a person
 * actually values, faster and more honestly than a stated preference. Content
 * lives here in the client; the server stores only the prompt id and the side
 * chosen, never any free text. Adding a prompt is a one-line edit here, no
 * migration, since the lane counts distinct prompt ids answered.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export type WyrDimension =
  | "values"
  | "intent"
  | "standards"
  | "communication"
  | "lifestyle";

export interface WyrPrompt {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  /** Which read this tradeoff sharpens, shown as a small tag. */
  dimension: WyrDimension;
  a: string;
  b: string;
}

export const WYR_DECK: readonly WyrPrompt[] = [
  {
    id: "reply-fast-surface-vs-slow-deep",
    dimension: "communication",
    a: "Someone who replies fast but keeps it light",
    b: "Someone who replies slowly but goes deep",
  },
  {
    id: "plans-every-date-vs-improvises",
    dimension: "lifestyle",
    a: "A partner who plans every date",
    b: "A partner who improvises every date",
  },
  {
    id: "driven-busy-vs-steady-present",
    dimension: "values",
    a: "Someone driven who is often busy",
    b: "Someone steady who is always around",
  },
  {
    id: "first-date-group-vs-one-on-one",
    dimension: "lifestyle",
    a: "A first date in a lively group",
    b: "A first date one on one",
  },
  {
    id: "hard-truth-kind-vs-gentle-spare",
    dimension: "communication",
    a: "A hard truth told kindly",
    b: "The gentle version that spares you",
  },
  {
    id: "trip-no-plan-vs-slow-home",
    dimension: "lifestyle",
    a: "A weekend trip with no plan",
    b: "A slow weekend at home together",
  },
  {
    id: "saves-future-vs-spends-moment",
    dimension: "values",
    a: "A partner who saves for the future",
    b: "A partner who spends on the moment",
  },
  {
    id: "early-riser-vs-night-owl",
    dimension: "lifestyle",
    a: "Early riser energy",
    b: "Late night energy",
  },
  {
    id: "tells-everything-vs-keeps-space",
    dimension: "intent",
    a: "Tells you everything, every day",
    b: "Keeps some of their world to themselves",
  },
  {
    id: "helps-fix-vs-just-listens",
    dimension: "communication",
    a: "A partner who helps you fix it",
    b: "A partner who just listens",
  },
  {
    id: "love-out-loud-vs-small-acts",
    dimension: "values",
    a: "Affection said out loud often",
    b: "Affection shown in small acts",
  },
  {
    id: "move-for-opportunity-vs-stay-near-people",
    dimension: "values",
    a: "Move cities for a great opportunity",
    b: "Stay near the people you love",
  },
  {
    id: "instant-spark-vs-slow-burn",
    dimension: "intent",
    a: "An instant spark that might fade",
    b: "A slow burn that keeps building",
  },
  {
    id: "packed-social-vs-guards-quiet",
    dimension: "lifestyle",
    a: "A partner with a packed social life",
    b: "A partner who guards quiet nights",
  },
  {
    id: "pushes-you-grow-vs-accepts-you",
    dimension: "standards",
    a: "Someone who pushes you to grow",
    b: "Someone who accepts you as you are",
  },
  {
    id: "talk-through-conflict-vs-cool-off",
    dimension: "communication",
    a: "Talk through every conflict fully",
    b: "Cool off first, then move on quickly",
  },
];

export const WYR_DIMENSION_LABEL: Record<WyrDimension, string> = {
  values: "Values",
  intent: "What you want",
  standards: "Standards",
  communication: "Communication",
  lifestyle: "Lifestyle",
};

/** Days since the Unix epoch in local time, used to pick today's prompt. */
export function dayIndex(d: Date = new Date()): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(local.getTime() / 86400000);
}

/**
 * The next prompt to show: start at today's rotation slot and walk the deck,
 * returning the first prompt the user has not answered yet. Returns null once
 * the whole deck is answered.
 */
export function nextPrompt(
  answeredIds: ReadonlySet<string>,
  today: Date = new Date(),
): WyrPrompt | null {
  const start = dayIndex(today) % WYR_DECK.length;
  for (let i = 0; i < WYR_DECK.length; i++) {
    const prompt = WYR_DECK[(start + i) % WYR_DECK.length];
    if (!answeredIds.has(prompt.id)) return prompt;
  }
  return null;
}

/**
 * Current consecutive-day streak from a set of answer timestamps. Counts back
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
