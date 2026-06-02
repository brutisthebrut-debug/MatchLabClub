/**
 * The signal-density map.
 *
 * A pure, presentation-only view over the living signal registry: for every
 * lane the machine reads, it reports how full that lane is (coverage), how much
 * it counts toward the picture (weight), how confident the lane is, and the one
 * action that fills it. It is derived entirely from a readiness breakdown plus
 * the effective weights, so it always agrees with the readiness score and never
 * introduces a second scoring path. Nothing here touches the database or any
 * raw user content; it is registry metadata plus the caller's own coverage.
 *
 * This module is pure and DB-free so it can be unit-tested without a
 * connection. The route owns gathering the breakdown and weights.
 */

import {
  SIGNAL_REGISTRY,
  normalizedWeights,
  type ReadinessBreakdown,
} from "./signalRegistry";

/** One lane of the density map, derived from a registry entry plus coverage. */
export interface SignalMapLane {
  /** Stable lane id, matches the readiness breakdown key. */
  id: string;
  /** Human label. */
  label: string;
  /** How full this lane is, 0-100, straight from the readiness breakdown. */
  coverage: number;
  /**
   * How much this lane counts toward the overall picture, as a whole-number
   * percentage of the effective weights. The effective weights are normalized
   * to sum to 1 before this is derived, so the percentages sum to ~100
   * (rounding aside).
   */
  weightPercent: number;
  /** Rough confidence in this lane's predictive value, 0-100. */
  confidence: number;
  /** Wellness/personality dimensions this lane informs. */
  dimensions: string[];
  /** True once the lane has any signal at all. */
  hasSignal: boolean;
  /** The single "do this next" action that fills this lane. */
  action: { label: string; detail: string; href: string };
}

/** The full density map: every lane plus a simple aggregate read. */
export interface SignalMap {
  /**
   * Overall fullness of the picture, 0-100. This is the readiness score: the
   * weighted coverage across every lane. It is passed in rather than
   * recomputed so the map can never drift from the score shown elsewhere.
   */
  densityPercent: number;
  /** How many lanes have any signal. */
  lanesActive: number;
  /** Total number of lanes the machine reads. */
  totalLanes: number;
  /**
   * Every lane, active ones first (fullest coverage first), then the blind
   * spots ordered by how much filling them would matter (weight first).
   */
  lanes: SignalMapLane[];
  /**
   * The highest-leverage empty lane: the blind spot whose weight is largest,
   * or null when every lane already has signal. Drives the "fill this next"
   * callout without the client re-deriving it.
   */
  topBlindSpot: SignalMapLane | null;
}

/**
 * Build the density map from a readiness breakdown and the effective weights
 * used to produce the readiness score. `densityScore` is the already-computed
 * readiness score; it is surfaced as `densityPercent` verbatim so the map and
 * the score never disagree.
 */
export function buildSignalMap(
  breakdown: ReadinessBreakdown,
  weights: Record<string, number> = normalizedWeights(),
  densityScore: number,
): SignalMap {
  const lanes: SignalMapLane[] = SIGNAL_REGISTRY.map((c) => {
    const coverage = breakdown[c.id] ?? 0;
    return {
      id: c.id,
      label: c.label,
      coverage,
      weightPercent: Math.round((weights[c.id] ?? 0) * 100),
      confidence: Math.round(c.confidence * 100),
      dimensions: [...c.dimensions],
      hasSignal: coverage > 0,
      action: { ...c.action },
    };
  });

  // Active lanes first (fullest first), then blind spots by weight so the most
  // valuable empty lane sits at the top of the gaps.
  lanes.sort((a, b) => {
    if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
    if (a.hasSignal) return b.coverage - a.coverage;
    return b.weightPercent - a.weightPercent;
  });

  const blindSpots = lanes.filter((l) => !l.hasSignal);
  const topBlindSpot =
    blindSpots.length === 0
      ? null
      : blindSpots.reduce((best, l) =>
          l.weightPercent > best.weightPercent ? l : best,
        );

  return {
    densityPercent: Math.round(densityScore),
    lanesActive: lanes.filter((l) => l.hasSignal).length,
    totalLanes: lanes.length,
    lanes,
    topBlindSpot,
  };
}
