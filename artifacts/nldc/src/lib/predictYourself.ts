/**
 * The "predict yourself" deck. Each round shows a short set of self-descriptive
 * statements. Before reading them, the player predicts how many will be true of
 * them. The gap between that prediction and the actual count is a deterministic
 * read on self-awareness, more honest than asking someone how self-aware they
 * are. Content lives here in the client; the server stores only the round id,
 * the predicted count, and the actual count, never which statements were marked
 * true. Adding a round is a one-line edit here, no migration, since the lane
 * counts distinct round ids completed.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export interface PredictItem {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  /** The self-awareness facet this round probes, shown as a small tag. */
  theme: string;
  /** The prediction question shown before the statements. */
  predictPrompt: string;
  /** Self-descriptive statements the player marks true or false. */
  statements: readonly string[];
}

export const PREDICT_DECK: readonly PredictItem[] = [
  {
    id: "how-you-text",
    theme: "Communication",
    predictPrompt:
      "Of the next five statements about how you text, how many do you think are true of you?",
    statements: [
      "I usually reply within an hour when I am interested",
      "I reread my messages before sending them",
      "I tend to send several short texts instead of one long one",
      "I go quiet when I am not sure what to say",
      "I use voice notes or photos more than long paragraphs",
    ],
  },
  {
    id: "first-dates",
    theme: "Dating patterns",
    predictPrompt:
      "Of the next five statements about first dates, how many are true of you?",
    statements: [
      "I usually suggest the plan rather than leave it open",
      "I ask more questions than I answer",
      "I decide whether there is a spark in the first ten minutes",
      "I get nervous enough that it shows",
      "I would rather a low-key place than somewhere impressive",
    ],
  },
  {
    id: "in-conflict",
    theme: "Conflict",
    predictPrompt:
      "Of the next five statements about how you handle conflict, how many are true of you?",
    statements: [
      "I bring up what is bothering me fairly quickly",
      "I need to cool off before I can talk it through",
      "I tend to assume the other person is upset with me",
      "I would rather smooth it over than dig into it",
      "I say sorry first even when it was not all my fault",
    ],
  },
  {
    id: "social-energy",
    theme: "Social energy",
    predictPrompt:
      "Of the next five statements about your social energy, how many are true of you?",
    statements: [
      "I feel recharged after a night out with people",
      "I cancel plans more often than I would like to admit",
      "I am usually the one who reaches out first",
      "I need real alone time most days",
      "I open up faster one on one than in a group",
    ],
  },
  {
    id: "what-you-want",
    theme: "What you want",
    predictPrompt:
      "Of the next five statements about what you want, how many are true of you?",
    statements: [
      "I know what I am looking for and could say it in a sentence",
      "I am more drawn to potential than to who someone is right now",
      "I would pick steady over exciting",
      "I have a pattern in who I go for that I want to break",
      "I am ready for something serious right now",
    ],
  },
  {
    id: "follow-through",
    theme: "Follow-through",
    predictPrompt:
      "Of the next five statements about your follow-through, how many are true of you?",
    statements: [
      "When I say I will do something, I almost always do",
      "I keep up habits longer when I can see my progress",
      "I tend to start strong and fade",
      "I show up consistently for people I care about",
      "I finish what I start more often than not",
    ],
  },
];

/** Days since the Unix epoch in local time, used to pick today's round. */
export function dayIndex(d: Date = new Date()): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(local.getTime() / 86400000);
}

/**
 * The next round to show: start at today's rotation slot and walk the deck,
 * returning the first round the user has not completed yet. Returns null once
 * the whole deck is done.
 */
export function nextItem(
  answeredIds: ReadonlySet<string>,
  today: Date = new Date(),
): PredictItem | null {
  const start = dayIndex(today) % PREDICT_DECK.length;
  for (let i = 0; i < PREDICT_DECK.length; i++) {
    const item = PREDICT_DECK[(start + i) % PREDICT_DECK.length];
    if (!answeredIds.has(item.id)) return item;
  }
  return null;
}

/**
 * Current consecutive-day streak from a set of completion timestamps. Counts
 * back from today (or yesterday, so a streak does not break until a full day is
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
 * Average calibration gap across completed rounds: the mean of |predicted -
 * actual|. Lower is sharper self-awareness. Returns null when there is nothing
 * to average, so callers can stay honest and show nothing rather than a fake
 * zero.
 */
export function averageCalibrationGap(
  rounds: readonly { predicted: number; actual: number }[],
): number | null {
  if (rounds.length === 0) return null;
  const total = rounds.reduce(
    (sum, r) => sum + Math.abs(r.predicted - r.actual),
    0,
  );
  return total / rounds.length;
}
