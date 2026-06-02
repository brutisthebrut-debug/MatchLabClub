import { describe, it, expect } from "vitest";
import {
  computeAchievements,
  ACHIEVEMENT_REGISTRY,
  type AchievementInputs,
} from "./achievements";

const ZERO: AchievementInputs = {
  signalsFed: 0,
  toolsCompleted: 0,
  currentStreak: 0,
  lanesMapped: 0,
  readinessScore: 0,
  readinessThreshold: 50,
};

function byId(board: ReturnType<typeof computeAchievements>, id: string) {
  const a = board.achievements.find((x) => x.id === id);
  if (!a) throw new Error(`missing achievement ${id}`);
  return a;
}

describe("computeAchievements", () => {
  it("returns the full board with everything locked for a brand-new user", () => {
    const board = computeAchievements(ZERO);
    expect(board.totalCount).toBe(ACHIEVEMENT_REGISTRY.length);
    expect(board.unlockedCount).toBe(0);
    expect(board.achievements.every((a) => !a.unlocked)).toBe(true);
    expect(board.achievements.every((a) => a.progress === 0)).toBe(true);
  });

  it("unlocks everything when every metric is well past its target", () => {
    const board = computeAchievements({
      signalsFed: 30,
      toolsCompleted: 5,
      currentStreak: 10,
      lanesMapped: 8,
      readinessScore: 90,
      readinessThreshold: 60,
    });
    expect(board.unlockedCount).toBe(board.totalCount);
    expect(board.achievements.every((a) => a.unlocked)).toBe(true);
  });

  it("clamps progress to the target for a clean bar", () => {
    const board = computeAchievements({ ...ZERO, signalsFed: 100 });
    const stacker = byId(board, "signal-10");
    expect(stacker.target).toBe(10);
    expect(stacker.progress).toBe(10);
    expect(stacker.unlocked).toBe(true);
  });

  it("uses the live readiness threshold as the match-ready target", () => {
    const board = computeAchievements({
      ...ZERO,
      readinessScore: 55,
      readinessThreshold: 60,
    });
    const matchReady = byId(board, "match-ready");
    expect(matchReady.target).toBe(60);
    expect(matchReady.unlocked).toBe(false);
    expect(matchReady.progress).toBe(55);

    const ready25 = byId(board, "ready-25");
    expect(ready25.unlocked).toBe(true);
  });

  it("falls back to a sane match-ready target when the threshold is invalid", () => {
    const board = computeAchievements({
      ...ZERO,
      readinessScore: 50,
      readinessThreshold: 0,
    });
    const matchReady = byId(board, "match-ready");
    expect(matchReady.target).toBe(50);
    expect(matchReady.unlocked).toBe(true);
  });

  it("never reports negative progress", () => {
    const board = computeAchievements({
      ...ZERO,
      signalsFed: -5,
      currentStreak: -2,
    });
    expect(board.achievements.every((a) => a.progress >= 0)).toBe(true);
  });
});
