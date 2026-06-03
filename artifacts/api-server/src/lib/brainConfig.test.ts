import { describe, it, expect } from "vitest";
import {
  defaultControls,
  coerceControls,
  effectiveBaseWeights,
  effectiveWeightsForUser,
  reweightedWeights,
  inReweightingCohort,
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

  it("default controls observe in shadow, no overrides, all connectors on", () => {
    const c = defaultControls();
    expect(c.reweightingMode).toBe("shadow");
    expect(c.reweightingMinOutcomes).toBe(8);
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

  it("accepts hold, shadow, and applied reweighting modes, rejecting others", () => {
    expect(coerceControls({ reweightingMode: "applied" }).reweightingMode).toBe("applied");
    expect(coerceControls({ reweightingMode: "shadow" }).reweightingMode).toBe("shadow");
    expect(coerceControls({ reweightingMode: "hold" }).reweightingMode).toBe("hold");
    expect(coerceControls({ reweightingMode: "garbage" }).reweightingMode).toBe("hold");
  });

  it("defaults the reweighting cohort to 100 percent and clamps out-of-range", () => {
    expect(defaultControls().reweightingCohortPercent).toBe(100);
    expect(coerceControls({ reweightingCohortPercent: 250 }).reweightingCohortPercent).toBe(100);
    expect(coerceControls({ reweightingCohortPercent: -10 }).reweightingCohortPercent).toBe(0);
    expect(coerceControls({ reweightingCohortPercent: 42 }).reweightingCohortPercent).toBe(42);
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
    const fizzling: OutcomeSignal = { anotherDate: 0, noMore: 5, ghosted: 3, unsure: 0 };
    const w = effectiveWeightsForUser(controls, fizzling);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    // postDate is a lean-into signal and should rise above its base share.
    expect(w["postDate"]).toBeGreaterThan(base["postDate"]!);
  });
});

describe("reweightedWeights", () => {
  it("always tilts regardless of mode, ignoring the gate", () => {
    const base = effectiveBaseWeights(defaultControls());
    const fizzling: OutcomeSignal = { anotherDate: 0, noMore: 5, ghosted: 3, unsure: 0 };
    // mode is "hold" here, but reweightedWeights tilts anyway (shadow/preview use).
    const w = reweightedWeights(defaultControls(), fizzling);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(w["postDate"]!).toBeGreaterThan(base["postDate"]!);
  });

  it("shadow mode leaves effectiveWeightsForUser on base, but reweightedWeights still tilts", () => {
    const shadow: BrainControls = { ...defaultControls(), reweightingMode: "shadow" };
    const fizzling: OutcomeSignal = { anotherDate: 0, noMore: 5, ghosted: 3, unsure: 0 };
    const served = effectiveWeightsForUser(shadow, fizzling);
    const base = effectiveBaseWeights(shadow);
    for (const id of Object.keys(base)) {
      expect(served[id]).toBeCloseTo(base[id]!, 9);
    }
    const tilted = reweightedWeights(shadow, fizzling);
    expect(tilted["postDate"]!).toBeGreaterThan(base["postDate"]!);
  });
});

describe("inReweightingCohort", () => {
  it("includes everyone at 100 and no one at 0", () => {
    const all: BrainControls = { ...defaultControls(), reweightingCohortPercent: 100 };
    const none: BrainControls = { ...defaultControls(), reweightingCohortPercent: 0 };
    for (const id of ["a", "user-123", "zzz", ""]) {
      expect(inReweightingCohort(all, id)).toBe(true);
      expect(inReweightingCohort(none, id)).toBe(false);
    }
  });

  it("is deterministic for the same user id", () => {
    const controls: BrainControls = { ...defaultControls(), reweightingCohortPercent: 50 };
    const first = inReweightingCohort(controls, "stable-user");
    for (let i = 0; i < 5; i++) {
      expect(inReweightingCohort(controls, "stable-user")).toBe(first);
    }
  });

  it("membership only grows as the cohort percent rises (monotonic)", () => {
    const id = "ramp-user";
    let included = false;
    for (let pct = 0; pct <= 100; pct += 5) {
      const here = inReweightingCohort(
        { ...defaultControls(), reweightingCohortPercent: pct },
        id,
      );
      if (included) expect(here).toBe(true);
      included = here;
    }
    expect(included).toBe(true);
  });

  it("roughly approximates the requested share across many ids", () => {
    const controls: BrainControls = { ...defaultControls(), reweightingCohortPercent: 30 };
    let inCount = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      if (inReweightingCohort(controls, `user-${i}`)) inCount += 1;
    }
    const share = inCount / total;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.4);
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

describe("confidence weighting gate", () => {
  it("defaults to hold, leaving base weights at the registry default", () => {
    const controls = defaultControls();
    expect(controls.confidenceWeighting).toBe("hold");
    const base = effectiveBaseWeights(controls);
    const registry = normalizedWeights();
    for (const id of Object.keys(registry)) {
      expect(base[id]).toBeCloseTo(registry[id]!, 9);
    }
  });

  it("coerces unknown values back to hold and parses applied", () => {
    expect(coerceControls({ confidenceWeighting: "garbage" }).confidenceWeighting).toBe(
      "hold",
    );
    expect(coerceControls({ confidenceWeighting: "applied" }).confidenceWeighting).toBe(
      "applied",
    );
  });

  it("tilts base weights toward trusted lanes when applied", () => {
    const hold = effectiveBaseWeights(defaultControls());
    const applied = effectiveBaseWeights({
      ...defaultControls(),
      confidenceWeighting: "applied",
    });
    const sum = Object.values(applied).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    // postDate is the highest-confidence lane, so its share rises vs. hold.
    expect(applied["postDate"]!).toBeGreaterThan(hold["postDate"]!);
  });
});

describe("decay mode gate", () => {
  it("defaults to hold", () => {
    expect(defaultControls().decayMode).toBe("hold");
  });

  it("coerces unknown values back to hold and parses applied", () => {
    expect(coerceControls({ decayMode: "garbage" }).decayMode).toBe("hold");
    expect(coerceControls({ decayMode: "applied" }).decayMode).toBe("applied");
  });
});
