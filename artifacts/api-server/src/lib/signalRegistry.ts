/**
 * The living signal registry.
 *
 * Every readiness/matching signal the product knows about is described here
 * once, as data, instead of being hand-wired into readiness math, the matching
 * prompt, and the UI separately. Adding a new signal source (a connector, a
 * quiz, an import) means adding one entry to SIGNAL_REGISTRY: its weight,
 * normalization, the wellness dimensions it informs, a plain-English line for
 * the matching prompt, and its "do this next" action copy. Readiness, the
 * matching prompt, and the next-action list all read from this one place, so a
 * new signal flows everywhere at once and the algorithm incorporates it without
 * a rewrite.
 *
 * This module is pure and DB-free so it can be unit-tested without a
 * connection. The route does the counting against the database; everything here
 * is deterministic math and copy.
 */

/** Per-signal readiness coverage, 0-100, keyed by contributor id. */
export interface ReadinessBreakdown {
  compass: number;
  journal: number;
  wellness: number;
  hingeImport: number;
  postDate: number;
  wins: number;
}

/** Raw counts pulled from the database for each contributor. */
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

/**
 * How a raw count converts to 0-100 coverage. "count" reaches full coverage at
 * `denominator` units; "binary" is all-or-nothing (any presence is full).
 */
export type SignalNormalizer =
  | { kind: "count"; denominator: number }
  | { kind: "binary" };

export interface SignalContributor {
  /** Stable key, also the key used in ReadinessBreakdown. */
  id: keyof ReadinessBreakdown;
  /** Which field of SignalCounts holds this contributor's raw count. */
  countKey: keyof SignalCounts;
  /** Human label. */
  label: string;
  /**
   * Wellness dimensions this signal informs. The wellness center is the spine:
   * every signal maps onto these so the machine reasons in one shared space.
   */
  dimensions: string[];
  /**
   * Default relative weight. Weights are auto-normalized across the registry,
   * so adding or removing a contributor never breaks the sum-to-one invariant
   * and you never have to re-balance the others by hand.
   */
  weight: number;
  /** Rough confidence (0-1) in this signal's predictive value for matching. */
  confidence: number;
  /** How the raw count becomes coverage. */
  normalize: SignalNormalizer;
  /**
   * Optional freshness half-life in days. Reserved for time-aware scoring; not
   * applied to the day-one deterministic readiness number.
   */
  decayHalfLifeDays?: number;
  /** Plain-English line for the matching prompt, given current coverage. */
  describe: (coverage: number) => string;
  /** UI "do this next" copy. */
  action: { label: string; detail: string; href: string };
}

/**
 * The registry. Order is spine-first (wellness leads). Default weights sum to
 * 1.0 so today's readiness number is reproduced exactly; normalization keeps
 * that true as the registry grows.
 */
export const SIGNAL_REGISTRY: readonly SignalContributor[] = [
  {
    id: "wellness",
    countKey: "wellnessDistinct",
    label: "Wellness dimensions",
    dimensions: ["all 18 wellness dimensions"],
    weight: 0.22,
    confidence: 0.9,
    normalize: { kind: "count", denominator: 18 },
    describe: (c) =>
      `Has mapped ${c}% of their wellness profile across the 18 dimensions, so their values and needs read fuller than a bio.`,
    action: {
      label: "Answer a few wellness prompts",
      detail: "Cover more of the 18 dimensions so your profile reads fuller.",
      href: "/wellness",
    },
  },
  {
    id: "compass",
    countKey: "compass",
    label: "Compass reads",
    dimensions: ["compatibility instincts", "what they are drawn to"],
    weight: 0.2,
    confidence: 0.8,
    normalize: { kind: "count", denominator: 5 },
    describe: (c) =>
      `Has run enough compatibility reads to cover ${c}% of that lane, so we have real signal on who they lean toward.`,
    action: {
      label: "Run a compass read",
      detail:
        "Score someone you are already talking to. Each read adds real signal.",
      href: "/compatibility-compass",
    },
  },
  {
    id: "hingeImport",
    countKey: "hingeImport",
    label: "Hinge import",
    dimensions: ["real-world dating behavior", "texting style"],
    weight: 0.16,
    confidence: 0.7,
    normalize: { kind: "binary" },
    describe: () =>
      `Imported their Hinge history, so we can see how they actually talk and behave on a dating app, not just how they describe themselves.`,
    action: {
      label: "Import your Hinge data",
      detail: "One export fills a whole signal lane at once.",
      href: "/imports",
    },
  },
  {
    id: "postDate",
    countKey: "postDateReflected",
    label: "Post-date notes",
    dimensions: ["what actually fits in person", "date outcomes"],
    weight: 0.16,
    confidence: 0.85,
    normalize: { kind: "count", denominator: 3 },
    describe: (c) =>
      `Has reflected on enough real dates to cover ${c}% of that lane, so we know what fits them in person, not just on paper.`,
    action: {
      label: "Add a post-date note",
      detail:
        "Reflect on a recent date. Outcomes teach the engine what fits you.",
      href: "/mirror/dates",
    },
  },
  {
    id: "journal",
    countKey: "journal",
    label: "Journal entries",
    dimensions: ["self-awareness", "how they process feelings"],
    weight: 0.14,
    confidence: 0.6,
    normalize: { kind: "count", denominator: 10 },
    describe: (c) =>
      `Has journaled enough to cover ${c}% of that lane, so we have a read on their self-awareness and how they process things.`,
    action: {
      label: "Write a journal entry",
      detail: "A real reflection counts. One-liners do not.",
      href: "/mirror/journal",
    },
  },
  {
    id: "wins",
    countKey: "wins",
    label: "Dating wins",
    dimensions: ["courage", "momentum"],
    weight: 0.12,
    confidence: 0.5,
    normalize: { kind: "count", denominator: 5 },
    describe: (c) =>
      `Has logged enough wins to cover ${c}% of that lane, a read on their momentum and willingness to put themselves out there.`,
    action: {
      label: "Log a dating win",
      detail:
        "Small moments of courage count as signal now, not just a private note.",
      href: "/progress/wins",
    },
  },
] as const;

/** Coverage 0-100 for one contributor given its raw count. */
export function coverageFor(
  contributor: SignalContributor,
  count: number,
): number {
  if (contributor.normalize.kind === "binary") return count > 0 ? 100 : 0;
  const denom = contributor.normalize.denominator;
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((count / denom) * 100));
}

/**
 * Default weights, normalized to sum to 1.0. With the shipped registry these
 * already sum to 1.0, so this is an identity; it exists so that adding a
 * contributor never forces a manual re-balance of every other weight.
 */
export function normalizedWeights(
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): Record<string, number> {
  const total = registry.reduce((sum, c) => sum + c.weight, 0);
  const out: Record<string, number> = {};
  for (const c of registry) {
    out[c.id] = total > 0 ? c.weight / total : 0;
  }
  return out;
}

/**
 * Approximate readiness points one more unit of a contributor adds, used to
 * rank "do this next" actions.
 */
export function contributorStep(
  contributor: SignalContributor,
  weights: Record<string, number> = normalizedWeights(),
): number {
  const w = weights[contributor.id] ?? 0;
  if (contributor.normalize.kind === "binary") {
    return Math.max(1, Math.round(100 * w));
  }
  const denom = contributor.normalize.denominator;
  if (denom <= 0) return 1;
  return Math.max(1, Math.round((100 / denom) * w));
}

/**
 * Plain-English lines describing what the machine already knows about a user,
 * assembled from the registry for every signal with non-zero coverage. The
 * matching prompt is built from this, so a newly registered signal shows up in
 * the AI's reasoning automatically, with no prompt rewrite.
 */
export function describeActiveSignals(
  breakdown: ReadinessBreakdown,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): string[] {
  const lines: string[] = [];
  for (const c of registry) {
    const coverage = breakdown[c.id] ?? 0;
    if (coverage > 0) lines.push(c.describe(coverage));
  }
  return lines;
}

/** Minimal outcome shape used to nudge weights; structurally OutcomeCounts. */
export interface OutcomeSignal {
  anotherDate: number;
  noMore: number;
  ghosted: number;
  unsure: number;
}

export interface WeightAdjustment {
  id: string;
  label: string;
  defaultWeight: number;
  adjustedWeight: number;
  reason: string;
}

/**
 * The "breathing" layer. Given a user's recent date outcomes, propose a bounded
 * re-weighting of the signals around their registry defaults: when dates keep
 * fizzling, lean harder on the signals that capture in-person fit and instinct
 * (post-date notes, compass); when dates are landing, leave the defaults alone.
 *
 * This is deterministic, bounded (no signal moves more than ADJUST_CAP of its
 * default), and re-normalized to sum to 1.0. It is intentionally NOT wired into
 * the live readiness score, so day-one behavior is unchanged. It exists so the
 * algorithm can be tuned by real outcomes once we choose to act on it, and so
 * the founder can see how a user's signals would re-weight.
 */
const ADJUST_CAP = 0.25;

export function proposeWeightAdjustments(
  outcome: OutcomeSignal,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): WeightAdjustment[] {
  const defaults = normalizedWeights(registry);
  const totalDates =
    outcome.anotherDate + outcome.noMore + outcome.ghosted + outcome.unsure;

  // No outcomes yet: nothing to learn from, defaults stand.
  const fizzleRate =
    totalDates > 0 ? (outcome.noMore + outcome.ghosted) / totalDates : 0;
  const tilt = totalDates >= 2 ? Math.min(ADJUST_CAP, fizzleRate * ADJUST_CAP) : 0;

  // Signals that capture in-person fit get nudged up when dates fizzle.
  const lean = new Set(["postDate", "compass"]);
  const raw: Record<string, number> = {};
  for (const c of registry) {
    const base = defaults[c.id] ?? 0;
    raw[c.id] = lean.has(c.id) ? base * (1 + tilt) : base;
  }
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);

  return registry.map((c) => {
    const adjusted = sum > 0 ? raw[c.id] / sum : 0;
    const def = defaults[c.id] ?? 0;
    let reason = "Default weight; outcomes have not moved this signal.";
    if (tilt > 0 && lean.has(c.id)) {
      reason =
        "Recent dates have been fizzling, so in-person fit signals carry more weight.";
    } else if (tilt > 0) {
      reason = "Re-normalized after leaning into in-person fit signals.";
    }
    return {
      id: c.id,
      label: c.label,
      defaultWeight: Number(def.toFixed(4)),
      adjustedWeight: Number(adjusted.toFixed(4)),
      reason,
    };
  });
}
