/**
 * Pure, DB-free readiness helpers shared by the matching route and its tests.
 *
 * Readiness is a quality-aware blend of first-party signals. The set of signals,
 * their weights, denominators, and copy now live in the living signal registry
 * (`signalRegistry.ts`); this file is the deterministic math and outcome copy
 * built on top of it, so adding a signal is a registry edit, not a change here.
 */

import {
  SIGNAL_REGISTRY,
  coverageFor,
  normalizedWeights,
  contributorStep,
  type ReadinessBreakdown,
  type SignalCounts,
} from "./signalRegistry";

export type { ReadinessBreakdown, SignalCounts } from "./signalRegistry";

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

const WEIGHTS = normalizedWeights();

export function computeBreakdown(counts: SignalCounts): ReadinessBreakdown {
  const out = {} as ReadinessBreakdown;
  for (const contributor of SIGNAL_REGISTRY) {
    out[contributor.id] = coverageFor(contributor, counts[contributor.countKey]);
  }
  return out;
}

export function scoreFromBreakdown(breakdown: ReadinessBreakdown): number {
  let sum = 0;
  for (const contributor of SIGNAL_REGISTRY) {
    sum += breakdown[contributor.id] * (WEIGHTS[contributor.id] ?? 0);
  }
  return Math.round(sum);
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

/**
 * Ranked "do this next" steps, derived from the registry. Returns the
 * highest-leverage incomplete signals first, capped at `limit`. Empty when the
 * user is already eligible.
 */
export function computeNextActions(
  breakdown: ReadinessBreakdown,
  eligible: boolean,
  limit = 3,
): ReadinessNextAction[] {
  if (eligible) return [];
  return SIGNAL_REGISTRY.filter((c) => breakdown[c.id] < 100)
    .map((c) => ({ contributor: c, step: contributorStep(c, WEIGHTS) }))
    .sort((a, b) => b.step - a.step)
    .slice(0, limit)
    .map(({ contributor, step }) => ({
      key: contributor.id,
      label: contributor.action.label,
      detail: contributor.action.detail,
      points: Math.max(1, step),
      href: contributor.action.href,
    }));
}
