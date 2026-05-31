export type MilestoneIconKey = "first" | "patterns" | "ready" | "dialed";

export interface MilestoneSpec {
  threshold: number;
  title: string;
  blurb: string;
  iconKey: MilestoneIconKey;
}

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(1, Math.round(value)));
}

/**
 * Build the readiness milestone timeline for a given match-ready threshold.
 * The threshold is env-driven on the backend and clamped 0-100, so it can land
 * on, below, or above the fixed steps. We dedupe by threshold (match ready wins
 * any collision) and always return the list sorted ascending, so progression
 * logic stays correct for any threshold.
 */
export function buildMilestones(threshold: number): MilestoneSpec[] {
  const fixed: MilestoneSpec[] = [
    {
      threshold: 1,
      title: "First signals",
      blurb: "You started teaching the machine who you actually are.",
      iconKey: "first",
    },
    {
      threshold: 25,
      title: "Patterns forming",
      blurb:
        "Enough signal for the machine to see how you connect, not just what you say you want.",
      iconKey: "patterns",
    },
    {
      threshold: 75,
      title: "Dialed in",
      blurb:
        "The machine knows you well enough to reach for matches you would never have considered on your own.",
      iconKey: "dialed",
    },
  ];

  const ready: MilestoneSpec = {
    threshold: clampThreshold(threshold),
    title: "Match ready",
    blurb:
      "The introductions pool opens. You become eligible for AI-driven introductions with people near you.",
    iconKey: "ready",
  };

  const byThreshold = new Map<number, MilestoneSpec>();
  for (const m of fixed) byThreshold.set(m.threshold, m);
  byThreshold.set(ready.threshold, ready);

  return [...byThreshold.values()].sort((a, b) => a.threshold - b.threshold);
}

/** The first milestone the score has not yet reached, or undefined when all are cleared. */
export function nextMilestone(
  score: number,
  milestones: MilestoneSpec[],
): MilestoneSpec | undefined {
  return milestones.find((m) => score < m.threshold);
}
