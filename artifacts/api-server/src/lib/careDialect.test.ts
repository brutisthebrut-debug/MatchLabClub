import { describe, it, expect } from "vitest";
import {
  CARE_DIALECT_KEYS,
  isCareDialectKey,
  emptyDistribution,
  tallyAxis,
  buildComparison,
  type CareDialectKey,
  type TestedAxis,
} from "./careDialect";

const tested = (top: CareDialectKey): TestedAxis => ({
  distribution: { ...emptyDistribution(), [top]: 1 },
  top,
});

describe("isCareDialectKey", () => {
  it("accepts the six stable keys and rejects anything else", () => {
    for (const k of CARE_DIALECT_KEYS) expect(isCareDialectKey(k)).toBe(true);
    // The trademarked five-love-languages terms must never validate as keys.
    expect(isCareDialectKey("wordsOfAffirmation")).toBe(false);
    expect(isCareDialectKey("Quality Time")).toBe(false);
    expect(isCareDialectKey(null)).toBe(false);
    expect(isCareDialectKey(3)).toBe(false);
    expect(isCareDialectKey("")).toBe(false);
  });
});

describe("emptyDistribution", () => {
  it("carries all six keys at zero", () => {
    const d = emptyDistribution();
    expect(Object.keys(d).sort()).toEqual([...CARE_DIALECT_KEYS].sort());
    expect(Object.values(d).every((v) => v === 0)).toBe(true);
  });
});

describe("tallyAxis", () => {
  it("returns null for no answers", () => {
    expect(tallyAxis([])).toBeNull();
  });

  it("normalizes to a distribution summing to exactly 1 with the argmax top", () => {
    const axis = tallyAxis([
      "helpingHands",
      "helpingHands",
      "spokenWarmth",
      "undividedTime",
    ])!;
    expect(axis.top).toBe("helpingHands");
    const sum = CARE_DIALECT_KEYS.reduce((s, k) => s + axis.distribution[k], 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(axis.distribution.helpingHands).toBeGreaterThan(
      axis.distribution.spokenWarmth,
    );
    expect(axis.distribution.closeContact).toBe(0);
  });

  it("breaks ties deterministically by registry key order", () => {
    // One each of two keys; the earlier key in CARE_DIALECT_KEYS wins, so the
    // result never depends on answer order.
    const axis = tallyAxis(["undividedTime", "spokenWarmth"])!;
    expect(axis.top).toBe("spokenWarmth");
    const reversed = tallyAxis(["spokenWarmth", "undividedTime"])!;
    expect(reversed.top).toBe("spokenWarmth");
  });

  it("folds the rounding remainder into the top so the sum stays exact", () => {
    const axis = tallyAxis(["spokenWarmth", "helpingHands", "undividedTime"])!;
    const sum = CARE_DIALECT_KEYS.reduce((s, k) => s + axis.distribution[k], 0);
    expect(sum).toBeCloseTo(1, 9);
  });
});

describe("buildComparison", () => {
  it("is unknown when nothing is picked or tested", () => {
    const c = buildComparison({
      selfGive: null,
      selfReceive: null,
      testedGive: null,
      testedReceive: null,
    });
    expect(c.alignment).toBe("unknown");
    expect(c.giveMatch).toBeNull();
    expect(c.receiveMatch).toBeNull();
  });

  it("reads aligned when both guesses match the tested top", () => {
    const c = buildComparison({
      selfGive: "spokenWarmth",
      selfReceive: "undividedTime",
      testedGive: tested("spokenWarmth"),
      testedReceive: tested("undividedTime"),
    });
    expect(c.alignment).toBe("aligned");
    expect(c.giveMatch).toBe(true);
    expect(c.receiveMatch).toBe(true);
  });

  it("reads surprising when both guesses miss the tested top", () => {
    const c = buildComparison({
      selfGive: "spokenWarmth",
      selfReceive: "spokenWarmth",
      testedGive: tested("helpingHands"),
      testedReceive: tested("undividedTime"),
    });
    expect(c.alignment).toBe("surprising");
    expect(c.giveMatch).toBe(false);
    expect(c.receiveMatch).toBe(false);
  });

  it("reads partial when one axis matches and one misses", () => {
    const c = buildComparison({
      selfGive: "spokenWarmth",
      selfReceive: "spokenWarmth",
      testedGive: tested("spokenWarmth"),
      testedReceive: tested("undividedTime"),
    });
    expect(c.alignment).toBe("partial");
    expect(c.giveMatch).toBe(true);
    expect(c.receiveMatch).toBe(false);
  });

  it("never emits em dashes in any insight (voice rule)", () => {
    const cases = [
      buildComparison({
        selfGive: null,
        selfReceive: null,
        testedGive: null,
        testedReceive: null,
      }),
      buildComparison({
        selfGive: "spokenWarmth",
        selfReceive: "undividedTime",
        testedGive: tested("spokenWarmth"),
        testedReceive: tested("undividedTime"),
      }),
      buildComparison({
        selfGive: "spokenWarmth",
        selfReceive: "spokenWarmth",
        testedGive: tested("helpingHands"),
        testedReceive: tested("undividedTime"),
      }),
      buildComparison({
        selfGive: "spokenWarmth",
        selfReceive: "spokenWarmth",
        testedGive: tested("spokenWarmth"),
        testedReceive: tested("undividedTime"),
      }),
    ];
    for (const c of cases) expect(c.insight).not.toContain("\u2014");
  });
});
