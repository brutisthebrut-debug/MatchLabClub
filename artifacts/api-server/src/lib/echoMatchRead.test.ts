import { describe, it, expect } from "vitest";
import { buildEchoMatchRead } from "./echoMatchRead";

const EMPTY = {
  score: 0,
  threshold: 50,
  eligible: false,
  activeSignalLines: [],
  coveredLanes: [],
  totalLanes: 12,
  outcome: { totalDates: 0, anotherDate: 0, noMore: 0, ghosted: 0 },
  radiusKm: null,
  nextAction: { label: "Run a compass read", href: "/compatibility-compass" },
};

describe("buildEchoMatchRead", () => {
  it("returns a usable read for a brand-new user", () => {
    const read = buildEchoMatchRead(EMPTY);
    expect(read.reading.length).toBeGreaterThan(0);
    expect(read.idealMatch.length).toBeGreaterThan(0);
    expect(read.confidence).toBe(0);
    expect(read.gapToPool).toBe(50);
    expect(read.radiusLabel).toBe("anywhere we can reach");
    expect(read.nextStep).toEqual(EMPTY.nextAction);
    expect(read.headline).toMatch(/what I can see/i);
  });

  it("draws ideal-match lines from covered lanes and caps at four", () => {
    const read = buildEchoMatchRead({
      ...EMPTY,
      score: 40,
      activeSignalLines: ["Has mapped 60% of their wellness profile."],
      coveredLanes: [
        "wellness",
        "compass",
        "hingeImport",
        "journal",
        "wins",
        "calendar",
      ],
    });
    expect(read.idealMatch.length).toBe(4);
    expect(read.reading[0]).toContain("wellness");
    expect(read.confidence).toBeGreaterThan(0);
  });

  it("maps km radius to a mile label", () => {
    expect(buildEchoMatchRead({ ...EMPTY, radiusKm: 56 }).radiusLabel).toBe(
      "inside your 35-mile radius",
    );
    expect(buildEchoMatchRead({ ...EMPTY, radiusKm: 40 }).radiusLabel).toBe(
      "inside your 25-mile radius",
    );
  });

  it("flips headline, gap, and next step when eligible", () => {
    const read = buildEchoMatchRead({
      ...EMPTY,
      score: 72,
      eligible: true,
      coveredLanes: ["wellness", "compass"],
      activeSignalLines: ["x", "y"],
    });
    expect(read.gapToPool).toBe(0);
    expect(read.headline).toMatch(/put in front of you/i);
    expect(read.nextStep?.href).toBe("/matching");
  });

  it("folds aggregate date outcomes into the reading without raw content", () => {
    const read = buildEchoMatchRead({
      ...EMPTY,
      score: 30,
      activeSignalLines: ["line"],
      coveredLanes: ["wellness"],
      outcome: { totalDates: 4, anotherDate: 2, noMore: 1, ghosted: 1 },
    });
    expect(read.reading.some((l) => l.includes("4 dates"))).toBe(true);
  });

  it("never emits em dashes or AI-tell words in deterministic copy", () => {
    const reads = [
      buildEchoMatchRead(EMPTY),
      buildEchoMatchRead({
        ...EMPTY,
        score: 80,
        eligible: true,
        coveredLanes: Object.keys({
          wellness: 1,
          compass: 1,
          hingeImport: 1,
          postDate: 1,
          journal: 1,
          wins: 1,
          calendar: 1,
          audits: 1,
          coaching: 1,
          instagram: 1,
          lifePulse: 1,
          taste: 1,
          lifestyle: 1,
        }),
        activeSignalLines: ["a", "b", "c", "d"],
      }),
    ];
    const banned = [
      "dive in",
      "unleash",
      "elevate",
      "in today's world",
      "seamless",
      "game-changer",
      "buckle up",
      "unlock",
    ];
    for (const read of reads) {
      const text = [
        read.headline,
        ...read.reading,
        ...read.idealMatch,
        read.radiusLabel,
        read.nextStep?.label ?? "",
      ]
        .join(" ")
        .toLowerCase();
      expect(text).not.toContain("\u2014");
      for (const word of banned) expect(text).not.toContain(word);
    }
  });
});
