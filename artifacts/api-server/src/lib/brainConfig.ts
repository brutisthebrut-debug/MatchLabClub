/**
 * Founder brain control center: the single accessor for every founder-tunable
 * knob. Reads the `founder_brain_config` row, merges it over the built-in
 * defaults, and exposes the effective values to the live readers (readiness
 * scoring, the matching threshold, the AI daily cap). An empty table reproduces
 * day-one behavior exactly, so nothing changes until the founder acts.
 *
 * Source-of-truth notes:
 *  - Signal weight defaults live in the registry; overrides here are RAW weights
 *    keyed by signal id, re-normalized to sum to 1.0 alongside any signals the
 *    founder did not override.
 *  - The readiness threshold default mirrors MATCHING_READINESS_THRESHOLD (or
 *    50) so the env still works when the founder has not set an override.
 *  - The AI daily cap defaults mirror the constants in aiService; aiService
 *    reads through this module so the founder cap wins when set.
 */

import { db, founderBrainConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  SIGNAL_REGISTRY,
  normalizedWeights,
  confidenceWeightedWeights,
  proposeWeightAdjustments,
  type OutcomeSignal,
} from "./signalRegistry";
import { logger } from "./logger";

export const BRAIN_CONTROLS_KEY = "controls";

/** Mirrors aiService daily-cap constants; that module reads through here. */
export const DEFAULT_ANON_DAILY_CAP = 5;
export const DEFAULT_FREE_DAILY_CAP = 30;

export type ReweightingMode = "hold" | "shadow" | "applied";

/**
 * A scoring lever that is either held at day-one behavior or applied live. Used
 * for confidence-weighting and freshness decay, which both change scores, so
 * each ships off and the founder flips it on once they have watched the impact.
 */
export type ScoringMode = "hold" | "applied";

export interface BrainControls {
  /** Minimum readiness score (0-100) to join the matching pool. */
  readinessThreshold: number;
  /** Default matching radius in miles surfaced to new pool members. */
  matchingRadiusMiles: number;
  /** Minimum nearby pool size before a cohort reads as "warm". */
  cohortMinSize: number;
  /** Daily hosted-LLM cap for anonymous callers. */
  anonDailyCap: number;
  /** Daily hosted-LLM cap for authed (free tier) callers. */
  freeDailyCap: number;
  /**
   * Whether bounded, outcome-driven re-weighting is wired into live scoring.
   * "hold" keeps day-one weights and skips the tilt on the live scoring path
   * (founder preview endpoints can still compute a would-be tilt on demand).
   * "shadow" computes the tilted score alongside the live one for observability
   * but still serves the day-one (base) score, so nothing a user sees changes.
   * "applied"
   * serves the tilted score, but only to users inside the rollout cohort (see
   * reweightingCohortPercent); users outside the cohort stay on the base score.
   */
  reweightingMode: ReweightingMode;
  /**
   * Rollout cohort size for "applied" re-weighting, as a percent (0-100) of
   * users, bucketed deterministically by a stable hash of the user id. 100 means
   * every user (the day-one applied semantics); 0 means no one. Has no effect in
   * "hold" or "shadow" mode. Lets the founder ramp the live tilt gradually.
   */
  reweightingCohortPercent: number;
  /**
   * Whether confidence-weighting is wired into live scoring. "applied" leans the
   * readiness weights toward the lanes we trust most (each weight scaled by its
   * registry confidence, then re-normalized); "hold" keeps day-one weights.
   */
  confidenceWeighting: ScoringMode;
  /**
   * Whether freshness decay is wired into live scoring. "applied" fades a lane's
   * coverage by its registry half-life since the user last fed it; "hold" keeps
   * raw coverage. Off by default so day-one scores are unchanged.
   */
  decayMode: ScoringMode;
  /**
   * Founder weight overrides, RAW weights keyed by signal id. Partial: any
   * signal not present falls back to its registry default. Null = no overrides.
   */
  signalWeightOverrides: Record<string, number> | null;
  /**
   * Connector enable map keyed by connector id. A connector is enabled unless
   * explicitly set to false. Empty = all connectors enabled.
   */
  connectorToggles: Record<string, boolean>;
}

/**
 * Connector catalog for the founder control center. Mirrors the connector cards
 * in ConnectionCenter.tsx (LIVE / BUILDING / RESEARCHING). Kept here so the
 * founder can enable or disable any connector by id; this is the persisted
 * control surface. Keep ids in sync with ConnectionCenter when connectors move.
 */
export interface ConnectorCatalogEntry {
  id: string;
  title: string;
  status: "live" | "building" | "researching";
}

export const CONNECTOR_CATALOG: readonly ConnectorCatalogEntry[] = [
  { id: "hinge-zip", title: "Hinge GDPR ZIP", status: "live" },
  { id: "instagram-paste", title: "Instagram tone paste", status: "live" },
  { id: "message-paste", title: "Message paste", status: "live" },
  { id: "photo-scan", title: "Photo scan", status: "live" },
  { id: "wellness", title: "Wellness questionnaire", status: "live" },
  { id: "calendar-ics", title: "Calendar paste", status: "live" },
  { id: "matching-cohort", title: "Matching cohort", status: "live" },
  { id: "forwarding-inbox", title: "Forwarding inbox", status: "building" },
  { id: "plaid", title: "Plaid spending signals", status: "building" },
  { id: "spotify", title: "Spotify", status: "building" },
  { id: "apple-health", title: "Apple Health export", status: "researching" },
  { id: "google-takeout", title: "Google Takeout history", status: "researching" },
  { id: "messaging-e2ee", title: "WhatsApp and iMessage", status: "researching" },
  { id: "letterboxd", title: "Letterboxd taste", status: "researching" },
  { id: "strava", title: "Strava rhythm", status: "researching" },
  { id: "goodreads", title: "Goodreads shelf", status: "researching" },
  { id: "photo-library-vibe", title: "Photo library vibe", status: "researching" },
  { id: "pinterest", title: "Pinterest aesthetic", status: "researching" },
  { id: "netflix-history", title: "Netflix viewing history", status: "researching" },
  { id: "tiktok-taste", title: "TikTok taste", status: "researching" },
  { id: "resy-opentable", title: "Resy and OpenTable history", status: "researching" },
] as const;

/** A connector is enabled unless explicitly toggled off in the controls. */
export function connectorEnabled(
  controls: BrainControls,
  connectorId: string,
): boolean {
  return controls.connectorToggles[connectorId] !== false;
}

function envReadinessThreshold(): number {
  const raw = Number(process.env.MATCHING_READINESS_THRESHOLD);
  if (!Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function defaultControls(): BrainControls {
  return {
    readinessThreshold: envReadinessThreshold(),
    matchingRadiusMiles: 35,
    cohortMinSize: 3,
    anonDailyCap: DEFAULT_ANON_DAILY_CAP,
    freeDailyCap: DEFAULT_FREE_DAILY_CAP,
    reweightingMode: "shadow",
    reweightingCohortPercent: 100,
    confidenceWeighting: "hold",
    decayMode: "hold",
    signalWeightOverrides: null,
    connectorToggles: {},
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Coerce an arbitrary stored JSON blob into a valid, bounded BrainControls. */
export function coerceControls(raw: unknown): BrainControls {
  const base = defaultControls();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Record<string, unknown>;

  let overrides: Record<string, number> | null = null;
  if (v.signalWeightOverrides && typeof v.signalWeightOverrides === "object") {
    const validIds = new Set(SIGNAL_REGISTRY.map((c) => c.id as string));
    const out: Record<string, number> = {};
    for (const [id, w] of Object.entries(v.signalWeightOverrides as Record<string, unknown>)) {
      const num = Number(w);
      if (validIds.has(id) && Number.isFinite(num) && num >= 0) {
        out[id] = num;
      }
    }
    if (Object.keys(out).length > 0) overrides = out;
  }

  const toggles: Record<string, boolean> = {};
  if (v.connectorToggles && typeof v.connectorToggles === "object") {
    for (const [id, on] of Object.entries(v.connectorToggles as Record<string, unknown>)) {
      toggles[id] = Boolean(on);
    }
  }

  return {
    readinessThreshold: clampInt(v.readinessThreshold, 0, 100, base.readinessThreshold),
    matchingRadiusMiles: clampInt(v.matchingRadiusMiles, 1, 500, base.matchingRadiusMiles),
    cohortMinSize: clampInt(v.cohortMinSize, 1, 1000, base.cohortMinSize),
    anonDailyCap: clampInt(v.anonDailyCap, 0, 10000, base.anonDailyCap),
    freeDailyCap: clampInt(v.freeDailyCap, 0, 100000, base.freeDailyCap),
    reweightingMode:
      v.reweightingMode === "applied"
        ? "applied"
        : v.reweightingMode === "shadow"
          ? "shadow"
          : "hold",
    reweightingCohortPercent: clampInt(
      v.reweightingCohortPercent,
      0,
      100,
      base.reweightingCohortPercent,
    ),
    confidenceWeighting: v.confidenceWeighting === "applied" ? "applied" : "hold",
    decayMode: v.decayMode === "applied" ? "applied" : "hold",
    signalWeightOverrides: overrides,
    connectorToggles: toggles,
  };
}

/**
 * Load the effective controls. Fail-open to defaults so a missing table or a
 * read error never breaks scoring or AI calls.
 */
export async function loadBrainControls(): Promise<BrainControls> {
  try {
    const rows = await db
      .select({ value: founderBrainConfigTable.value })
      .from(founderBrainConfigTable)
      .where(eq(founderBrainConfigTable.key, BRAIN_CONTROLS_KEY))
      .limit(1);
    if (rows.length === 0) return defaultControls();
    return coerceControls(rows[0]!.value);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "loadBrainControls failed; using defaults",
    );
    return defaultControls();
  }
}

/** True when a stored row exists (controls are overridden from defaults). */
export async function brainControlsOverridden(): Promise<boolean> {
  try {
    const rows = await db
      .select({ key: founderBrainConfigTable.key })
      .from(founderBrainConfigTable)
      .where(eq(founderBrainConfigTable.key, BRAIN_CONTROLS_KEY))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Merge a partial update over current controls and upsert. Returns the result. */
export async function saveBrainControls(
  patch: Partial<BrainControls>,
): Promise<BrainControls> {
  const current = await loadBrainControls();
  const merged = coerceControls({ ...current, ...patch });
  const now = new Date();
  await db
    .insert(founderBrainConfigTable)
    .values({ key: BRAIN_CONTROLS_KEY, value: merged, updatedAt: now })
    .onConflictDoUpdate({
      target: founderBrainConfigTable.key,
      set: { value: merged, updatedAt: now },
    });
  return merged;
}

/** Remove all overrides, returning to day-one defaults. */
export async function resetBrainControls(): Promise<BrainControls> {
  await db
    .delete(founderBrainConfigTable)
    .where(eq(founderBrainConfigTable.key, BRAIN_CONTROLS_KEY));
  return defaultControls();
}

/**
 * Base weights for scoring: registry defaults, with any founder raw-weight
 * overrides applied, re-normalized to sum to 1.0, then optionally tilted toward
 * the lanes we trust most when confidence-weighting is "applied". With no
 * overrides and confidence-weighting on "hold" this is the exact registry
 * normalization (day-one identity).
 */
export function effectiveBaseWeights(
  controls: BrainControls,
): Record<string, number> {
  let base: Record<string, number>;
  if (!controls.signalWeightOverrides) {
    base = normalizedWeights();
  } else {
    const raw: Record<string, number> = {};
    for (const c of SIGNAL_REGISTRY) {
      const id = c.id as string;
      const override = controls.signalWeightOverrides[id];
      raw[id] = Number.isFinite(override) ? (override as number) : c.weight;
    }
    const total = Object.values(raw).reduce((a, b) => a + b, 0);
    base = {};
    for (const id of Object.keys(raw)) {
      base[id] = total > 0 ? raw[id]! / total : 0;
    }
  }
  if (controls.confidenceWeighting === "applied") {
    return confidenceWeightedWeights(base);
  }
  return base;
}

/**
 * The bounded outcome tilt layered on top of the base weights, ALWAYS applied
 * regardless of mode or cohort. This is the "what re-weighting would do" view
 * used for shadow observability and the founder impact preview. Re-normalized to
 * sum to 1.0 by proposeWeightAdjustments.
 */
export function reweightedWeights(
  controls: BrainControls,
  outcome: OutcomeSignal,
): Record<string, number> {
  const base = effectiveBaseWeights(controls);
  const adjustments = proposeWeightAdjustments(outcome, SIGNAL_REGISTRY, base);
  const out: Record<string, number> = {};
  for (const a of adjustments) out[a.id] = a.adjustedWeight;
  return out;
}

/**
 * The effective per-user weights actually used to score readiness when the tilt
 * is fully on. In "hold"/"shadow" mode this is the base weights (the tilt is not
 * served); in "applied" mode it is the tilted weights. Cohort gating is applied
 * by the caller (computeReadiness), which knows the user id.
 */
export function effectiveWeightsForUser(
  controls: BrainControls,
  outcome: OutcomeSignal,
): Record<string, number> {
  if (controls.reweightingMode !== "applied") return effectiveBaseWeights(controls);
  return reweightedWeights(controls, outcome);
}

/**
 * Deterministic rollout-cohort membership for "applied" re-weighting. A stable
 * FNV-1a hash of the user id, normalized unsigned and bucketed into 0-99; a
 * user is in-cohort when their bucket is below reweightingCohortPercent. 100
 * includes everyone, 0 no one. Pure and stable so a user does not flip in and
 * out between scorings.
 */
export function inReweightingCohort(
  controls: BrainControls,
  userId: string,
): boolean {
  const pct = controls.reweightingCohortPercent;
  if (pct >= 100) return true;
  if (pct <= 0 || !userId) return false;
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (h >>> 0) % 100;
  return bucket < pct;
}

/** Effective matching pool threshold (founder override → env → 50). */
export async function effectiveReadinessThreshold(): Promise<number> {
  const controls = await loadBrainControls();
  return controls.readinessThreshold;
}

/** Effective AI daily caps (founder override → constants). */
export async function effectiveAiCaps(): Promise<{ anon: number; free: number }> {
  const controls = await loadBrainControls();
  return { anon: controls.anonDailyCap, free: controls.freeDailyCap };
}
