import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  auditsTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  compatibilityReadsTable,
  postDateNotesTable,
  matchingReadinessSnapshotsTable,
} from "@workspace/db";
import {
  UpdateMatchingPreferencesBody,
  UpdateMatchingPoolMembershipBody,
  CreateMatchingExternalReadBody,
  RespondToMatchProposalBody,
} from "@workspace/api-zod";
import { generate, parseStructured } from "../lib/aiService";
import { buildEchoMatchRead, type EchoMatchRead } from "../lib/echoMatchRead";
import { echoMatchReadSchema } from "@workspace/ai-schemas";
import {
  computeBreakdown,
  computeNextActions,
  computeOutcomeInsight,
  scoreFromBreakdown,
  type OutcomeInsight,
  type ReadinessBreakdown,
  type ReadinessNextAction,
} from "../lib/readiness";
import {
  applyDecay,
  describeActiveSignals,
  proposeWeightAdjustments,
  SIGNAL_REGISTRY,
  type OutcomeSignal,
} from "../lib/signalRegistry";
import { collectSignalCounts, collectSignalRecency } from "../lib/signalCounts";
import { computeActivityStreak, type ActivityStreak } from "../lib/streak";
import { loadActivityDays } from "../lib/activityDays";
import {
  loadBrainControls,
  effectiveBaseWeights,
  reweightedWeights,
  inReweightingCohort,
  effectiveReadinessThreshold,
  type BrainControls,
} from "../lib/brainConfig";
import { recordJourneyEvent } from "../lib/journeyEvents";
import {
  rankCandidates,
  type MatchCandidate,
} from "../lib/matchEngine";

async function loadUserTier(userId: string): Promise<string | null> {
  const rows = await db
    .select({ tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0]?.tier ?? null;
}

const router: IRouter = Router();

type PreferencesRow = typeof matchPreferencesTable.$inferSelect;
type PoolRow = typeof matchPoolMembershipTable.$inferSelect;
type ProposalRow = typeof matchProposalsTable.$inferSelect;

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function serializePreferences(row: PreferencesRow) {
  return {
    userId: row.userId,
    ageMin: row.ageMin ?? null,
    ageMax: row.ageMax ?? null,
    distanceKm: row.distanceKm ?? null,
    genderPreference: row.genderPreference ?? null,
    dealBreakers: row.dealBreakers ?? null,
    mustHaves: row.mustHaves ?? null,
    cityHint: row.cityHint ?? null,
    updatedAt: toIso(row.updatedAt),
  };
}

function serializeMembership(row: PoolRow) {
  return {
    userId: row.userId,
    status: row.status,
    readyAt: row.readyAt ? toIso(row.readyAt) : null,
    pausedReason: row.pausedReason ?? null,
    tier: row.tier ?? null,
    updatedAt: toIso(row.updatedAt),
  };
}

function serializeProposal(row: ProposalRow) {
  return {
    id: row.id,
    userId: row.userId,
    proposedToUserId: row.proposedToUserId ?? null,
    source: row.source,
    compatibilityScore: row.compatibilityScore,
    summary: row.summary ?? null,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function loadPreferences(userId: string): Promise<PreferencesRow | null> {
  const rows = await db
    .select()
    .from(matchPreferencesTable)
    .where(eq(matchPreferencesTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadMembership(userId: string): Promise<PoolRow | null> {
  const rows = await db
    .select()
    .from(matchPoolMembershipTable)
    .where(eq(matchPoolMembershipTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Outcome of comparing the live (served) score against the would-be re-weighted
 * score for a user. Present on Readiness only when reweighting is not on "hold".
 * `applied` is true only when the live score actually used the tilt (mode
 * "applied" AND the user is inside the rollout cohort). Only derived scores
 * leave here, never raw outcomes or content.
 */
export interface ReweightingObservation {
  baseScore: number;
  tiltedScore: number;
  delta: number;
  inCohort: boolean;
  applied: boolean;
}

interface Readiness {
  score: number;
  breakdown: ReadinessBreakdown;
  /** Effective per-signal weights used to produce this score (founder-tunable). */
  weights: Record<string, number>;
  /** Shadow/applied re-weighting impact, present when mode is not "hold". */
  reweighting?: ReweightingObservation;
}

/**
 * A derived, user-facing read of how the engine is learning from the caller's
 * own logged date outcomes. Aggregate/derived only (scores + lane labels),
 * never raw notes or PII. In shadow mode this is informational: the base score
 * is what the user is served, observedScore is the would-be tilt.
 */
export interface ReadinessLearning {
  observing: boolean;
  applied: boolean;
  headline: string;
  totalDates: number;
  baseScore: number;
  observedScore: number;
  delta: number;
  leaningInto: string[];
}

/**
 * Build the user-facing learning read from data already loaded by the state
 * handler. `proposeWeightAdjustments` is deterministic and bounded; we only
 * surface the labels of lanes nudged up and the derived score deltas, so no raw
 * outcome ever leaves here.
 */
export function buildReadinessLearning(
  controls: BrainControls,
  readiness: Readiness,
  outcome: OutcomeInsight,
): ReadinessLearning {
  const observing = controls.reweightingMode !== "hold";
  const baseScore = readiness.reweighting?.baseScore ?? readiness.score;
  const observedScore = readiness.reweighting?.tiltedScore ?? readiness.score;
  const delta = readiness.reweighting?.delta ?? 0;
  const outcomeSignal: OutcomeSignal = {
    anotherDate: outcome.anotherDate,
    noMore: outcome.noMore,
    ghosted: outcome.ghosted,
    unsure: outcome.unsure,
  };
  const adjustments = proposeWeightAdjustments(
    outcomeSignal,
    SIGNAL_REGISTRY,
    effectiveBaseWeights(controls),
    controls.reweightingMinOutcomes,
  );
  const leaningInto = adjustments
    .filter((a) => a.adjustedWeight > a.defaultWeight + 1e-6)
    .map((a) => a.label);
  return {
    observing,
    // True only when the tilt is actually serving this user's score (applied
    // mode + in-cohort). In shadow/hold it stays false, so the UI never claims
    // the readiness gate moved.
    applied: readiness.reweighting?.applied ?? false,
    headline: outcome.headline,
    totalDates: outcome.totalDates,
    baseScore,
    observedScore,
    delta,
    leaningInto,
  };
}

/**
 * Build the readiness breakdown for a user, applying freshness decay when the
 * founder has switched it on. Shared by the live score and the re-weighting
 * preview so both read the exact same coverage.
 */
async function readinessBreakdownFor(
  userId: string,
  controls: BrainControls,
): Promise<ReadinessBreakdown> {
  const counts = await collectSignalCounts(userId);
  let breakdown = computeBreakdown(counts);
  // Freshness decay: fade time-sensitive lanes by their half-life since the user
  // last fed them. Only runs (and only queries recency) when switched to
  // "applied". The decayed breakdown is what both the score and the next-action
  // list read, so a faded lane re-surfaces as a thing to do again.
  if (controls.decayMode === "applied") {
    const recency = await collectSignalRecency(userId);
    breakdown = applyDecay(breakdown, recency);
  }
  return breakdown;
}

/**
 * Compare the base score against the would-be tilted score for a user, and
 * decide which weights the live score should use. The tilt only becomes the
 * served weights when mode is "applied" AND the user is in the rollout cohort,
 * so "shadow" mode observes impact without changing anything a user sees.
 */
function evaluateReweighting(
  breakdown: ReadinessBreakdown,
  controls: BrainControls,
  outcome: OutcomeSignal,
  userId: string,
): { weights: Record<string, number>; observation: ReweightingObservation } {
  const base = effectiveBaseWeights(controls);
  const tilted = reweightedWeights(controls, outcome);
  const baseScore = scoreFromBreakdown(breakdown, base);
  const tiltedScore = scoreFromBreakdown(breakdown, tilted);
  const inCohort = inReweightingCohort(controls, userId);
  const applied = controls.reweightingMode === "applied" && inCohort;
  return {
    weights: applied ? tilted : base,
    observation: {
      baseScore,
      tiltedScore,
      delta: tiltedScore - baseScore,
      inCohort,
      applied,
    },
  };
}

export async function computeReadiness(userId: string): Promise<Readiness> {
  // Effective weights and breakdown both come from the founder control center.
  // With no overrides and every scoring lever on "hold" this reproduces the
  // exact day-one score. Each gated step adds its own query only when switched
  // on, so the default path stays a single counts query.
  const controls = await loadBrainControls();
  const breakdown = await readinessBreakdownFor(userId, controls);

  let weights = effectiveBaseWeights(controls);
  let reweighting: ReweightingObservation | undefined;
  // Re-weighting: compute the tilt for both "shadow" (observe only) and
  // "applied" (serve to the cohort). "hold" skips the extra outcome query so the
  // default path is unchanged.
  if (controls.reweightingMode !== "hold") {
    const outcome = await computeOutcomeInsightForUser(userId);
    const ev = evaluateReweighting(breakdown, controls, outcome, userId);
    weights = ev.weights;
    reweighting = ev.observation;
  }

  return {
    score: scoreFromBreakdown(breakdown, weights),
    breakdown,
    weights,
    reweighting,
  };
}

/**
 * Founder-only preview of the re-weighting impact for a single user, computed
 * regardless of the current mode (so the founder can see impact before flipping
 * the switch). Returns only derived scores, never raw outcomes or content.
 */
export async function computeReweightingPreview(
  userId: string,
  controls: BrainControls,
): Promise<ReweightingObservation> {
  return (await computeReweightingDetail(userId, controls)).observation;
}

/** A single lane the outcome tilt is leaning into, for aggregate founder views. */
export interface ReweightingLane {
  id: string;
  label: string;
}

/**
 * Like computeReweightingPreview but also reports WHICH registry lanes the tilt
 * is leaning into for this user (label + id only, never raw outcomes). Lets the
 * founder see what the brain is actually learning across the cohort, not just
 * how much scores move. Computes breakdown + outcome once and derives both.
 */
export async function computeReweightingDetail(
  userId: string,
  controls: BrainControls,
): Promise<{ observation: ReweightingObservation; leanLanes: ReweightingLane[] }> {
  const breakdown = await readinessBreakdownFor(userId, controls);
  const outcome = await computeOutcomeInsightForUser(userId);
  const observation = evaluateReweighting(
    breakdown,
    controls,
    outcome,
    userId,
  ).observation;
  const outcomeSignal: OutcomeSignal = {
    anotherDate: outcome.anotherDate,
    noMore: outcome.noMore,
    ghosted: outcome.ghosted,
    unsure: outcome.unsure,
  };
  const leanLanes = proposeWeightAdjustments(
    outcomeSignal,
    SIGNAL_REGISTRY,
    effectiveBaseWeights(controls),
    controls.reweightingMinOutcomes,
  )
    .filter((a) => a.adjustedWeight > a.defaultWeight + 1e-6)
    .map((a) => ({ id: a.id, label: a.label }));
  return { observation, leanLanes };
}

export async function computeOutcomeInsightForUser(
  userId: string,
): Promise<OutcomeInsight> {
  const rows = await db
    .select({
      outcome: postDateNotesTable.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.userId, userId),
        isNull(postDateNotesTable.deletedAt),
        sql`${postDateNotesTable.outcome} is not null`,
      ),
    )
    .groupBy(postDateNotesTable.outcome);

  const counts = { anotherDate: 0, noMore: 0, ghosted: 0, unsure: 0 };
  for (const row of rows) {
    const n = Number(row.count ?? 0);
    if (row.outcome === "another_date") counts.anotherDate = n;
    else if (row.outcome === "no_more") counts.noMore = n;
    else if (row.outcome === "ghosted") counts.ghosted = n;
    else if (row.outcome === "unsure") counts.unsure = n;
  }
  return computeOutcomeInsight(counts);
}

interface ReadinessHistoryPoint {
  day: string;
  score: number;
}

async function loadReadinessHistory(
  userId: string,
): Promise<ReadinessHistoryPoint[]> {
  const rows = await db
    .select({
      day: matchingReadinessSnapshotsTable.day,
      score: matchingReadinessSnapshotsTable.score,
    })
    .from(matchingReadinessSnapshotsTable)
    .where(eq(matchingReadinessSnapshotsTable.userId, userId))
    .orderBy(asc(matchingReadinessSnapshotsTable.day))
    .limit(30);
  return rows.map((r) => ({ day: r.day, score: Number(r.score) }));
}

interface ReadinessDeltaLane {
  key: string;
  delta: number;
}
interface ReadinessDeltaResult {
  scoreDelta: number;
  fromDay: string;
  toDay: string;
  lanes: ReadinessDeltaLane[];
}

// Derive what actually moved between the two most recent daily snapshots so the
// product can answer "why did my readiness change." The score delta comes from
// the stored score; per-lane deltas are coverage changes (0-100 each) read from
// the stored breakdown maps. Only lanes that changed are returned, biggest move
// first. Returns null until there are at least two snapshots to compare, so a
// brand-new account never shows a misleading delta. Reads only derived counts,
// never any underlying content.
async function loadReadinessDelta(
  userId: string,
): Promise<ReadinessDeltaResult | null> {
  const rows = await db
    .select({
      day: matchingReadinessSnapshotsTable.day,
      score: matchingReadinessSnapshotsTable.score,
      breakdown: matchingReadinessSnapshotsTable.breakdown,
    })
    .from(matchingReadinessSnapshotsTable)
    .where(eq(matchingReadinessSnapshotsTable.userId, userId))
    .orderBy(desc(matchingReadinessSnapshotsTable.day))
    .limit(2);
  if (rows.length < 2) return null;
  const [latest, prev] = rows;
  const latestBreakdown = (latest.breakdown ?? {}) as Record<string, number>;
  const prevBreakdown = (prev.breakdown ?? {}) as Record<string, number>;
  const keys = new Set([
    ...Object.keys(latestBreakdown),
    ...Object.keys(prevBreakdown),
  ]);
  const lanes: ReadinessDeltaLane[] = [];
  for (const key of keys) {
    const delta = Math.round(
      (latestBreakdown[key] ?? 0) - (prevBreakdown[key] ?? 0),
    );
    if (delta !== 0) lanes.push({ key, delta });
  }
  lanes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    scoreDelta: Number(latest.score) - Number(prev.score),
    fromDay: prev.day,
    toDay: latest.day,
    lanes: lanes.slice(0, 8),
  };
}

// Minimum cohort size before any benchmark is shown. Below this we never reveal
// a percentile, both because a tiny cohort is statistically meaningless and
// because a small group plus a known goal could narrow toward an individual.
// Aggregate-only by construction (we read coverage maps, never identities or
// content), and this guard keeps it that way.
const BENCHMARK_MIN_COHORT = Math.max(
  3,
  Number(process.env.BENCHMARK_MIN_COHORT ?? 8) || 8,
);

// Collapse the freeform dating-goal text every intake/wizard surface writes into
// a few stable buckets so a cohort is large enough to be meaningful and the
// comparison is apples-to-apples. Keyword based and order-sensitive (long-term
// intent wins over the word "open"). Unknown/empty goals fall into "exploring".
export function normalizeGoal(raw: string | null | undefined): string {
  const g = (raw ?? "").toLowerCase();
  if (!g.trim()) return "exploring";
  if (/(marriage|married|life partner|long.?term|serious|relationship)/.test(g))
    return "long-term";
  if (/(casual|hookup|hook up|fun|open|fling|short.?term)/.test(g))
    return "casual";
  if (/(friend)/.test(g)) return "friends-first";
  return "exploring";
}

interface BenchmarkLane {
  key: string;
  /** The caller's own coverage for this lane, 0-100. */
  coverage: number;
  /** The cohort's median coverage for this lane, 0-100. */
  cohortMedian: number;
  /** Where the caller sits in the cohort for this lane, 0-100 percentile. */
  percentile: number;
}
interface BenchmarksResult {
  available: boolean;
  /** Normalized goal bucket the cohort is built from. */
  goal: string;
  cohortSize: number;
  minCohort: number;
  lanes: BenchmarkLane[];
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// Anonymized per-lane standing for the caller against everyone who shares their
// (normalized) dating goal. The cohort is built from the latest daily readiness
// snapshot per user (already derived coverage maps, never raw content), joined
// to each user's most recent goal. We read only coverage numbers and a goal
// bucket, never identities, so this is aggregate by construction; the min-cohort
// guard blocks reveals that could narrow toward an individual. Returns
// available:false (no lanes) when the caller has no goal-bearing audit or the
// cohort is too small.
async function loadBenchmarks(userId: string): Promise<BenchmarksResult> {
  // The caller's own goal, from their most recent generated audit.
  const goalRows = await db
    .select({ goal: auditsTable.datingGoal })
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.userId, userId),
        isNull(auditsTable.deletedAt),
        sql`${auditsTable.reportGeneratedAt} is not null`,
      ),
    )
    .orderBy(desc(auditsTable.reportGeneratedAt))
    .limit(1);
  const goal = normalizeGoal(goalRows[0]?.goal);

  // Latest goal per user (most recent generated audit), so we can bucket the
  // whole population by normalized goal in JS.
  const goalByUser = await db.execute<{ user_id: string; dating_goal: string }>(sql`
    SELECT DISTINCT ON (user_id) user_id, dating_goal
    FROM audits
    WHERE report_generated_at IS NOT NULL AND deleted_at IS NULL
    ORDER BY user_id, report_generated_at DESC
  `);
  const cohortUserIds = new Set<string>();
  for (const row of goalByUser.rows ?? []) {
    if (row.user_id === userId) continue;
    if (normalizeGoal(row.dating_goal) === goal) cohortUserIds.add(row.user_id);
  }

  // Latest snapshot breakdown per user, filtered to the cohort. These are
  // derived coverage maps only.
  const snapRows = await db.execute<{
    user_id: string;
    breakdown: Record<string, number> | null;
  }>(sql`
    SELECT DISTINCT ON (user_id) user_id, breakdown
    FROM matching_readiness_snapshots
    ORDER BY user_id, day DESC
  `);
  const cohortBreakdowns: Record<string, number>[] = [];
  for (const row of snapRows.rows ?? []) {
    if (!cohortUserIds.has(row.user_id)) continue;
    cohortBreakdowns.push((row.breakdown ?? {}) as Record<string, number>);
  }

  const cohortSize = cohortBreakdowns.length;
  if (cohortSize < BENCHMARK_MIN_COHORT) {
    return {
      available: false,
      goal,
      cohortSize,
      minCohort: BENCHMARK_MIN_COHORT,
      lanes: [],
    };
  }

  // The caller's own current coverage, computed fresh so it always reflects the
  // very latest signal rather than a possibly-stale snapshot.
  const readiness = await computeReadiness(userId);
  const lanes: BenchmarkLane[] = [];
  for (const contributor of SIGNAL_REGISTRY) {
    const key = contributor.id as string;
    const mine = Math.round(readiness.breakdown[contributor.id] ?? 0);
    const cohort = cohortBreakdowns
      .map((b) => Math.round(b[key] ?? 0))
      .sort((a, b) => a - b);
    const atOrBelow = cohort.filter((v) => v <= mine).length;
    const percentile = Math.round((atOrBelow / cohort.length) * 100);
    lanes.push({
      key,
      coverage: mine,
      cohortMedian: median(cohort),
      percentile,
    });
  }

  return {
    available: true,
    goal,
    cohortSize,
    minCohort: BENCHMARK_MIN_COHORT,
    lanes,
  };
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// loadActivityDays lives in ../lib/activityDays (single source of truth for which
// tables count as "showing up"). Re-exported here so existing importers that pull
// it from "./matching" (and the achievements route + its test mock) keep working.
export { loadActivityDays };

const EMPTY_STREAK: ActivityStreak = {
  current: 0,
  longest: 0,
  activeToday: false,
  daysActiveLast14: 0,
};

async function writeReadinessSnapshot(
  userId: string,
  readiness: Readiness,
): Promise<void> {
  // Read the most recent prior snapshot before upserting today's, so we can tell
  // whether readiness actually climbed. The latest row may be today's own (a
  // same-day recompute) or an earlier day; comparing against the latest known
  // score means readiness_gained fires only on a real increase, never on a flat
  // recompute or the first snapshot of a new day at an unchanged score.
  let priorScore = 0;
  try {
    const prior = await db
      .select({ score: matchingReadinessSnapshotsTable.score })
      .from(matchingReadinessSnapshotsTable)
      .where(eq(matchingReadinessSnapshotsTable.userId, userId))
      .orderBy(desc(matchingReadinessSnapshotsTable.day))
      .limit(1);
    priorScore = prior[0]?.score ?? 0;
  } catch {
    priorScore = 0;
  }

  await db
    .insert(matchingReadinessSnapshotsTable)
    .values({
      userId,
      day: todayUtc(),
      score: readiness.score,
      breakdown: readiness.breakdown,
    })
    .onConflictDoUpdate({
      target: [
        matchingReadinessSnapshotsTable.userId,
        matchingReadinessSnapshotsTable.day,
      ],
      set: {
        score: readiness.score,
        breakdown: readiness.breakdown,
      },
    });

  if (readiness.score > priorScore) {
    void recordJourneyEvent({
      eventType: "readiness_gained",
      userId,
      props: { score: readiness.score, delta: readiness.score - priorScore },
    });
  }
}

// Minimum readiness score required to activate pool membership. Sourced from
// the founder control center (override -> MATCHING_READINESS_THRESHOLD -> 50),
// clamped to 0-100. Async because it reads the founder brain config.
export async function readinessThreshold(): Promise<number> {
  return effectiveReadinessThreshold();
}

const POOL_VISIBLE_STATUSES = ["building", "ready", "concierge_only"] as const;

async function totalPoolCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchPoolMembershipTable)
    .where(
      inArray(matchPoolMembershipTable.status, [...POOL_VISIBLE_STATUSES]),
    );
  return Number(rows[0]?.count ?? 0);
}

router.get("/me/matching/state", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const [prefs, membership, readiness, total, tier, outcomeInsight, controls] =
    await Promise.all([
      loadPreferences(userId),
      loadMembership(userId),
      computeReadiness(userId),
      totalPoolCount(),
      loadUserTier(userId),
      computeOutcomeInsightForUser(userId),
      loadBrainControls(),
    ]);
  const readinessLearning = buildReadinessLearning(
    controls,
    readiness,
    outcomeInsight,
  );
  const cityHint = prefs?.cityHint ?? null;
  let density = total;
  if (cityHint && cityHint.trim().length > 0) {
    const cityRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchPoolMembershipTable)
      .innerJoin(
        matchPreferencesTable,
        eq(matchPoolMembershipTable.userId, matchPreferencesTable.userId),
      )
      .where(
        and(
          inArray(matchPoolMembershipTable.status, [...POOL_VISIBLE_STATUSES]),
          sql`lower(${matchPreferencesTable.cityHint}) = ${cityHint.toLowerCase()}`,
        ),
      );
    density = Number(cityRows[0]?.count ?? 0);
  }

  const threshold = await readinessThreshold();
  const eligible = readiness.score >= threshold;

  // Persist today's score so the trend line has fresh data, then read the
  // (now-current) history back. A failed snapshot must not break the state read.
  try {
    await writeReadinessSnapshot(userId, readiness);
  } catch (err) {
    req.log.warn({ err }, "Failed to write readiness snapshot");
  }
  const [history, nextActions, readinessDelta] = await Promise.all([
    loadReadinessHistory(userId),
    Promise.resolve(
      computeNextActions(readiness.breakdown, eligible, 3, readiness.weights),
    ),
    loadReadinessDelta(userId),
  ]);

  // Activity streak is a gamification lens only. A failure here must never break
  // the state read, so it degrades to an empty streak.
  let activityStreak = EMPTY_STREAK;
  try {
    const days = await loadActivityDays(userId);
    activityStreak = computeActivityStreak(days, todayUtc());
  } catch (err) {
    req.log.warn({ err }, "Failed to compute activity streak");
  }

  res.json({
    preferences: prefs ? serializePreferences(prefs) : null,
    poolStatus: membership?.status ?? "off",
    tier,
    readiness,
    eligible,
    readinessThreshold: threshold,
    cityDensity: density,
    totalPoolCount: total,
    nextActions,
    history,
    readinessDelta,
    outcomeInsight,
    activityStreak,
    readinessLearning,
  });
});

// Anonymized per-lane standing against the caller's goal cohort. Guarded below a
// minimum cohort size and derived-only (coverage maps + goal bucket, no PII).
router.get("/me/matching/benchmarks", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const benchmarks = await loadBenchmarks(req.user.id);
  res.json(benchmarks);
});

router.put("/me/matching/preferences", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = UpdateMatchingPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const data = parsed.data;
  if (
    data.ageMin !== undefined &&
    data.ageMin !== null &&
    data.ageMax !== undefined &&
    data.ageMax !== null &&
    data.ageMin > data.ageMax
  ) {
    res.status(400).json({ error: "ageMin cannot exceed ageMax" });
    return;
  }
  const now = new Date();
  const values = {
    userId,
    ageMin: data.ageMin ?? null,
    ageMax: data.ageMax ?? null,
    distanceKm: data.distanceKm ?? null,
    genderPreference: data.genderPreference ?? null,
    dealBreakers: data.dealBreakers ?? null,
    mustHaves: data.mustHaves ?? null,
    cityHint: data.cityHint ?? null,
    updatedAt: now,
  };
  const [row] = await db
    .insert(matchPreferencesTable)
    .values(values)
    .onConflictDoUpdate({
      target: matchPreferencesTable.userId,
      set: {
        ageMin: values.ageMin,
        ageMax: values.ageMax,
        distanceKm: values.distanceKm,
        genderPreference: values.genderPreference,
        dealBreakers: values.dealBreakers,
        mustHaves: values.mustHaves,
        cityHint: values.cityHint,
        updatedAt: now,
      },
    })
    .returning();
  res.json(serializePreferences(row!));
});

router.put("/me/matching/pool-membership", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = UpdateMatchingPoolMembershipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const requested = parsed.data.status;
  // Cohort gate: joining the pool (building/ready) requires enough signal
  // density. Leaving (off) and pausing (paused) are always allowed so a user
  // can never get stuck in the pool.
  if (requested === "building" || requested === "ready") {
    const [readiness, threshold] = await Promise.all([
      computeReadiness(userId),
      readinessThreshold(),
    ]);
    if (readiness.score < threshold) {
      res.status(422).json({
        error: `You need a readiness of ${threshold} to join the matching pool. You are at ${readiness.score} right now. Add a compass read, a wellness pass, or a Hinge import to close the gap.`,
        readinessScore: readiness.score,
        readinessThreshold: threshold,
      });
      return;
    }
  }
  const [existing, tier] = await Promise.all([
    loadMembership(userId),
    loadUserTier(userId),
  ]);
  let nextStatus: "off" | "building" | "ready" | "paused" | "concierge_only" =
    requested;
  if (nextStatus === "building" && tier === "wingman") {
    nextStatus = "concierge_only";
    req.log.info(
      { userId },
      "Wingman tier opted into pool, routed to concierge_only for founder review",
    );
  }
  const pausedReason =
    nextStatus === "paused" ? parsed.data.pausedReason ?? null : null;
  const now = new Date();
  const readyAt =
    nextStatus === "ready" ? existing?.readyAt ?? now : existing?.readyAt ?? null;
  const [row] = await db
    .insert(matchPoolMembershipTable)
    .values({
      userId,
      status: nextStatus,
      readyAt,
      pausedReason,
      tier,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: {
        status: nextStatus,
        readyAt,
        pausedReason,
        updatedAt: now,
      },
    })
    .returning();
  res.json(serializeMembership(row!));
});

// Deterministic baseline used as fallback when Anthropic isn't available
// (no API key, consent not granted, or daily cap exceeded). Same shape as
// the AI path so callers don't have to branch.
function deterministicExternalRead(profileText: string): {
  score: number;
  highlights: string[];
  frictions: string[];
  summary: string;
} {
  const text = profileText.trim();
  const lower = text.toLowerCase();
  const positives = [
    "therapy",
    "boundaries",
    "growth",
    "honest",
    "kind",
    "curious",
    "reader",
    "active",
    "outdoors",
    "family",
    "thoughtful",
    "creative",
  ];
  const frictionsList = [
    "no drama",
    "fluent in sarcasm",
    "ask me later",
    "5'10",
    "send memes",
    "looking for fun",
  ];
  const highlights = positives.filter((kw) => lower.includes(kw));
  const frictions = frictionsList.filter((kw) => lower.includes(kw));
  let score = 50 + highlights.length * 5 - frictions.length * 7;
  if (text.length > 300) score += 5;
  if (text.length > 800) score += 5;
  score = Math.max(0, Math.min(100, score));
  const summary =
    highlights.length === 0 && frictions.length === 0
      ? "Not much to grab onto in this profile yet. Ask one specific question and re-score."
      : `Found ${highlights.length} signal${highlights.length === 1 ? "" : "s"} worth leaning on and ${frictions.length} thing${frictions.length === 1 ? "" : "s"} to watch.`;
  return { score, highlights, frictions, summary };
}

interface ExternalReadAiOutput {
  score: number;
  highlights: string[];
  frictions: string[];
  summary: string;
}

function coerceExternalReadAi(value: unknown): ExternalReadAiOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const rawScore = typeof v.score === "number" ? v.score : Number(v.score);
  if (!Number.isFinite(rawScore)) return null;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const toStringArray = (x: unknown): string[] =>
    Array.isArray(x)
      ? x.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 6)
      : [];
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  if (summary.length === 0) return null;
  return {
    score,
    highlights: toStringArray(v.highlights),
    frictions: toStringArray(v.frictions),
    summary,
  };
}

router.post("/me/matching/external-read", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateMatchingExternalReadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const deterministic = deterministicExternalRead(parsed.data.profileText);

  // Forward loop: feed the user's own recent date outcomes AND everything the
  // signal registry knows about them into the read, so the coach leans toward
  // what fits this specific person. The "what we know" block is assembled from
  // the registry, so any newly added signal source shows up here automatically.
  const [outcomeInsight, readiness] = await Promise.all([
    computeOutcomeInsightForUser(userId),
    computeReadiness(userId),
  ]);
  const knownSignals = describeActiveSignals(readiness.breakdown);

  const systemLines = [
    "You are Echo, a candid dating coach reading an external dating-app profile",
    "(Hinge/Tinder/Bumble) the user has pasted in. Score how worth-engaging this",
    "profile looks for them, name specific signals, name specific frictions, and",
    "give a 2-3 sentence read in plain spoken English.",
  ];
  if (knownSignals.length > 0) {
    systemLines.push(
      "What the machine already knows about this user (use it to judge fit for them specifically, do not repeat it back):",
      ...knownSignals.map((line) => `- ${line}`),
    );
  }
  if (outcomeInsight.totalDates > 0) {
    systemLines.push(
      `Context on this user's recent dates: ${outcomeInsight.anotherDate} led to another date, ${outcomeInsight.noMore} were a no, ${outcomeInsight.ghosted} ghosted, ${outcomeInsight.unsure} unsure. Use this to judge fit, but read the pasted profile on its own merits.`,
    );
  }
  systemLines.push(
    "Voice rules: no em dashes. No filler like 'unlock', 'elevate', 'dive in',",
    "'game-changer', 'in today's world', 'seamless', 'buckle up'. Vary sentence",
    "length. Be specific, not generic.",
    "Return JSON only, no prose, no code fences:",
    '{ "score": 0-100 integer,',
    '  "highlights": ["3-6 specific things in the profile worth leaning on"],',
    '  "frictions": ["1-4 specific things to watch out for, or empty"],',
    '  "summary": "2-3 sentence Echo-voice read" }',
  );
  const system = systemLines.join("\n");

  const aiResult = await generate(
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user: parsed.data.profileText,
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 1024,
    },
    "",
  );

  let final: ExternalReadAiOutput = deterministic;
  let usedAi = false;
  if (!aiResult.isFallback && aiResult.output) {
    const raw = aiResult.raw ?? aiResult.output;
    const { value } = parseStructured<unknown>(raw, null);
    const coerced = coerceExternalReadAi(value);
    if (coerced) {
      final = coerced;
      usedAi = true;
    } else {
      req.log.warn(
        { userId, fallbackReason: "schema_validation_failed" },
        "matching.external-read AI output failed to validate; using deterministic baseline",
      );
    }
  } else if (aiResult.fallbackReason) {
    req.log.info(
      { userId, fallbackReason: aiResult.fallbackReason },
      "matching.external-read fell back to deterministic baseline",
    );
  }

  await db.insert(compatibilityReadsTable).values({
    userId,
    sourceKind: "paste",
    rawText: parsed.data.profileText,
    parsedProfile: {
      externalSource: parsed.data.source,
      via: "matching_external",
    },
    resultJson: {
      deterministicResult: deterministic,
      aiResult: usedAi ? final : null,
    },
    overallAlignment: final.score,
    mode: "matching_external",
  });

  await db.insert(matchProposalsTable).values({
    userId,
    proposedToUserId: null,
    source: "external_paste",
    compatibilityScore: final.score,
    summary: final.summary,
    status: "proposed",
  });

  void recordJourneyEvent({
    eventType: "match_step",
    userId,
    props: { step: "proposal_created", source: "external_paste", score: final.score },
  });

  res.json(final);
});

router.get("/me/matching/proposals", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(matchProposalsTable)
    .where(eq(matchProposalsTable.userId, req.user.id))
    .orderBy(desc(matchProposalsTable.createdAt))
    .limit(50);
  res.json(rows.map(serializeProposal));
});

function coerceEchoMatchReadAi(value: unknown): {
  headline: string;
  reading: string[];
  idealMatch: string[];
} | null {
  const parsed = echoMatchReadSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    headline: parsed.data.headline.trim(),
    reading: parsed.data.reading.map((s) => s.trim()).slice(0, 5),
    idealMatch: parsed.data.idealMatch.map((s) => s.trim()).slice(0, 4),
  };
}

router.post("/me/matching/echo", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const [prefs, readiness, threshold, outcome] = await Promise.all([
    loadPreferences(userId),
    computeReadiness(userId),
    readinessThreshold(),
    computeOutcomeInsightForUser(userId),
  ]);
  const eligible = readiness.score >= threshold;
  const activeSignalLines = describeActiveSignals(readiness.breakdown);
  const coveredLanes = SIGNAL_REGISTRY.filter(
    (c) => (readiness.breakdown[c.id] ?? 0) > 0,
  ).map((c) => c.id);
  const nextActions = computeNextActions(
    readiness.breakdown,
    eligible,
    1,
    readiness.weights,
  );
  const topAction = nextActions[0]
    ? { label: nextActions[0].label, href: nextActions[0].href }
    : null;

  // Always-on deterministic baseline. Everything below works from aggregate
  // coverage only, never raw content.
  const baseline = buildEchoMatchRead({
    score: readiness.score,
    threshold,
    eligible,
    activeSignalLines,
    coveredLanes,
    totalLanes: SIGNAL_REGISTRY.length,
    outcome: {
      totalDates: outcome.totalDates,
      anotherDate: outcome.anotherDate,
      noMore: outcome.noMore,
      ghosted: outcome.ghosted,
    },
    radiusKm: prefs?.distanceKm ?? null,
    nextAction: topAction,
  });

  // Claude layer: opt-in via content consent, daily-capped, aggregate-only. It
  // only enriches the prose (headline + reading + idealMatch). The computed
  // confidence, gap, radius, and next step always come from the baseline.
  const systemLines = [
    "You are Echo, a candid dating coach giving the user your read on THEM for",
    "matching: what you can see in the signals they have fed you so far, and the",
    "kind of person you would put in front of them. Speak directly to the user.",
    "You are working only from aggregate signal coverage, never their raw content.",
  ];
  if (activeSignalLines.length > 0) {
    systemLines.push(
      "What the machine can see about this user (aggregate only, do not invent specifics):",
      ...activeSignalLines.map((line) => `- ${line}`),
    );
  } else {
    systemLines.push(
      "The machine can barely see this user yet: they have fed almost no signal.",
    );
  }
  if (outcome.totalDates > 0) {
    systemLines.push(
      `Aggregate recent date outcomes: ${outcome.anotherDate} led to another date, ${outcome.noMore} were a no, ${outcome.ghosted} ghosted, ${outcome.unsure} unsure.`,
    );
  }
  systemLines.push(
    `Their search radius reads as "${baseline.radiusLabel}". They are ${eligible ? "already eligible for the matching pool" : `${baseline.gapToPool} readiness points away from the pool`}.`,
    "Voice rules: no em dashes. No filler like 'unlock', 'elevate', 'dive in',",
    "'game-changer', 'in today's world', 'seamless', 'buckle up'. Be specific",
    "about fit, never describe a real individual, never repeat raw content.",
    "Return JSON only, no prose, no code fences:",
    '{ "headline": "one line, who you would put in front of them",',
    '  "reading": ["2-4 short lines on what you can see in them"],',
    '  "idealMatch": ["2-4 short lines on the kind of person that fits them"] }',
  );

  const aiResult = await generate(
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system: systemLines.join("\n"),
      user: "Give me your read for matching.",
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 1024,
      context: { toolName: "Echo Match Read" },
    },
    "",
  );

  let final: EchoMatchRead = baseline;
  let usedAi = false;
  if (!aiResult.isFallback && aiResult.output) {
    const raw = aiResult.raw ?? aiResult.output;
    const { value } = parseStructured<unknown>(raw, null);
    const coerced = coerceEchoMatchReadAi(value);
    if (coerced) {
      final = {
        ...baseline,
        headline: coerced.headline,
        reading: coerced.reading,
        idealMatch: coerced.idealMatch,
      };
      usedAi = true;
    } else {
      req.log.warn(
        { userId, fallbackReason: "schema_validation_failed" },
        "matching.echo AI output failed to validate; using deterministic baseline",
      );
    }
  } else if (aiResult.fallbackReason) {
    req.log.info(
      { userId, fallbackReason: aiResult.fallbackReason },
      "matching.echo fell back to deterministic baseline",
    );
  }

  res.json({ ...final, usedAi });
});

router.put(
  "/me/matching/proposals/:id/response",
  async (req, res): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const id = String(req.params.id ?? "");
    if (!id) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    const parsed = RespondToMatchProposalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = req.user.id;
    const existing = await db
      .select()
      .from(matchProposalsTable)
      .where(
        and(
          eq(matchProposalsTable.id, id),
          eq(matchProposalsTable.userId, userId),
        ),
      )
      .limit(1);
    const row = existing[0];
    if (!row) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    // Only a still-open proposal can be responded to. Anything the founder has
    // already advanced (or the user has already answered) is left untouched.
    if (row.status !== "proposed") {
      res.json(serializeProposal(row));
      return;
    }
    const nextStatus = parsed.data.interested ? "user_yes" : "user_no";
    // Carry the ownership + "still proposed" guard into the UPDATE predicate so
    // the transition is atomic. If a founder or another request advanced the
    // proposal between the read above and here, no row matches and we return the
    // current state instead of clobbering it.
    const [updated] = await db
      .update(matchProposalsTable)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(
        and(
          eq(matchProposalsTable.id, id),
          eq(matchProposalsTable.userId, userId),
          eq(matchProposalsTable.status, "proposed"),
        ),
      )
      .returning();
    if (!updated) {
      const [current] = await db
        .select()
        .from(matchProposalsTable)
        .where(
          and(
            eq(matchProposalsTable.id, id),
            eq(matchProposalsTable.userId, userId),
          ),
        )
        .limit(1);
      if (!current) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }
      res.json(serializeProposal(current));
      return;
    }
    // "It's a match" moment: when this is a yes on an internal (member-to-member)
    // proposal, check the mirror row created at discover time. If the other side
    // already said yes, flip BOTH to mutual_yes atomically.
    let finalRow = updated;
    if (
      nextStatus === "user_yes" &&
      updated.source === "internal" &&
      updated.proposedToUserId
    ) {
      const reciprocal = await db
        .select()
        .from(matchProposalsTable)
        .where(
          and(
            eq(matchProposalsTable.source, "internal"),
            eq(matchProposalsTable.userId, updated.proposedToUserId),
            eq(matchProposalsTable.proposedToUserId, updated.userId),
          ),
        )
        .orderBy(desc(matchProposalsTable.createdAt))
        .limit(1);
      const other = reciprocal[0];
      if (other && other.status === "user_yes") {
        const ts = new Date();
        await db
          .update(matchProposalsTable)
          .set({ status: "mutual_yes", updatedAt: ts })
          .where(inArray(matchProposalsTable.id, [updated.id, other.id]));
        finalRow = { ...updated, status: "mutual_yes", updatedAt: ts };
        void recordJourneyEvent({
          eventType: "match_step",
          userId,
          props: { step: "mutual_yes", proposalId: updated.id },
        });
      }
    }
    req.log.info(
      { proposalId: id, status: finalRow.status },
      "matching.proposal user response recorded",
    );
    res.json(serializeProposal(finalRow));
  },
);

// Caps so a single discover call stays bounded: we never scan the whole pool,
// and we only ever mint a small handful of fresh intros per run.
const MAX_DISCOVER_CANDIDATES = 50;
const MAX_NEW_PROPOSALS = 3;

// Radius preferences are stored in km (the UI presets are km-based); the geo
// engine reasons in miles. One conversion constant, used wherever a stored
// distanceKm needs to become the engine's radiusMiles.
const MILES_PER_KM = 0.621371;

// Latest self-reported age/gender per user, read from the most recent audit row.
// These are the only places this data lives today; absence is expected and
// degrades to a lower-confidence match rather than a hard block.
async function loadLatestAuditDemographics(
  userIds: string[],
): Promise<Map<string, { age: number | null; gender: string | null }>> {
  const out = new Map<string, { age: number | null; gender: string | null }>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({
      userId: auditsTable.userId,
      age: auditsTable.age,
      gender: auditsTable.gender,
    })
    .from(auditsTable)
    .where(inArray(auditsTable.userId, userIds))
    .orderBy(desc(auditsTable.createdAt));
  for (const row of rows) {
    if (!row.userId || out.has(row.userId)) continue;
    out.set(row.userId, {
      age: row.age ?? null,
      gender: row.gender ?? null,
    });
  }
  return out;
}

// Assemble the engine's view of one member: preferences, computed readiness, and
// best-available demographics. Everything here is aggregate, never raw content.
async function buildMatchCandidate(
  userId: string,
  demographics: { age: number | null; gender: string | null } | undefined,
): Promise<MatchCandidate> {
  const [prefs, readiness] = await Promise.all([
    loadPreferences(userId),
    computeReadiness(userId),
  ]);
  return {
    userId,
    age: demographics?.age ?? null,
    gender: demographics?.gender ?? null,
    prefs: {
      ageMin: prefs?.ageMin ?? null,
      ageMax: prefs?.ageMax ?? null,
      genderPreference: prefs?.genderPreference ?? null,
      cityHint: prefs?.cityHint ?? null,
      radiusMiles:
        prefs?.distanceKm != null ? prefs.distanceKm * MILES_PER_KM : null,
    },
    readinessScore: readiness.score,
    breakdown: readiness.breakdown as unknown as Record<string, number>,
  };
}

// Core of the internal matching engine, shared by the on-demand discover route
// and the background auto-proposal job. Assumes the caller is already a live
// pool member. Pairs them with other live members, scores deterministically,
// and mints mutual internal proposals. Returns how many new matches were minted.
// Idempotent by construction: the partial unique index on internal
// (userId, proposedToUserId) pairs + ON CONFLICT DO NOTHING drop re-proposals.
export async function mintInternalProposalsForMember(
  userId: string,
): Promise<number> {
  // Eligible counterparts are other members actively in the pool. concierge_only
  // (Wingman, founder-curated) is intentionally left out of automated pairing.
  const memberRows = await db
    .select({ userId: matchPoolMembershipTable.userId })
    .from(matchPoolMembershipTable)
    .where(inArray(matchPoolMembershipTable.status, ["building", "ready"]))
    .limit(MAX_DISCOVER_CANDIDATES + 1);
  const otherUserIds = memberRows
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id) && id !== userId)
    .slice(0, MAX_DISCOVER_CANDIDATES);

  // Existing internal pairings (either direction) so we never double-propose.
  const existingInternal = await db
    .select({
      userId: matchProposalsTable.userId,
      proposedToUserId: matchProposalsTable.proposedToUserId,
    })
    .from(matchProposalsTable)
    .where(
      and(
        eq(matchProposalsTable.source, "internal"),
        sql`(${matchProposalsTable.userId} = ${userId} OR ${matchProposalsTable.proposedToUserId} = ${userId})`,
      ),
    );
  const alreadyPaired = new Set<string>();
  for (const row of existingInternal) {
    if (row.userId && row.userId !== userId) alreadyPaired.add(row.userId);
    if (row.proposedToUserId && row.proposedToUserId !== userId) {
      alreadyPaired.add(row.proposedToUserId);
    }
  }
  const freshIds = otherUserIds.filter((id) => !alreadyPaired.has(id));
  if (freshIds.length === 0) return 0;

  const demographics = await loadLatestAuditDemographics([userId, ...freshIds]);
  const me = await buildMatchCandidate(userId, demographics.get(userId));
  const others = await Promise.all(
    freshIds.map((id) => buildMatchCandidate(id, demographics.get(id))),
  );
  const ranked = rankCandidates(me, others, MAX_NEW_PROPOSALS);
  if (ranked.length === 0) return 0;

  // Each match is a mirrored pair of internal proposals (one row per member)
  // sharing the same symmetric score and summary. The summary is generic by
  // construction, so no PII or raw content is ever stored on a proposal.
  const values = ranked.flatMap((r) => [
    {
      userId,
      proposedToUserId: r.candidate.userId,
      source: "internal" as const,
      compatibilityScore: r.score,
      summary: r.summary,
      status: "proposed" as const,
    },
    {
      userId: r.candidate.userId,
      proposedToUserId: userId,
      source: "internal" as const,
      compatibilityScore: r.score,
      summary: r.summary,
      status: "proposed" as const,
    },
  ]);
  // ON CONFLICT DO NOTHING against the partial unique index on internal
  // (userId, proposedToUserId) pairs makes this idempotent and race-safe:
  // a concurrent run that already minted the same pair is dropped here
  // instead of creating duplicates.
  await db.insert(matchProposalsTable).values(values).onConflictDoNothing();
  void recordJourneyEvent({
    eventType: "match_step",
    userId,
    props: {
      step: "proposal_created",
      source: "internal",
      count: ranked.length,
    },
  });
  return ranked.length;
}

// The internal matching engine in route form: pair the caller with other live
// pool members, score deterministically, and mint mutual internal proposals.
router.post("/me/matching/discover", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const membership = await loadMembership(userId);
  const inPool =
    membership != null &&
    (membership.status === "building" || membership.status === "ready");
  if (!inPool) {
    res.status(422).json({
      error:
        "Turn on the matching pool first. Once your readiness clears the bar and the pool is on, we can pair you with other members.",
    });
    return;
  }

  await mintInternalProposalsForMember(userId);

  const rows = await db
    .select()
    .from(matchProposalsTable)
    .where(eq(matchProposalsTable.userId, userId))
    .orderBy(desc(matchProposalsTable.createdAt))
    .limit(50);
  res.json(rows.map(serializeProposal));
});

export default router;
