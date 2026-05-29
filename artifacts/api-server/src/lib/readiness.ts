/**
 * Pure, DB-free readiness helpers shared by the matching route and its tests.
 *
 * Readiness is intentionally a quality-aware blend of six first-party signals.
 * The route does the counting against the database; everything in this file is
 * deterministic math + copy so it can be unit-tested without a connection.
 */

export interface ReadinessBreakdown {
  compass: number;
  journal: number;
  wellness: number;
  hingeImport: number;
  postDate: number;
  wins: number;
}

export interface SignalCounts {
  /** Compatibility compass reads. */
  compass: number;
  /** Journal entries with a substantive body (lazy one-liners excluded). */
  journal: number;
  /** Distinct wellness dimensions answered (out of 18). */
  wellnessDistinct: number;
  /** GDPR imported sources tagged "hinge". */
  hingeImport: number;
  /** Post-date notes the user actually reflected on (outcome or reflection). */
  postDateReflected: number;
  /** Logged dating wins. */
  wins: number;
}

export interface OutcomeCounts {
  anotherDate: number;
  noMore: number;
  ghosted: number;
  unsure: number;
}

export interface OutcomeInsight extends OutcomeCounts {
  totalDates: number;
  headline: string;
}

export interface ReadinessNextAction {
  key: string;
  label: string;
  detail: string;
  points: number;
  href: string;
}

// Per-signal denominators: how many units count as "fully covered" for each.
const DENOM = {
  compass: 5,
  journal: 10,
  wellness: 18,
  postDate: 3,
  wins: 5,
} as const;

// Weights sum to 100. Wellness and compass carry the most because they are the
// richest, most structured signals; wins is the lightest because it is the
// easiest to log.
const WEIGHTS = {
  compass: 0.2,
  journal: 0.14,
  wellness: 0.22,
  hingeImport: 0.16,
  postDate: 0.16,
  wins: 0.12,
} as const;

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

export function computeBreakdown(counts: SignalCounts): ReadinessBreakdown {
  return {
    compass: pct(counts.compass, DENOM.compass),
    journal: pct(counts.journal, DENOM.journal),
    wellness: pct(counts.wellnessDistinct, DENOM.wellness),
    hingeImport: counts.hingeImport > 0 ? 100 : 0,
    postDate: pct(counts.postDateReflected, DENOM.postDate),
    wins: pct(counts.wins, DENOM.wins),
  };
}

export function scoreFromBreakdown(breakdown: ReadinessBreakdown): number {
  return Math.round(
    breakdown.compass * WEIGHTS.compass +
      breakdown.journal * WEIGHTS.journal +
      breakdown.wellness * WEIGHTS.wellness +
      breakdown.hingeImport * WEIGHTS.hingeImport +
      breakdown.postDate * WEIGHTS.postDate +
      breakdown.wins * WEIGHTS.wins,
  );
}

export function computeOutcomeInsight(counts: OutcomeCounts): OutcomeInsight {
  const totalDates =
    counts.anotherDate + counts.noMore + counts.ghosted + counts.unsure;
  let headline: string;
  if (totalDates === 0) {
    headline =
      "No date outcomes logged yet. Add a post-date note and the engine starts learning what actually fits you.";
  } else if (counts.anotherDate >= Math.max(1, Math.ceil(totalDates / 2))) {
    headline = `Strong run: ${counts.anotherDate} of ${totalDates} recent dates led to a second one. We will lean into what is working.`;
  } else if (counts.ghosted + counts.noMore >= Math.ceil(totalDates / 2)) {
    headline = `Most recent dates fizzled. That is signal too. We will use it to sharpen who we put in front of you.`;
  } else {
    headline = `A mixed run across ${totalDates} dates. Keep logging outcomes and the pattern gets clearer.`;
  }
  return {
    totalDates,
    anotherDate: counts.anotherDate,
    noMore: counts.noMore,
    ghosted: counts.ghosted,
    unsure: counts.unsure,
    headline,
  };
}

interface ActionMeta {
  key: keyof ReadinessBreakdown;
  label: string;
  detail: string;
  href: string;
  /** Approx readiness points one more unit of this signal adds. */
  step: number;
}

const ACTION_META: ActionMeta[] = [
  {
    key: "hingeImport",
    label: "Import your Hinge data",
    detail: "One export fills a whole signal lane at once.",
    href: "/imports",
    step: Math.round(100 * WEIGHTS.hingeImport),
  },
  {
    key: "postDate",
    label: "Add a post-date note",
    detail: "Reflect on a recent date. Outcomes teach the engine what fits you.",
    href: "/mirror/dates",
    step: Math.round((100 / DENOM.postDate) * WEIGHTS.postDate),
  },
  {
    key: "compass",
    label: "Run a compass read",
    detail: "Score someone you are already talking to. Each read adds real signal.",
    href: "/compatibility-compass",
    step: Math.round((100 / DENOM.compass) * WEIGHTS.compass),
  },
  {
    key: "wins",
    label: "Log a dating win",
    detail: "Small moments of courage count as signal now, not just a private note.",
    href: "/progress/wins",
    step: Math.round((100 / DENOM.wins) * WEIGHTS.wins),
  },
  {
    key: "wellness",
    label: "Answer a few wellness prompts",
    detail: "Cover more of the 18 dimensions so your profile reads fuller.",
    href: "/wellness",
    step: Math.max(1, Math.round((100 / DENOM.wellness) * WEIGHTS.wellness)),
  },
  {
    key: "journal",
    label: "Write a journal entry",
    detail: "A real reflection counts. One-liners do not.",
    href: "/mirror/journal",
    step: Math.max(1, Math.round((100 / DENOM.journal) * WEIGHTS.journal)),
  },
];

/**
 * Ranked "do this next" steps. Returns the highest-leverage incomplete signals
 * first, capped at `limit`. Empty when the user is already eligible.
 */
export function computeNextActions(
  breakdown: ReadinessBreakdown,
  eligible: boolean,
  limit = 3,
): ReadinessNextAction[] {
  if (eligible) return [];
  return ACTION_META.filter((m) => breakdown[m.key] < 100)
    .sort((a, b) => b.step - a.step)
    .slice(0, limit)
    .map((m) => ({
      key: m.key,
      label: m.label,
      detail: m.detail,
      points: Math.max(1, m.step),
      href: m.href,
    }));
}
