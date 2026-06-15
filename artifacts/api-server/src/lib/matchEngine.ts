// Deterministic internal matching engine.
//
// This is the always-on, no-keys-required heart of "matching people". It takes
// two pool members described only by their AGGREGATE signal coverage and their
// stated preferences (never raw content) and produces a symmetric compatibility
// score plus a plain-English reason set. No DB access, no AI calls. The route
// layer (routes/matching.ts) is responsible for loading candidates and writing
// proposals; this module is pure so it can be unit tested in isolation.
//
// Symmetry is a hard invariant: scoreCompatibility(a, b) must equal
// scoreCompatibility(b, a), because both members see the same compatibility
// number on the same proposed pair.

import { proximityBetween, canonicalizeCity } from "./geo";
import { CARE_DIALECT_KEYS } from "./careDialect";

export interface MatchCandidate {
  userId: string;
  /** Self-reported age (from the latest profile audit), or null if unknown. */
  age: number | null;
  /** Self-reported gender (from the latest profile audit), or null if unknown. */
  gender: string | null;
  prefs: {
    ageMin: number | null;
    ageMax: number | null;
    genderPreference: string | null;
    cityHint: string | null;
    /**
     * Max distance this member is willing to match across, in miles. Null/absent
     * means "no explicit cap"; the radius gate then falls back to
     * DEFAULT_RADIUS_MILES so an unset preference still respects a sane bound.
     */
    radiusMiles?: number | null;
    /**
     * Whether this member opted into relocation-based matching (Cosmic Compass).
     * When true, their `loveLineCities` can bridge the radius gate. Absent/false
     * leaves the gate exactly as it was.
     */
    relocationOpen?: boolean;
    /**
     * Canonical gazetteer keys of this member's astrocartography love-line
     * cities. Only consulted when `relocationOpen` is true. Empty/absent leaves
     * the gate unchanged.
     */
    loveLineCities?: string[];
  };
  /** Readiness score 0-100. */
  readinessScore: number;
  /** Per-lane readiness coverage, laneId -> 0-100. */
  breakdown: Record<string, number>;
  /**
   * Whether this member has cleared Trust & Safety verification (phone today).
   * Soft only: it nudges a verified pair's score up a touch so verified members
   * surface a little higher, but it is NEVER a gate. An unverified member is
   * matched exactly as before; verification widens trust, never narrows reach.
   */
  isVerified?: boolean;
  /**
   * Care Dialect distributions: how this member gives care and how they receive
   * it, each a normalized map over the six dialect keys. Null/absent when they
   * have not completed the Care Dialect quiz. Only the derived distributions are
   * carried here, never raw answers, and a counterpart's dialect is never named
   * in any reason string.
   */
  careDialect?: {
    give: Record<string, number>;
    receive: Record<string, number>;
  } | null;
}

export interface CompatibilityResult {
  score: number;
  reasons: string[];
  summary: string;
}

export interface RankedCandidate {
  candidate: MatchCandidate;
  score: number;
  reasons: string[];
  summary: string;
}

// Gender preference values that mean "open to everyone". Stored gender hints can
// be free text, so we normalize generously and treat anything we cannot read as
// open rather than silently excluding a real person.
const OPEN_GENDER_PREFS = new Set([
  "",
  "any",
  "anyone",
  "everyone",
  "all",
  "all genders",
  "no preference",
]);

type GenderBucket = "women" | "men" | "nonbinary" | "unknown";

function bucketGender(raw: string | null): GenderBucket {
  if (!raw) return "unknown";
  const g = raw.trim().toLowerCase();
  if (g.length === 0) return "unknown";
  if (["woman", "women", "female", "f", "femme", "girl", "lady"].includes(g)) {
    return "women";
  }
  if (["man", "men", "male", "m", "masc", "guy", "boy"].includes(g)) {
    return "men";
  }
  if (
    [
      "nonbinary",
      "non-binary",
      "non binary",
      "enby",
      "nb",
      "genderqueer",
      "genderfluid",
      "agender",
    ].includes(g)
  ) {
    return "nonbinary";
  }
  return "unknown";
}

function bucketGenderPreference(raw: string | null): GenderBucket | "open" {
  if (raw == null) return "open";
  const p = raw.trim().toLowerCase();
  if (OPEN_GENDER_PREFS.has(p)) return "open";
  // "trans-women"/"trans-men" are first-class options in the UI. We have no
  // dedicated trans flag on stored profiles, so we map them onto the women/men
  // umbrella (a trans woman is a woman): the gate still honors the direction of
  // the preference without excluding anyone we cannot positively identify.
  if (["women", "woman", "female", "trans-women", "trans women"].includes(p)) {
    return "women";
  }
  if (["men", "man", "male", "trans-men", "trans men"].includes(p)) {
    return "men";
  }
  if (["nonbinary", "non-binary", "non binary", "enby", "nb"].includes(p)) {
    return "nonbinary";
  }
  // An unreadable, non-empty preference is treated as open so we never exclude
  // someone on a value we cannot interpret.
  return "open";
}

// One direction of the gender gate: does `viewer`'s stated preference admit
// `target`'s gender? Open preferences and unknown target genders both pass, so
// a missing audit never hard-blocks a match (it only lowers confidence later).
function genderPrefAdmits(
  viewerPref: string | null,
  targetGender: string | null,
): boolean {
  const pref = bucketGenderPreference(viewerPref);
  if (pref === "open") return true;
  const target = bucketGender(targetGender);
  if (target === "unknown") return true;
  return pref === target;
}

// One direction of the age gate: does `viewer`'s age range admit `target`'s age?
// Unknown target age passes (degrade gracefully).
function agePrefAdmits(
  ageMin: number | null,
  ageMax: number | null,
  targetAge: number | null,
): boolean {
  if (targetAge == null) return true;
  if (ageMin != null && targetAge < ageMin) return false;
  if (ageMax != null && targetAge > ageMax) return false;
  return true;
}

// The radius gate: a measured distance between the two members must fall within
// the tighter of their two radius preferences. This is a HARD filter, unlike the
// graded `proximity` component in scoreCompatibility (which only nudges the
// score). It is symmetric because it uses the symmetric proximityBetween and the
// min of both radii. Two graceful-degradation rules keep it from excluding real
// people on data we do not have: (1) if we cannot measure a real distance (one
// or both cities unresolvable), the gate passes; (2) if NEITHER side has set a
// radius, the gate passes (we only hard-filter on a preference a member actually
// expressed; the graded proximity component still nudges the score).
export function radiusGatePasses(a: MatchCandidate, b: MatchCandidate): boolean {
  // Relocation-openness bridge: a member who opted into relocation can reach
  // anyone living in one of their astrocartography love-line cities, even past
  // their radius cap. This only ever WIDENS the gate and is symmetric (either
  // side opting in is enough), so pairs the old gate already passed still pass.
  if (loveLineBridges(a, b) || loveLineBridges(b, a)) return true;
  const prox = proximityBetween(a.prefs.cityHint, b.prefs.cityHint);
  if (prox.distanceMiles == null) return true;
  const radii = [a.prefs.radiusMiles, b.prefs.radiusMiles].filter(
    (r): r is number => typeof r === "number" && r > 0,
  );
  if (radii.length === 0) return true;
  return prox.distanceMiles <= Math.min(...radii);
}

// True when `mover` opted into relocation and `other` lives in one of `mover`'s
// love-line cities. Love-line cities are canonical gazetteer keys, so we
// canonicalize the other member's city hint before comparing. Anything missing
// (no opt-in, no cities, unresolvable city) returns false and changes nothing.
function loveLineBridges(
  mover: MatchCandidate,
  other: MatchCandidate,
): boolean {
  if (!mover.prefs.relocationOpen) return false;
  const cities = mover.prefs.loveLineCities;
  if (!cities || cities.length === 0) return false;
  const target = canonicalizeCity(other.prefs.cityHint);
  if (target.length === 0) return false;
  return cities.includes(target);
}

/**
 * True when both members' hard preferences admit each other: gender, age, and
 * the radius cap (a measurable distance within the tighter of the two radii).
 */
export function gatesPass(a: MatchCandidate, b: MatchCandidate): boolean {
  return (
    genderPrefAdmits(a.prefs.genderPreference, b.gender) &&
    genderPrefAdmits(b.prefs.genderPreference, a.gender) &&
    agePrefAdmits(a.prefs.ageMin, a.prefs.ageMax, b.age) &&
    agePrefAdmits(b.prefs.ageMin, b.prefs.ageMax, a.age) &&
    radiusGatePasses(a, b)
  );
}

function coveredLanes(breakdown: Record<string, number>): Set<string> {
  const out = new Set<string>();
  for (const [lane, value] of Object.entries(breakdown)) {
    if (typeof value === "number" && value > 0) out.add(lane);
  }
  return out;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Component weights. Each set sums to 1.0 so the blended score lands in 0-1
// before we scale to 0-100. Tuned so two well-developed, similarly-ready people
// in the same area score high, and shared explorable depth matters most.
//
// WEIGHTS_BASE is the original blend, used whenever Care Dialect data is missing
// on either side so a dataless pair scores EXACTLY as it did before this signal
// existed. WEIGHTS_WITH_STYLE makes room for the styleFit component only when
// both members have completed the quiz, shaving a little off every other
// component so the totals still sum to 1.0.
const WEIGHTS_BASE = {
  proximity: 0.25,
  sharedDepth: 0.3,
  readinessSimilarity: 0.2,
  readinessDepth: 0.25,
} as const;

const WEIGHTS_WITH_STYLE = {
  proximity: 0.22,
  sharedDepth: 0.265,
  readinessSimilarity: 0.175,
  readinessDepth: 0.22,
  styleFit: 0.12,
} as const;

// Dot product of two dialect distributions over the six keys. Both are
// normalized (values sum to ~1), so the result lands in 0-1 and peaks when one
// person's giving lines up with the other's receiving.
function dialectDot(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let sum = 0;
  for (const k of CARE_DIALECT_KEYS) sum += (a[k] ?? 0) * (b[k] ?? 0);
  return sum;
}

// Similarity between two distributions: 1 minus half the L1 distance, so
// identical distributions score 1 and fully disjoint ones score 0. Symmetric.
function dialectSim(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let l1 = 0;
  for (const k of CARE_DIALECT_KEYS) l1 += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return clamp01(1 - l1 / 2);
}

// A distribution counts as "present" only when it carries positive mass, so an
// all-zero map (an untested axis) never reads as complete.
function isDist(
  d: Record<string, number> | undefined | null,
): d is Record<string, number> {
  if (!d) return false;
  let sum = 0;
  for (const k of CARE_DIALECT_KEYS) sum += d[k] ?? 0;
  return sum > 0;
}

/**
 * Care-style complementarity 0-1, or null when EITHER member is missing tested
 * Care Dialect data (so the score falls back to the exact pre-Care-Dialect
 * blend). Rewards each person giving care the way the other likes to receive it,
 * with a small bonus for a shared sense of what feeling cared for is like.
 * Symmetric in a and b by construction.
 */
function styleFitBetween(
  a: MatchCandidate,
  b: MatchCandidate,
): number | null {
  const ag = a.careDialect?.give;
  const ar = a.careDialect?.receive;
  const bg = b.careDialect?.give;
  const br = b.careDialect?.receive;
  if (!isDist(ag) || !isDist(ar) || !isDist(bg) || !isDist(br)) return null;
  const aGivesAsBReceives = dialectDot(ag, br);
  const bGivesAsAReceives = dialectDot(bg, ar);
  const sharedReceiving = dialectSim(ar, br);
  return clamp01(
    0.45 * aGivesAsBReceives + 0.45 * bGivesAsAReceives + 0.1 * sharedReceiving,
  );
}

/**
 * Symmetric 0-100 compatibility between two members, derived only from aggregate
 * signal coverage and stated preferences. Returns the score, a generic
 * (no-PII) reason set, and a one-line summary suitable for storing on a
 * proposal. Callers should run gatesPass first; this still returns a score for
 * any pair so it can rank, but pairs that fail the gates should not be proposed.
 */
export function scoreCompatibility(
  a: MatchCandidate,
  b: MatchCandidate,
): CompatibilityResult {
  // Graded geographic proximity. Resolvable cities get real great-circle
  // distance; unresolvable ones fall back to alias-aware name equality. Distance
  // is derived only from the coarse city hint, so it carries no PII and is safe
  // to surface in reasons. proximityBetween is symmetric in its two arguments.
  const prox = proximityBetween(a.prefs.cityHint, b.prefs.cityHint);
  const proximity = prox.score;

  const lanesA = coveredLanes(a.breakdown);
  const lanesB = coveredLanes(b.breakdown);
  let shared = 0;
  for (const lane of lanesA) if (lanesB.has(lane)) shared += 1;
  const union = new Set([...lanesA, ...lanesB]).size;
  const sharedDepth = union === 0 ? 0 : clamp01(shared / union);

  const scoreA = clamp01(a.readinessScore / 100);
  const scoreB = clamp01(b.readinessScore / 100);
  const readinessSimilarity = clamp01(1 - Math.abs(scoreA - scoreB));
  const readinessDepth = clamp01((scoreA + scoreB) / 2);

  // Care-style complementarity, only when both members completed the quiz. When
  // it is null we use the original weights and omit the term entirely, so a pair
  // without Care Dialect data scores exactly as it did before this signal.
  const styleFit = styleFitBetween(a, b);
  const useStyle = styleFit !== null;
  const W = useStyle ? WEIGHTS_WITH_STYLE : WEIGHTS_BASE;
  const blend =
    W.proximity * proximity +
    W.sharedDepth * sharedDepth +
    W.readinessSimilarity * readinessSimilarity +
    W.readinessDepth * readinessDepth +
    (useStyle ? WEIGHTS_WITH_STYLE.styleFit * (styleFit as number) : 0);
  // Soft verification nudge: each verified side adds a small symmetric bonus, so
  // a verified pair ranks a little higher than an otherwise-identical unverified
  // pair. This is NOT a gate (gatesPass never reads verification) and it can only
  // raise a score, never lower it, so an unverified member is matched exactly as
  // before. Symmetric in a and b, and clamped, so the invariant holds.
  const VERIFIED_BONUS_PER_SIDE = 0.02;
  const verifiedBonus =
    ((a.isVerified ? 1 : 0) + (b.isVerified ? 1 : 0)) *
    VERIFIED_BONUS_PER_SIDE;
  const score = Math.max(
    0,
    Math.min(100, Math.round((blend + verifiedBonus) * 100)),
  );

  const reasons: string[] = [];
  if (prox.distanceMiles != null) {
    if (prox.distanceMiles <= 15) {
      reasons.push("You're right in the same area");
    } else if (prox.score > 0) {
      const approx = Math.max(5, Math.round(prox.distanceMiles / 5) * 5);
      reasons.push(`You're about ${approx} miles apart, close enough to meet`);
    }
  } else if (prox.sameCanonicalCity) {
    reasons.push("You're both in the same area");
  }
  if (shared > 0) {
    reasons.push(
      `You've both built depth in ${shared} of the same area${shared === 1 ? "" : "s"}`,
    );
  }
  if (readinessSimilarity >= 0.8) {
    reasons.push("You're at similar points in your readiness");
  }
  if (readinessDepth >= 0.7) {
    reasons.push("You're both well into your readiness climb");
  }
  // Care-style fit, phrased so it never names or hints at the counterpart's
  // dialect: it only ever describes the fit between the two of you.
  if (useStyle) {
    const sf = styleFit as number;
    if (sf >= 0.6) {
      reasons.push(
        "Your care styles fit closely, you each tend to give what the other most wants",
      );
    } else if (sf >= 0.4) {
      reasons.push("Your care styles complement each other");
    }
  }
  // Degrade-gracefully note: if either side is missing the audit data the gates
  // rely on, say so plainly instead of pretending the match is fully vetted.
  const missingProfile =
    a.age == null ||
    a.gender == null ||
    b.age == null ||
    b.gender == null;
  if (missingProfile) {
    reasons.push("Add a profile audit to sharpen this match");
  }
  if (reasons.length === 0) {
    reasons.push("Early read, keep feeding signals to sharpen it");
  }

  const summary = `${score}% read. ${reasons.slice(0, 3).join(". ")}.`;

  return { score, reasons, summary };
}

/**
 * Rank `others` against `me` by compatibility, keeping only pairs that clear the
 * hard gates. Deterministic: ties break by userId ascending so the same pool
 * always yields the same ordering.
 */
export function rankCandidates(
  me: MatchCandidate,
  others: MatchCandidate[],
  limit: number,
): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const other of others) {
    if (other.userId === me.userId) continue;
    if (!gatesPass(me, other)) continue;
    const result = scoreCompatibility(me, other);
    ranked.push({
      candidate: other,
      score: result.score,
      reasons: result.reasons,
      summary: result.summary,
    });
  }
  ranked.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return x.candidate.userId < y.candidate.userId ? -1 : 1;
  });
  return ranked.slice(0, Math.max(0, limit));
}
