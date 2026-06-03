/**
 * The scenario reels deck. Each card is a realistic relationship moment and a
 * small set of responses. Which response a person reaches for reveals their
 * communication and conflict style more honestly than a stated preference.
 * Content lives here in the client; the server stores only the scenario id and
 * the option id chosen, never any free text. Adding a scenario is a one-line
 * edit here, no migration, since the lane counts distinct scenario ids answered.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export type ScenarioDimension =
  | "communication"
  | "conflict"
  | "repair"
  | "boundaries";

export interface ScenarioOption {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  label: string;
}

export interface Scenario {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  /** Which read this scenario sharpens, shown as a small tag. */
  dimension: ScenarioDimension;
  prompt: string;
  options: readonly ScenarioOption[];
}

export const SCENARIO_DECK: readonly Scenario[] = [
  {
    id: "left-on-read-two-days",
    dimension: "communication",
    prompt:
      "Someone you have been talking to leaves you on read for two days, then replies like nothing happened.",
    options: [
      { id: "name-it", label: "Name it directly and say the gap felt off" },
      { id: "match-energy", label: "Match their energy and let it slide" },
      { id: "pull-back", label: "Quietly pull back and protect yourself" },
    ],
  },
  {
    id: "plans-canceled-last-minute",
    dimension: "repair",
    prompt:
      "Your date cancels an hour before, for the second time, with a vague reason.",
    options: [
      { id: "ask-whats-up", label: "Ask honestly if something deeper is going on" },
      { id: "reschedule-once", label: "Offer one reschedule, then read the pattern" },
      { id: "let-go", label: "Take the hint and stop initiating" },
    ],
  },
  {
    id: "disagree-in-public",
    dimension: "conflict",
    prompt:
      "You strongly disagree with your partner about something in front of friends.",
    options: [
      { id: "table-it", label: "Table it and talk privately later" },
      { id: "light-pushback", label: "Push back lightly in the moment, kindly" },
      { id: "say-it-now", label: "Say what you think now, respectfully" },
    ],
  },
  {
    id: "they-vent-no-fix",
    dimension: "communication",
    prompt:
      "Your partner had a brutal day and is venting. They have not asked for advice.",
    options: [
      { id: "just-listen", label: "Just listen and stay with the feeling" },
      { id: "ask-what-need", label: "Ask whether they want help or just to be heard" },
      { id: "offer-fix", label: "Offer a way to fix the problem" },
    ],
  },
  {
    id: "crossed-a-line",
    dimension: "repair",
    prompt:
      "You said something in an argument that landed harder than you meant.",
    options: [
      { id: "own-it-now", label: "Own it right away and apologize specifically" },
      { id: "cool-then-return", label: "Cool off first, then come back to repair" },
      { id: "wait-for-them", label: "Wait to see if they bring it up" },
    ],
  },
  {
    id: "needs-more-space",
    dimension: "boundaries",
    prompt:
      "You need more alone time than the person you are seeing seems to want.",
    options: [
      { id: "state-the-need", label: "State the need plainly and propose a rhythm" },
      { id: "ease-in", label: "Ease into it gradually so it lands softer" },
      { id: "absorb-it", label: "Absorb it for now and hope it balances out" },
    ],
  },
  {
    id: "they-pull-away",
    dimension: "conflict",
    prompt:
      "Mid-disagreement, the other person goes quiet and shuts down.",
    options: [
      { id: "give-space", label: "Give them space and revisit when calm" },
      { id: "gently-check", label: "Gently check what they are feeling right now" },
      { id: "keep-talking", label: "Keep talking it through until it resolves" },
    ],
  },
  {
    id: "old-flame-texts",
    dimension: "boundaries",
    prompt:
      "An ex texts you something friendly while you are seeing someone new.",
    options: [
      { id: "tell-partner", label: "Mention it to the person you are seeing" },
      { id: "reply-keep-clear", label: "Reply briefly and keep the line clear" },
      { id: "leave-it", label: "Leave it unanswered and move on" },
    ],
  },
  {
    id: "feelings-moving-faster",
    dimension: "communication",
    prompt:
      "You are catching feelings faster than the other person seems to be.",
    options: [
      { id: "say-where-im-at", label: "Say where you are at and ask where they are" },
      { id: "let-it-unfold", label: "Let it unfold and watch their actions" },
      { id: "hold-back", label: "Hold back to protect yourself" },
    ],
  },
  {
    id: "small-thing-keeps-bugging",
    dimension: "conflict",
    prompt:
      "A small habit of theirs keeps quietly bothering you.",
    options: [
      { id: "bring-up-early", label: "Bring it up early before it builds" },
      { id: "wait-pattern", label: "Wait to see if it is a real pattern first" },
      { id: "let-go", label: "Decide it is minor and let it go" },
    ],
  },
];

export const SCENARIO_DIMENSION_LABEL: Record<ScenarioDimension, string> = {
  communication: "Communication",
  conflict: "Conflict style",
  repair: "Repair",
  boundaries: "Boundaries",
};

/** Days since the Unix epoch in local time, used to pick today's scenario. */
export function dayIndex(d: Date = new Date()): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(local.getTime() / 86400000);
}

/**
 * The next scenario to show: start at today's rotation slot and walk the deck,
 * returning the first scenario the user has not responded to yet. Returns null
 * once the whole deck is answered.
 */
export function nextScenario(
  answeredIds: ReadonlySet<string>,
  today: Date = new Date(),
): Scenario | null {
  const start = dayIndex(today) % SCENARIO_DECK.length;
  for (let i = 0; i < SCENARIO_DECK.length; i++) {
    const scenario = SCENARIO_DECK[(start + i) % SCENARIO_DECK.length];
    if (!answeredIds.has(scenario.id)) return scenario;
  }
  return null;
}

/**
 * Current consecutive-day streak from a set of response timestamps. Counts back
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
