import { describe, it, expect } from "vitest";
import { DEMO_SIGNAL_MAP } from "./mirrorDemo";

// The demo map is hand-maintained but must obey the exact same invariants the
// backend buildSignalMap enforces, so a signed-out visitor never sees a sample
// that contradicts how a real account behaves. These guards catch drift if the
// demo is edited by hand later.
describe("DEMO_SIGNAL_MAP fidelity", () => {
  it("keeps the aggregate counts consistent with the lanes", () => {
    expect(DEMO_SIGNAL_MAP.totalLanes).toBe(DEMO_SIGNAL_MAP.lanes.length);
    expect(DEMO_SIGNAL_MAP.lanesActive).toBe(
      DEMO_SIGNAL_MAP.lanes.filter((l) => l.hasSignal).length,
    );
  });

  it("orders active lanes first by coverage, then blind spots by weight", () => {
    const lanes = DEMO_SIGNAL_MAP.lanes;
    const firstBlind = lanes.findIndex((l) => !l.hasSignal);

    // Every active lane precedes every blind spot.
    if (firstBlind !== -1) {
      expect(lanes.slice(firstBlind).every((l) => !l.hasSignal)).toBe(true);
    }

    const active = lanes.filter((l) => l.hasSignal);
    for (let i = 1; i < active.length; i++) {
      expect(active[i - 1].coverage).toBeGreaterThanOrEqual(active[i].coverage);
    }

    const blind = lanes.filter((l) => !l.hasSignal);
    for (let i = 1; i < blind.length; i++) {
      expect(blind[i - 1].weightPercent).toBeGreaterThanOrEqual(
        blind[i].weightPercent,
      );
    }
  });

  it("points topBlindSpot at the heaviest empty lane", () => {
    const blind = DEMO_SIGNAL_MAP.lanes.filter((l) => !l.hasSignal);
    if (blind.length === 0) {
      expect(DEMO_SIGNAL_MAP.topBlindSpot).toBeNull();
      return;
    }
    const heaviest = blind.reduce((best, l) =>
      l.weightPercent > best.weightPercent ? l : best,
    );
    expect(DEMO_SIGNAL_MAP.topBlindSpot?.id).toBe(heaviest.id);
  });

  it("uses normalized weight percentages that sum to roughly 100", () => {
    const sum = DEMO_SIGNAL_MAP.lanes.reduce(
      (acc, l) => acc + l.weightPercent,
      0,
    );
    // Rounding each lane to a whole number drifts a few points off 100.
    expect(sum).toBeGreaterThanOrEqual(95);
    expect(sum).toBeLessThanOrEqual(105);
  });
});
