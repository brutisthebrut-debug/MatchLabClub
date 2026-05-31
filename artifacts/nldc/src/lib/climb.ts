import {
  buildMilestones,
  nextMilestone,
  type MilestoneIconKey,
  type MilestoneSpec,
} from "@/lib/milestones";

// The climb is the gamified lens over Match Readiness. It does NOT change how
// the readiness score is computed; it reframes that one number as a journey with
// named levels, a current stage, and unlocks that reveal more depth as the
// machine learns more about you. Every surface (Home, Mirror, nav, the
// Milestones page) derives its climb view from this single model so they always
// agree.

export interface ClimbUnlock {
  threshold: number;
  title: string;
  /** Plain-English description of the depth this step reveals. */
  unlocks: string;
  iconKey: MilestoneIconKey;
  unlocked: boolean;
}

export interface ClimbState {
  score: number;
  threshold: number;
  /** How many levels (milestones) the user has cleared. */
  level: number;
  /** Total levels on the climb. */
  totalLevels: number;
  /** The highest level cleared, or the starting stage when none are. */
  stageTitle: string;
  stageBlurb: string;
  /** The next level to clear, undefined when the climb is topped out. */
  next?: ClimbUnlock;
  /** Readiness points still needed to clear the next level (0 when topped out). */
  pointsToNext: number;
  /** Progress within the current band toward the next level, 0 to 100. */
  progressToNextPct: number;
  /** True once the introductions pool is open (score at or above threshold). */
  eligible: boolean;
  /** Every level on the climb, with its unlocked state. */
  unlocks: ClimbUnlock[];
}

// What each level reveals, keyed by the milestone's icon. Framed as depth the
// machine opens up, never as a tool being hidden from the user.
const UNLOCK_COPY: Record<MilestoneIconKey, string> = {
  first:
    "A personal Mirror portrait, your Signal Score, and your first pattern reads.",
  patterns:
    "Trend lines, sharper compass reads, and coaching that leans on how you actually connect.",
  ready:
    "The introductions pool opens. You become eligible for AI-driven matches with people near you.",
  dialed:
    "The deepest reads and matches you would never have found on your own.",
};

const STARTING_STAGE = {
  title: "Getting started",
  blurb: "Feed your first signal and the machine starts learning who you are.",
};

function toUnlock(m: MilestoneSpec, score: number): ClimbUnlock {
  return {
    threshold: m.threshold,
    title: m.title,
    unlocks: UNLOCK_COPY[m.iconKey],
    iconKey: m.iconKey,
    unlocked: score >= m.threshold,
  };
}

/**
 * Derive the full climb view from the readiness score and the match-ready
 * threshold (both come straight from the matching state). Pure and DB-free.
 */
export function computeClimb(score: number, threshold: number): ClimbState {
  const safeScore = Number.isFinite(score)
    ? Math.min(100, Math.max(0, Math.round(score)))
    : 0;
  const milestones = buildMilestones(threshold);
  const unlocks = milestones.map((m) => toUnlock(m, safeScore));
  const cleared = unlocks.filter((u) => u.unlocked);
  const next = unlocks.find((u) => !u.unlocked);

  const current = cleared[cleared.length - 1];
  const stageTitle = current ? current.title : STARTING_STAGE.title;
  const stageBlurb = current
    ? (milestones.find((m) => m.title === current.title)?.blurb ??
      STARTING_STAGE.blurb)
    : STARTING_STAGE.blurb;

  // Progress within the current band: from the last cleared threshold (or 0) up
  // to the next one. Topped out reads as a full bar.
  const bandStart = current ? current.threshold : 0;
  const bandEnd = next ? next.threshold : 100;
  const span = Math.max(1, bandEnd - bandStart);
  const progressToNextPct = next
    ? Math.min(100, Math.max(0, Math.round(((safeScore - bandStart) / span) * 100)))
    : 100;

  const readyThreshold = unlocks.find((u) => u.iconKey === "ready")?.threshold;

  return {
    score: safeScore,
    threshold: readyThreshold ?? threshold,
    level: cleared.length,
    totalLevels: unlocks.length,
    stageTitle,
    stageBlurb,
    next,
    pointsToNext: next ? Math.max(0, next.threshold - safeScore) : 0,
    progressToNextPct,
    eligible: readyThreshold !== undefined ? safeScore >= readyThreshold : false,
    unlocks,
  };
}
