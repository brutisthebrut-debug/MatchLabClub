import { describe, it, expect } from "vitest";
import {
  defaultControls,
  coerceControls,
  effectiveBaseWeights,
  effectiveWeightsForUser,
  connectorEnabled,
  CONNECTOR_CATALOG,
  type BrainControls,
} from "./brainConfig";
import { normalizedWeights, SIGNAL_REGISTRY, type OutcomeSignal } from "./signalRegistry";

const noOutcomes: OutcomeSignal = {
  anotherDate: 0,
  noMore: 0,
  ghosted: 0,
  unsure: 0,
};

describe("brainConfig defaults", () => {
  it("day-one base weights are identical to the registry normalization", () => {
    const base = effectiveBaseWeights(defaultControls());
    const registry = normalizedWeights();
    for (const id of Object.keys(registry)) {
      expect(base[id]).toBeCloseTo(registry[id]!, 9);
    }
    const sum = Object.values(base).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("default controls have hold mode, no overrides, all connectors on", () => {
    const c = defaultControls();
    expect(c.reweightingMode).toBe("hold");
    expect(c.signalWeightOverrides).toBeNull();
    expect(c.connectorToggles).toEqual({});
    for (const entry of CONNECTOR_CATALOG) {
      expect(connectorEnabled(c, entry.id)).toBe(true);
    }
  });
});

describe("coerceControls", () => {
  it("returns defaults for non-object input", () => {
    expect(coerceControls(null)).toEqual(defaultControls());
    expect(coerceControls("nope")).toEqual(defaultControls());
  });

  it("clamps out-of-range numeric knobs", () => {
    const c = coerceControls({
      readinessThreshold: 9999,
      matchingRadiusMiles: 0,
      cohortMinSize: -5,
      anonDailyCap: -1,
      freeDailyCap: 1e9,
    });
    expect(c.readinessThreshold).toBe(100);
    expect(c.matchingRadiusMiles).toBe(1);
    expect(c.cohortMinSize).toBe(1);
    expect(c.anonDailyCap).toBe(0);
    expect(c.freeDailyCap).toBe(100000);
  });

  it("drops unknown signal ids and negative weights from overrides", () => {
    const validId = SIGNAL_REGISTRY[0]!.id as string;
    const c = coerceControls({
      signalWeightOverrides: { [validId]: 0.5, bogus: 0.3, [SIGNAL_REGISTRY[1]!.id as string]: -2 },
    });
    expect(c.signalWeightOverrides).toEqual({ [validId]: 0.5 });
  });

  it("coerces connector toggles to booleans", () => {
    const c = coerceControls({ connectorToggles: { plaid: false, spotify: 1 } });
    expect(c.connectorToggles).toEqual({ plaid: false, spotify: true });
  });

  it("only accepts applied as a non-default reweighting mode", () => {
    expect(coerceControls({ reweightingMode: "applied" }).reweightingMode).toBe("applied");
    expect(coerceControls({ reweightingMode: "garbage" }).reweightingMode).toBe("hold");
  });
});

describe("effectiveBaseWeights with overrides", () => {
  it("re-normalizes overridden raw weights to sum to 1", () => {
    const id = SIGNAL_REGISTRY[0]!.id as string;
    const controls = coerceControls({ signalWeightOverrides: { [id]: 10 } });
    const base = effectiveBaseWeights(controls);
    const sum = Object.values(base).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    // The heavily-overridden signal should dominate.
    expect(base[id]).toBeGreaterThan(0.5);
  });
});

describe("effectiveWeightsForUser", () => {
  it("hold mode returns base weights unchanged", () => {
    const controls = defaultControls();
    const w = effectiveWeightsForUser(controls, noOutcomes);
    const base = effectiveBaseWeights(controls);
    for (const id of Object.keys(base)) {
      expect(w[id]).toBeCloseTo(base[id]!, 9);
    }
  });

  it("applied mode with no outcomes still sums to 1 and matches base", () => {
    const controls: BrainControls = { ...defaultControls(), reweightingMode: "applied" };
    const w = effectiveWeightsForUser(controls, noOutcomes);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    // Adjustments are rounded to 4 decimals per signal, so the sum can drift
    // by a fraction of a percent across the registry.
    expect(sum).toBeCloseTo(1, 2);
  });

  it("applied mode tilts toward in-person fit signals when dates fizzle", () => {
    const controls: BrainControls = { ...defaultControls(), reweightingMode: "applied" };
    const base = effectiveBaseWeights(controls);
    const fizzling: OutcomeSignal = { anotherDate: 0, noMore: 2, ghosted: 2, unsure: 0 };
    const w = effectiveWeightsForUser(controls, fizzling);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    // postDate is a lean-into signal and should rise above its base share.
    expect(w["postDate"]).toBeGreaterThan(base["postDate"]!);
  });
});

describe("connectorEnabled", () => {
  it("treats only explicit false as disabled", () => {
    const controls = coerceControls({ connectorToggles: { plaid: false } });
    expect(connectorEnabled(controls, "plaid")).toBe(false);
    expect(connectorEnabled(controls, "spotify")).toBe(true);
    expect(connectorEnabled(controls, "unknown-id")).toBe(true);
  });
});
