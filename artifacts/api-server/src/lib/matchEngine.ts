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

import { proximityBetween } from "./geo";

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
  };
  /** Readiness score 0-100. */
  readinessScore: number;
  /** Per-lane readiness coverage, laneId -> 0-100. */
  breakdown: Record<string, number>;
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

/** True when both members' hard preferences (gender, age) admit each other. */
export function gatesPass(a: MatchCandidate, b: MatchCandidate): boolean {
  return (
    genderPrefAdmits(a.prefs.genderPreference, b.gender) &&
    genderPrefAdmits(b.prefs.genderPreference, a.gender) &&
    agePrefAdmits(a.prefs.ageMin, a.prefs.ageMax, b.age) &&
    agePrefAdmits(b.prefs.ageMin, b.prefs.ageMax, a.age)
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

// Component weights. They sum to 1.0 so the blended score lands in 0-1 before we
// scale to 0-100. Tuned so two well-developed, similarly-ready people in the
// same area score high, and shared explorable depth matters most.
const WEIGHTS = {
  proximity: 0.25,
  sharedDepth: 0.3,
  readinessSimilarity: 0.2,
  readinessDepth: 0.25,
} as const;

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

  const blend =
    WEIGHTS.proximity * proximity +
    WEIGHTS.sharedDepth * sharedDepth +
    WEIGHTS.readinessSimilarity * readinessSimilarity +
    WEIGHTS.readinessDepth * readinessDepth;
  const score = Math.max(0, Math.min(100, Math.round(blend * 100)));

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
