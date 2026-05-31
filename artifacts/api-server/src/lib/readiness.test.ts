import { describe, it, expect } from "vitest";
import {
  computeBreakdown,
  computeNextActions,
  computeOutcomeInsight,
  scoreFromBreakdown,
} from "./readiness";

describe("computeBreakdown", () => {
  it("returns all zeros for an empty user", () => {
    const b = computeBreakdown({
      compass: 0,
      journal: 0,
      wellnessDistinct: 0,
      hingeImport: 0,
      postDateReflected: 0,
      wins: 0,
      calendarEvents: 0,
    });
    expect(b).toEqual({
      compass: 0,
      journal: 0,
      wellness: 0,
      hingeImport: 0,
      postDate: 0,
      wins: 0,
      calendar: 0,
    });
    expect(scoreFromBreakdown(b)).toBe(0);
  });

  it("clamps each signal at 100 and treats any hinge import as full", () => {
    const b = computeBreakdown({
      compass: 50,
      journal: 50,
      wellnessDistinct: 50,
      hingeImport: 1,
      postDateReflected: 50,
      wins: 50,
      calendarEvents: 50,
    });
    expect(b).toEqual({
      compass: 100,
      journal: 100,
      wellness: 100,
      hingeImport: 100,
      postDate: 100,
      wins: 100,
      calendar: 100,
    });
    expect(scoreFromBreakdown(b)).toBe(100);
  });

  it("includes wins as a weighted signal", () => {
    const withoutWins = scoreFromBreakdown(
      computeBreakdown({
        compass: 0,
        journal: 0,
        wellnessDistinct: 0,
        hingeImport: 0,
        postDateReflected: 0,
        wins: 0,
        calendarEvents: 0,
      }),
    );
    const withWins = scoreFromBreakdown(
      computeBreakdown({
        compass: 0,
        journal: 0,
        wellnessDistinct: 0,
        hingeImport: 0,
        postDateReflected: 0,
        wins: 5,
        calendarEvents: 0,
      }),
    );
    expect(withWins).toBeGreaterThan(withoutWins);
  });

  it("includes calendar rhythm as a weighted signal", () => {
    const withoutCalendar = scoreFromBreakdown(
      computeBreakdown({
        compass: 0,
        journal: 0,
        wellnessDistinct: 0,
        hingeImport: 0,
        postDateReflected: 0,
        wins: 0,
        calendarEvents: 0,
      }),
    );
    const withCalendar = scoreFromBreakdown(
      computeBreakdown({
        compass: 0,
        journal: 0,
        wellnessDistinct: 0,
        hingeImport: 0,
        postDateReflected: 0,
        wins: 0,
        calendarEvents: 12,
      }),
    );
    expect(withCalendar).toBeGreaterThan(withoutCalendar);
  });
});

describe("computeNextActions", () => {
  it("is empty when the user is already eligible", () => {
    const b = computeBreakdown({
      compass: 0,
      journal: 0,
      wellnessDistinct: 0,
      hingeImport: 0,
      postDateReflected: 0,
      wins: 0,
      calendarEvents: 0,
    });
    expect(computeNextActions(b, true)).toEqual([]);
  });

  it("ranks the highest-leverage incomplete signals first", () => {
    const b = computeBreakdown({
      compass: 0,
      journal: 0,
      wellnessDistinct: 0,
      hingeImport: 0,
      postDateReflected: 0,
      wins: 0,
      calendarEvents: 0,
    });
    const actions = computeNextActions(b, false);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(3);
    // Hinge import is the single biggest jump, so it should lead.
    expect(actions[0].key).toBe("hingeImport");
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].points).toBeGreaterThanOrEqual(actions[i].points);
    }
  });

  it("omits signals that are already maxed out", () => {
    const b = computeBreakdown({
      compass: 100,
      journal: 0,
      wellnessDistinct: 0,
      hingeImport: 1,
      postDateReflected: 0,
      wins: 0,
      calendarEvents: 0,
    });
    const actions = computeNextActions(b, false);
    const keys = actions.map((a) => a.key);
    expect(keys).not.toContain("compass");
    expect(keys).not.toContain("hingeImport");
  });
});

describe("computeOutcomeInsight", () => {
  it("handles no dates", () => {
    const insight = computeOutcomeInsight({
      anotherDate: 0,
      noMore: 0,
      ghosted: 0,
      unsure: 0,
    });
    expect(insight.totalDates).toBe(0);
    expect(insight.headline).toMatch(/No date outcomes/i);
  });

  it("celebrates a strong run", () => {
    const insight = computeOutcomeInsight({
      anotherDate: 3,
      noMore: 1,
      ghosted: 0,
      unsure: 0,
    });
    expect(insight.totalDates).toBe(4);
    expect(insight.anotherDate).toBe(3);
    expect(insight.headline).toMatch(/Strong run/i);
  });

  it("flags a fizzling run", () => {
    const insight = computeOutcomeInsight({
      anotherDate: 0,
      noMore: 2,
      ghosted: 2,
      unsure: 0,
    });
    expect(insight.headline).toMatch(/fizzled/i);
  });

  it("contains no em dashes in any headline", () => {
    const samples = [
      computeOutcomeInsight({ anotherDate: 0, noMore: 0, ghosted: 0, unsure: 0 }),
      computeOutcomeInsight({ anotherDate: 3, noMore: 1, ghosted: 0, unsure: 0 }),
      computeOutcomeInsight({ anotherDate: 0, noMore: 2, ghosted: 2, unsure: 0 }),
      computeOutcomeInsight({ anotherDate: 1, noMore: 1, ghosted: 1, unsure: 1 }),
    ];
    for (const s of samples) {
      expect(s.headline).not.toContain("\u2014");
    }
  });
});
