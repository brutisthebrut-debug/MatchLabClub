import { describe, it, expect } from "vitest";
import { computeActivityStreak } from "./streak";

const TODAY = "2026-05-31";

describe("computeActivityStreak", () => {
  it("is all zero for a user with no activity", () => {
    expect(computeActivityStreak([], TODAY)).toEqual({
      current: 0,
      longest: 0,
      activeToday: false,
      daysActiveLast14: 0,
    });
  });

  it("counts a run ending today as active today", () => {
    const s = computeActivityStreak(
      ["2026-05-29", "2026-05-30", "2026-05-31"],
      TODAY,
    );
    expect(s.activeToday).toBe(true);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.daysActiveLast14).toBe(3);
  });

  it("keeps the streak alive when yesterday was active but today is not yet", () => {
    const s = computeActivityStreak(
      ["2026-05-29", "2026-05-30"],
      TODAY,
    );
    expect(s.activeToday).toBe(false);
    expect(s.current).toBe(2);
  });

  it("resets the current run when the last active day is older than yesterday", () => {
    const s = computeActivityStreak(["2026-05-20", "2026-05-21"], TODAY);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
  });

  it("ignores duplicate day strings", () => {
    const s = computeActivityStreak(
      ["2026-05-31", "2026-05-31", "2026-05-30"],
      TODAY,
    );
    expect(s.current).toBe(2);
    expect(s.daysActiveLast14).toBe(2);
  });

  it("tracks the longest historical run independent of the current one", () => {
    const s = computeActivityStreak(
      [
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-31",
      ],
      TODAY,
    );
    expect(s.longest).toBe(4);
    expect(s.current).toBe(1);
  });

  it("only counts the trailing 14 days for daysActiveLast14", () => {
    const s = computeActivityStreak(
      ["2026-05-01", "2026-05-18", "2026-05-31"],
      TODAY,
    );
    // 2026-05-18 is within 14 days of 2026-05-31, 2026-05-01 is not.
    expect(s.daysActiveLast14).toBe(2);
  });

  it("ignores malformed day strings", () => {
    const s = computeActivityStreak(["", "not-a-date", "2026-05-31"], TODAY);
    expect(s.current).toBe(1);
    expect(s.activeToday).toBe(true);
  });
});
