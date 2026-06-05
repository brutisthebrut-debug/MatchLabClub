/**
 * The Daily Spark deck. One small question a day, each with a short set of
 * options that fit how people actually date. A single honest pick a day is a
 * lighter ask than a quiz, and answered across days it reveals how someone moves
 * through dating over time. Content lives here in the client; the server stores
 * only the question id and the option id chosen, never any free text. Adding a
 * question is a one-line edit here, no migration, since the lane counts distinct
 * question ids answered.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export type SparkDimension =
  | "values"
  | "intent"
  | "communication"
  | "standards"
  | "lifestyle";

export interface SparkOption {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  label: string;
}

export interface SparkQuestion {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  /** Which read this question sharpens, shown as a small tag. */
  dimension: SparkDimension;
  prompt: string;
  options: readonly SparkOption[];
}

export const SPARK_DECK: readonly SparkQuestion[] = [
  {
    id: "ideal-saturday-energy",
    dimension: "lifestyle",
    prompt: "What does your ideal Saturday with someone look like?",
    options: [
      { id: "slow-morning", label: "A slow morning, nowhere to be" },
      { id: "out-and-about", label: "Out exploring something new" },
      { id: "friends-around", label: "People over, good noise" },
      { id: "split-the-day", label: "Some together, some apart" },
    ],
  },
  {
    id: "first-move-style",
    dimension: "communication",
    prompt: "When you are interested in someone, you usually",
    options: [
      { id: "say-it-plain", label: "Say it plainly and early" },
      { id: "show-with-effort", label: "Show it through effort first" },
      { id: "let-it-build", label: "Let it build slowly" },
      { id: "wait-for-signal", label: "Wait for a clear signal back" },
    ],
  },
  {
    id: "what-you-want-now",
    dimension: "intent",
    prompt: "Right now, what are you actually looking for?",
    options: [
      { id: "something-serious", label: "Something serious" },
      { id: "open-to-real", label: "Open, but only if it is real" },
      { id: "see-where-it-goes", label: "See where it goes, no rush" },
      { id: "meeting-people", label: "Meeting people, learning what I want" },
    ],
  },
  {
    id: "conflict-default",
    dimension: "communication",
    prompt: "When something is wrong between you and someone, you tend to",
    options: [
      { id: "talk-it-now", label: "Talk it through right away" },
      { id: "cool-off-first", label: "Cool off, then come back to it" },
      { id: "need-prompting", label: "Wait for them to bring it up" },
      { id: "let-small-go", label: "Let the small stuff go" },
    ],
  },
  {
    id: "non-negotiable",
    dimension: "standards",
    prompt: "The one thing you will not compromise on is",
    options: [
      { id: "honesty", label: "Honesty, even when it is hard" },
      { id: "ambition", label: "Drive and ambition" },
      { id: "kindness", label: "Everyday kindness" },
      { id: "independence", label: "Room to be your own person" },
    ],
  },
  {
    id: "recharge-style",
    dimension: "lifestyle",
    prompt: "After a long week, you recharge by",
    options: [
      { id: "people-time", label: "Being around people you like" },
      { id: "quiet-alone", label: "Quiet time on your own" },
      { id: "one-person", label: "One person, low key" },
      { id: "moving-doing", label: "Moving and doing something" },
    ],
  },
  {
    id: "affection-language",
    dimension: "values",
    prompt: "You feel most cared for when someone",
    options: [
      { id: "says-it", label: "Says how they feel out loud" },
      { id: "small-acts", label: "Does small things for you" },
      { id: "gives-time", label: "Gives you their full attention" },
      { id: "shows-up", label: "Shows up when it counts" },
    ],
  },
  {
    id: "pace-of-trust",
    dimension: "intent",
    prompt: "Trust, for you, is",
    options: [
      { id: "earned-slowly", label: "Earned slowly over time" },
      { id: "given-then-kept", label: "Given early, then protected" },
      { id: "felt-fast", label: "Something you feel fast or not at all" },
      { id: "tested-small", label: "Built through small tests" },
    ],
  },
  {
    id: "growth-vs-comfort",
    dimension: "values",
    prompt: "In a relationship you want someone who mostly",
    options: [
      { id: "pushes-growth", label: "Pushes you to grow" },
      { id: "feels-like-home", label: "Feels like home as you are" },
      { id: "both-balance", label: "Balances both, depending on the day" },
      { id: "steady-calm", label: "Keeps things steady and calm" },
    ],
  },
  {
    id: "social-overlap",
    dimension: "lifestyle",
    prompt: "How much should two lives overlap?",
    options: [
      { id: "fully-shared", label: "Most things, shared" },
      { id: "core-shared", label: "The core, with own corners" },
      { id: "mostly-separate", label: "Close but mostly separate worlds" },
      { id: "depends", label: "Depends on the person" },
    ],
  },
  {
    id: "deal-with-distance",
    dimension: "standards",
    prompt: "If someone pulls away for a few days, you",
    options: [
      { id: "ask-directly", label: "Ask them directly what is up" },
      { id: "give-space", label: "Give space and trust it" },
      { id: "match-energy", label: "Match their energy and step back" },
      { id: "lose-interest", label: "Start to lose interest" },
    ],
  },
  {
    id: "future-picture",
    dimension: "intent",
    prompt: "When you picture a good future, it is mostly about",
    options: [
      { id: "partnership", label: "A real partnership" },
      { id: "freedom", label: "Freedom and adventure" },
      { id: "stability", label: "Stability and roots" },
      { id: "still-figuring", label: "Still figuring it out" },
    ],
  },
];

export const SPARK_DIMENSION_LABEL: Record<SparkDimension, string> = {
  values: "Values",
  intent: "What you want",
  communication: "Communication",
  standards: "Standards",
  lifestyle: "Lifestyle",
};

/** Days since the Unix epoch in local time, used to pick today's question. */
export function dayIndex(d: Date = new Date()): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(local.getTime() / 86400000);
}

/**
 * The next question to show: start at today's rotation slot and walk the deck,
 * returning the first question the user has not answered yet. Returns null once
 * the whole deck is answered.
 */
export function nextQuestion(
  answeredIds: ReadonlySet<string>,
  today: Date = new Date(),
): SparkQuestion | null {
  const start = dayIndex(today) % SPARK_DECK.length;
  for (let i = 0; i < SPARK_DECK.length; i++) {
    const q = SPARK_DECK[(start + i) % SPARK_DECK.length];
    if (!answeredIds.has(q.id)) return q;
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

export function optionLabel(
  question: SparkQuestion,
  optionId: string,
): string | null {
  return question.options.find((o) => o.id === optionId)?.label ?? null;
}
