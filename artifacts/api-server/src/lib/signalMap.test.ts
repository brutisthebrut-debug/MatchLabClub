import { describe, it, expect } from "vitest";
import { buildSignalMap } from "./signalMap";
import {
  SIGNAL_REGISTRY,
  normalizedWeights,
  type ReadinessBreakdown,
} from "./signalRegistry";

function emptyBreakdown(): ReadinessBreakdown {
  const out = {} as ReadinessBreakdown;
  for (const c of SIGNAL_REGISTRY) out[c.id] = 0;
  return out;
}

describe("buildSignalMap", () => {
  it("emits one lane per registry entry and surfaces every lane as a blind spot when empty", () => {
    const map = buildSignalMap(emptyBreakdown(), normalizedWeights(), 0);
    expect(map.totalLanes).toBe(SIGNAL_REGISTRY.length);
    expect(map.lanes).toHaveLength(SIGNAL_REGISTRY.length);
    expect(map.lanesActive).toBe(0);
    expect(map.lanes.every((l) => !l.hasSignal)).toBe(true);
  });

  it("passes the readiness score straight through as the density percent", () => {
    const map = buildSignalMap(emptyBreakdown(), normalizedWeights(), 47.6);
    expect(map.densityPercent).toBe(48);
  });

  it("marks lanes with coverage active and counts them", () => {
    const breakdown = emptyBreakdown();
    breakdown.wellness = 80;
    breakdown.compass = 40;
    const map = buildSignalMap(breakdown, normalizedWeights(), 30);
    expect(map.lanesActive).toBe(2);
    const active = map.lanes.filter((l) => l.hasSignal).map((l) => l.id);
    expect(active).toEqual(expect.arrayContaining(["wellness", "compass"]));
  });

  it("orders active lanes first by coverage, then blind spots by weight", () => {
    const breakdown = emptyBreakdown();
    breakdown.compass = 40;
    breakdown.wellness = 90;
    const map = buildSignalMap(breakdown, normalizedWeights(), 35);

    // First two lanes are the active ones, fullest first.
    expect(map.lanes[0].id).toBe("wellness");
    expect(map.lanes[1].id).toBe("compass");

    // The remaining lanes are all blind spots, weakly ordered by weight.
    const blindSpots = map.lanes.slice(2);
    expect(blindSpots.every((l) => !l.hasSignal)).toBe(true);
    for (let i = 1; i < blindSpots.length; i++) {
      expect(blindSpots[i - 1].weightPercent).toBeGreaterThanOrEqual(
        blindSpots[i].weightPercent,
      );
    }
  });

  it("picks the highest-weight empty lane as the top blind spot", () => {
    const breakdown = emptyBreakdown();
    // Fill the two heaviest lanes (wellness 0.22, compass 0.20) so the next
    // heaviest empty lane is the expected top blind spot.
    breakdown.wellness = 50;
    breakdown.compass = 50;
    const map = buildSignalMap(breakdown, normalizedWeights(), 21);

    expect(map.topBlindSpot).not.toBeNull();
    expect(map.topBlindSpot!.hasSignal).toBe(false);
    const heaviestEmpty = map.lanes
      .filter((l) => !l.hasSignal)
      .reduce((a, b) => (b.weightPercent > a.weightPercent ? b : a));
    expect(map.topBlindSpot!.id).toBe(heaviestEmpty.id);
  });

  it("returns a null top blind spot when every lane has signal", () => {
    const breakdown = emptyBreakdown();
    for (const c of SIGNAL_REGISTRY) breakdown[c.id] = 50;
    const map = buildSignalMap(breakdown, normalizedWeights(), 50);
    expect(map.lanesActive).toBe(map.totalLanes);
    expect(map.topBlindSpot).toBeNull();
  });

  it("derives weight and confidence as whole-number percentages from the registry", () => {
    const map = buildSignalMap(emptyBreakdown(), normalizedWeights(), 0);
    const wellnessLane = map.lanes.find((l) => l.id === "wellness")!;
    const wellnessEntry = SIGNAL_REGISTRY.find((c) => c.id === "wellness")!;
    expect(wellnessLane.confidence).toBe(
      Math.round(wellnessEntry.confidence * 100),
    );
    expect(wellnessLane.weightPercent).toBe(
      Math.round(normalizedWeights().wellness * 100),
    );
  });
});
