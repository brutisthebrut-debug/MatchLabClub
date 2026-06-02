import { Router, type IRouter } from "express";
import {
  computeReadiness,
  readinessThreshold,
  loadActivityDays,
  todayUtc,
} from "./matching";
import { computeActivityStreak } from "../lib/streak";
import { countUserJourneyTotals } from "../lib/journeyEvents";
import { computeAchievements } from "../lib/achievements";

const router: IRouter = Router();

// The signed-in user's unlock board. Scoped strictly to the caller: every input
// is a derived aggregate of the caller's own progress (signals fed, tools
// completed, current streak, Mirror areas mapped, readiness score). This is a
// pure gamification lens; it never feeds the readiness score and never returns
// raw content. The streak read is wrapped so a failure there degrades to a zero
// streak rather than erroring the whole board.
router.get("/me/achievements", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const [readiness, threshold, totals] = await Promise.all([
    computeReadiness(userId),
    readinessThreshold(),
    countUserJourneyTotals(userId),
  ]);

  let currentStreak = 0;
  try {
    const days = await loadActivityDays(userId);
    currentStreak = computeActivityStreak(days, todayUtc()).current;
  } catch (err) {
    req.log.warn({ err }, "Failed to compute streak for achievements");
  }

  const lanesMapped = Object.values(readiness.breakdown).filter(
    (v): v is number => typeof v === "number" && v > 0,
  ).length;

  const board = computeAchievements({
    signalsFed: totals.signalsFed,
    toolsCompleted: totals.toolsCompleted,
    currentStreak,
    lanesMapped,
    readinessScore: readiness.score,
    readinessThreshold: threshold,
  });

  res.json(board);
});

export default router;
