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
      audits: 0,
      coaching: 0,
      instagram: 0,
      lifePulse: 0,
    });
    expect(b).toEqual({
      compass: 0,
      journal: 0,
      wellness: 0,
      hingeImport: 0,
      postDate: 0,
      wins: 0,
      calendar: 0,
      careDialect: 0,
      audits: 0,
      coaching: 0,
      instagram: 0,
      lifePulse: 0,
      taste: 0,
      lifestyle: 0,
      quizzes: 0,
      receipts: 0,
      music: 0,
      vitality: 0,
      exist: 0,
      communities: 0,
      curiosity: 0,
      film: 0,
      reading: 0,
      podcasts: 0,
      gaming: 0,
      places: 0,
      screenRhythm: 0,
      preferences: 0,
      voice: 0,
      wyr: 0,
      dailySpark: 0,
      flags: 0,
      consistency: 0,
      scenarioReels: 0,
      selfAwareness: 0,
      timeCapsule: 0,
      externalCalibration: 0,
      cosmicProfile: 0,
      relocationOpen: 0,
      verification: 0,
      behavioralGrowth: 0,
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
      audits: 50,
      coaching: 50,
      instagram: 1,
      lifePulse: 50,
      tasteItems: 50,
      lifestyleItems: 50,
      quizzesCompleted: 50,
      receiptItems: 50,
      musicItems: 50,
      vitalityItems: 50,
      existItems: 50,
      communityItems: 50,
      curiosityItems: 50,
      filmItems: 50,
      readingItems: 50,
      podcastItems: 50,
      gamingItems: 50,
      placeItems: 50,
      screenRhythmItems: 50,
      preferenceItems: 50,
      voiceRecorded: 1,
      wyrAnswered: 50,
      dailySparkAnswered: 50,
      flagItems: 50,
      activeDays14: 50,
      scenariosPlayed: 50,
      predictionsAnswered: 50,
      capsulesWritten: 50,
      wingmanPerspectives: 50,
      cosmicFacets: 2,
      relocationFacets: 1,
      verificationFacets: 3,
      careDialect: 1,
      behavioralGrowthEvents: 50,
    });
    expect(b).toEqual({
      compass: 100,
      journal: 100,
      wellness: 100,
      hingeImport: 100,
      postDate: 100,
      wins: 100,
      calendar: 100,
      careDialect: 100,
      audits: 100,
      coaching: 100,
      instagram: 100,
      lifePulse: 100,
      taste: 100,
      lifestyle: 100,
      quizzes: 100,
      receipts: 100,
      music: 100,
      vitality: 100,
      exist: 100,
      communities: 100,
      curiosity: 100,
      film: 100,
      reading: 100,
      podcasts: 100,
      gaming: 100,
      places: 100,
      screenRhythm: 100,
      preferences: 100,
      voice: 100,
      wyr: 100,
      dailySpark: 100,
      flags: 100,
      consistency: 100,
      scenarioReels: 100,
      selfAwareness: 100,
      timeCapsule: 100,
      externalCalibration: 100,
      cosmicProfile: 100,
      relocationOpen: 100,
      verification: 100,
      behavioralGrowth: 100,
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
        audits: 0,
        coaching: 0,
        instagram: 0,
        lifePulse: 0,
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
        audits: 0,
        coaching: 0,
        instagram: 0,
        lifePulse: 0,
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
        audits: 0,
        coaching: 0,
        instagram: 0,
        lifePulse: 0,
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
        audits: 0,
        coaching: 0,
        instagram: 0,
        lifePulse: 0,
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
      audits: 0,
      coaching: 0,
      instagram: 0,
      lifePulse: 0,
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
      audits: 0,
      coaching: 0,
      instagram: 0,
      lifePulse: 0,
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
      audits: 0,
      coaching: 0,
      instagram: 0,
      lifePulse: 0,
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
