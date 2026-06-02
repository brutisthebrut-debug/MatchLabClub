// Achievements / unlocks: a deterministic, derived gamification layer on top of
// the readiness climb. Like streak.ts this file is DB-free and pure so it is easy
// to reason about and unit test: a route gathers the small set of aggregate
// numbers a user has earned (signals fed, tools completed, current streak, Mirror
// areas mapped, readiness score) and hands them here. Nothing in this file reads
// raw user content, and it NEVER feeds the readiness score; it only reflects
// progress the user has already made back to them as unlockable badges.

export type AchievementTier = "bronze" | "silver" | "gold";

export type AchievementMetric =
  | "signalsFed"
  | "toolsCompleted"
  | "currentStreak"
  | "lanesMapped"
  | "readiness";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** lucide-react icon name, resolved on the client. */
  icon: string;
  tier: AchievementTier;
  metric: AchievementMetric;
  /**
   * Fixed unlock target. Omitted only for the dynamic "match ready" unlock,
   * whose target is the founder-tunable readiness threshold at compute time.
   */
  target?: number;
  /** Short noun for progress copy, e.g. "3 of 10 signals". */
  unit: string;
}

export interface AchievementInputs {
  signalsFed: number;
  toolsCompleted: number;
  currentStreak: number;
  lanesMapped: number;
  readinessScore: number;
  readinessThreshold: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  unit: string;
  target: number;
  progress: number;
  unlocked: boolean;
}

export interface UserAchievements {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
}

// One entry per unlock. Ordered roughly by the journey: first signal, building
// the habit, widening the self-portrait, then climbing toward matching. Adding a
// new unlock is one entry here; the engine and the UI derive everything else.
export const ACHIEVEMENT_REGISTRY: readonly AchievementDef[] = [
  {
    id: "first-signal",
    title: "First signal",
    description: "Teach the machine its first thing about you.",
    icon: "Sparkles",
    tier: "bronze",
    metric: "signalsFed",
    target: 1,
    unit: "signals",
  },
  {
    id: "signal-10",
    title: "Signal stacker",
    description: "Feed ten signals into your second brain.",
    icon: "Layers",
    tier: "silver",
    metric: "signalsFed",
    target: 10,
    unit: "signals",
  },
  {
    id: "signal-25",
    title: "Open book",
    description: "Feed twenty-five signals and keep going.",
    icon: "BookOpen",
    tier: "gold",
    metric: "signalsFed",
    target: 25,
    unit: "signals",
  },
  {
    id: "streak-3",
    title: "Warming up",
    description: "Show up three days in a row.",
    icon: "Flame",
    tier: "bronze",
    metric: "currentStreak",
    target: 3,
    unit: "days",
  },
  {
    id: "streak-7",
    title: "Week strong",
    description: "Keep a seven-day streak alive.",
    icon: "Flame",
    tier: "gold",
    metric: "currentStreak",
    target: 7,
    unit: "days",
  },
  {
    id: "tools-3",
    title: "Toolkit",
    description: "Finish three tools across the app.",
    icon: "Wrench",
    tier: "bronze",
    metric: "toolsCompleted",
    target: 3,
    unit: "tools",
  },
  {
    id: "lanes-3",
    title: "Portrait forming",
    description: "Map three areas of your Mirror.",
    icon: "Compass",
    tier: "silver",
    metric: "lanesMapped",
    target: 3,
    unit: "areas",
  },
  {
    id: "lanes-6",
    title: "Wide open",
    description: "Map six areas so the picture gets sharp.",
    icon: "Telescope",
    tier: "gold",
    metric: "lanesMapped",
    target: 6,
    unit: "areas",
  },
  {
    id: "ready-25",
    title: "Off the ground",
    description: "Climb to twenty-five readiness.",
    icon: "TrendingUp",
    tier: "bronze",
    metric: "readiness",
    target: 25,
    unit: "readiness",
  },
  {
    id: "match-ready",
    title: "Match ready",
    description: "Reach the readiness that opens introductions.",
    icon: "Heart",
    tier: "gold",
    metric: "readiness",
    unit: "readiness",
  },
];

function valueFor(metric: AchievementMetric, inputs: AchievementInputs): number {
  switch (metric) {
    case "signalsFed":
      return inputs.signalsFed;
    case "toolsCompleted":
      return inputs.toolsCompleted;
    case "currentStreak":
      return inputs.currentStreak;
    case "lanesMapped":
      return inputs.lanesMapped;
    case "readiness":
      return inputs.readinessScore;
  }
}

/**
 * Turn a user's aggregate progress into the full unlock board: every badge with
 * its target, current progress (clamped to the target for a clean bar), and
 * whether it is unlocked. Deterministic and side-effect free. The dynamic
 * "match ready" target resolves to the live readiness threshold so the board
 * stays correct if the founder retunes it.
 */
export function computeAchievements(
  inputs: AchievementInputs,
): UserAchievements {
  const safeThreshold =
    Number.isFinite(inputs.readinessThreshold) && inputs.readinessThreshold > 0
      ? inputs.readinessThreshold
      : 50;

  const achievements: Achievement[] = ACHIEVEMENT_REGISTRY.map((def) => {
    const target =
      def.target ?? (def.metric === "readiness" ? safeThreshold : 1);
    const raw = Math.max(0, valueFor(def.metric, inputs));
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: def.tier,
      unit: def.unit,
      target,
      progress: Math.min(raw, target),
      unlocked: raw >= target,
    };
  });

  return {
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
  };
}
