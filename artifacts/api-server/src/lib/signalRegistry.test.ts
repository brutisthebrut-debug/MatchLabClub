import { describe, it, expect } from "vitest";
import {
  SIGNAL_REGISTRY,
  coverageFor,
  normalizedWeights,
  confidenceWeightedWeights,
  decayMultiplier,
  applyDecay,
  contributorStep,
  describeActiveSignals,
  proposeWeightAdjustments,
  DECAY_FLOOR,
  type ReadinessBreakdown,
} from "./signalRegistry";

const zeroBreakdown: ReadinessBreakdown = {
  compass: 0,
  journal: 0,
  wellness: 0,
  hingeImport: 0,
  postDate: 0,
  wins: 0,
  calendar: 0,
  audits: 0,
  coaching: 0,
  instagram: 0,
  lifePulse: 0,
  taste: 0,
  lifestyle: 0,
  quizzes: 0,
  receipts: 0,
};

describe("signal registry", () => {
  it("normalizes weights to sum to 1.0", () => {
    const w = normalizedWeights();
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("reflects the current registry weights, auto-normalized to sum to 1", () => {
    // Raw registry weights now sum to 1.81: the original 1.0, plus the calendar
    // signal (0.1), the four brain-unification lanes (audits 0.16, coaching
    // 0.12, instagram 0.1, lifePulse 0.08), the two paste-based connector lanes
    // (taste 0.08, lifestyle 0.07), and the quizzes lane (0.1). Each normalized
    // weight is its raw weight divided by the raw-weight total. The relative
    // proportions between every signal are preserved exactly; adding
    // contributors never forces a manual re-balance. The receipts lane (0.1)
    // brings the raw total to 1.91.
    const total = 1.91;
    const w = normalizedWeights();
    expect(w.wellness).toBeCloseTo(0.22 / total, 6);
    expect(w.compass).toBeCloseTo(0.2 / total, 6);
    expect(w.hingeImport).toBeCloseTo(0.16 / total, 6);
    expect(w.postDate).toBeCloseTo(0.16 / total, 6);
    expect(w.audits).toBeCloseTo(0.16 / total, 6);
    expect(w.journal).toBeCloseTo(0.14 / total, 6);
    expect(w.wins).toBeCloseTo(0.12 / total, 6);
    expect(w.coaching).toBeCloseTo(0.12 / total, 6);
    expect(w.calendar).toBeCloseTo(0.1 / total, 6);
    expect(w.instagram).toBeCloseTo(0.1 / total, 6);
    expect(w.taste).toBeCloseTo(0.08 / total, 6);
    expect(w.lifePulse).toBeCloseTo(0.08 / total, 6);
    expect(w.lifestyle).toBeCloseTo(0.07 / total, 6);
    expect(w.quizzes).toBeCloseTo(0.1 / total, 6);
    expect(w.receipts).toBeCloseTo(0.1 / total, 6);
  });

  it("auto-normalizes when a new contributor is added, never breaking the sum", () => {
    // Simulate registering a brand-new signal source (e.g. a Spotify connector)
    // with its own id and a heavy weight. The sum must stay 1.0 with no manual
    // re-balancing of the existing contributors.
    const newSignal = {
      ...SIGNAL_REGISTRY[0],
      id: "spotify",
      weight: 0.3,
    } as unknown as (typeof SIGNAL_REGISTRY)[number];
    const extended = [...SIGNAL_REGISTRY, newSignal];
    const w = normalizedWeights(extended);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(Object.keys(w)).toContain("spotify");
    // Existing contributors keep their relative proportions to each other.
    expect(w.wellness / w.compass).toBeCloseTo(0.22 / 0.2, 6);
  });

  it("binary signals are all-or-nothing, count signals scale by denominator", () => {
    const hinge = SIGNAL_REGISTRY.find((c) => c.id === "hingeImport")!;
    expect(coverageFor(hinge, 0)).toBe(0);
    expect(coverageFor(hinge, 1)).toBe(100);
    expect(coverageFor(hinge, 9)).toBe(100);

    const wellness = SIGNAL_REGISTRY.find((c) => c.id === "wellness")!;
    expect(coverageFor(wellness, 0)).toBe(0);
    expect(coverageFor(wellness, 9)).toBe(50);
    expect(coverageFor(wellness, 18)).toBe(100);
    expect(coverageFor(wellness, 99)).toBe(100);
  });

  it("ranks the hinge import as the single biggest step", () => {
    const w = normalizedWeights();
    const steps = SIGNAL_REGISTRY.map((c) => ({
      id: c.id,
      step: contributorStep(c, w),
    }));
    const top = steps.sort((a, b) => b.step - a.step)[0];
    expect(top.id).toBe("hingeImport");
  });

  it("describes only signals with non-zero coverage", () => {
    expect(describeActiveSignals(zeroBreakdown)).toEqual([]);
    const lines = describeActiveSignals({
      ...zeroBreakdown,
      wellness: 50,
      compass: 20,
    });
    expect(lines.length).toBe(2);
    expect(lines.some((l) => /50%/.test(l))).toBe(true);
    expect(lines.some((l) => /20%/.test(l))).toBe(true);
  });

  it("contains no em dashes in any registry-facing copy", () => {
    const blobs: string[] = [];
    for (const c of SIGNAL_REGISTRY) {
      blobs.push(c.label, c.action.label, c.action.detail, c.describe(50));
    }
    for (const s of blobs) expect(s).not.toContain("\u2014");
  });
});

describe("proposeWeightAdjustments (the breathing layer)", () => {
  it("leaves defaults untouched when there are no outcomes", () => {
    const adj = proposeWeightAdjustments({
      anotherDate: 0,
      noMore: 0,
      ghosted: 0,
      unsure: 0,
    });
    for (const a of adj) {
      expect(a.adjustedWeight).toBeCloseTo(a.defaultWeight, 4);
    }
  });

  it("leans into in-person fit signals when dates keep fizzling", () => {
    const adj = proposeWeightAdjustments({
      anotherDate: 0,
      noMore: 3,
      ghosted: 2,
      unsure: 0,
    });
    const postDate = adj.find((a) => a.id === "postDate")!;
    const compass = adj.find((a) => a.id === "compass")!;
    expect(postDate.adjustedWeight).toBeGreaterThan(postDate.defaultWeight);
    expect(compass.adjustedWeight).toBeGreaterThan(compass.defaultWeight);
  });

  it("stays bounded and always re-normalizes to 1.0", () => {
    const adj = proposeWeightAdjustments({
      anotherDate: 0,
      noMore: 50,
      ghosted: 50,
      unsure: 0,
    });
    const sum = adj.reduce((a, b) => a + b.adjustedWeight, 0);
    // adjustedWeight is rounded to 4 decimals for display, so summing across all
    // contributors can drift in the 4th decimal. The underlying re-normalization
    // is exact; assert to 3 decimals to allow for that rounding.
    expect(sum).toBeCloseTo(1, 3);
    for (const a of adj) {
      // No signal moves more than ~30% of its default in either direction.
      expect(a.adjustedWeight).toBeLessThanOrEqual(a.defaultWeight * 1.3 + 0.01);
    }
  });

  it("does not lean when only a single date has been logged", () => {
    const adj = proposeWeightAdjustments({
      anotherDate: 0,
      noMore: 1,
      ghosted: 0,
      unsure: 0,
    });
    for (const a of adj) {
      expect(a.adjustedWeight).toBeCloseTo(a.defaultWeight, 4);
    }
  });
});

describe("confidenceWeightedWeights", () => {
  it("re-normalizes to sum 1.0", () => {
    const base = normalizedWeights();
    const w = confidenceWeightedWeights(base);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it("raises a high-confidence lane's share and lowers a low-confidence one", () => {
    const base = normalizedWeights();
    const w = confidenceWeightedWeights(base);
    // Post-date notes are the highest-confidence lane (0.85), wins among the
    // lowest (0.5). Confidence weighting should push the trusted lane up
    // relative to its base share and the weak lane down.
    expect(w["postDate"]! / base["postDate"]!).toBeGreaterThan(
      w["wins"]! / base["wins"]!,
    );
  });

  it("is a pure function of its input weights", () => {
    const base = normalizedWeights();
    const a = confidenceWeightedWeights(base);
    const b = confidenceWeightedWeights(base);
    expect(a).toEqual(b);
  });
});

describe("decayMultiplier", () => {
  it("is full strength for fresh or future-dated activity", () => {
    expect(decayMultiplier(0, 30)).toBe(1);
    expect(decayMultiplier(-5, 30)).toBe(1);
  });

  it("halves at one half-life", () => {
    expect(decayMultiplier(30, 30)).toBeCloseTo(0.5, 9);
    expect(decayMultiplier(60, 60)).toBeCloseTo(0.5, 9);
  });

  it("never falls below the floor", () => {
    expect(decayMultiplier(100000, 30)).toBe(DECAY_FLOOR);
  });

  it("decreases monotonically as a lane ages", () => {
    expect(decayMultiplier(10, 30)).toBeGreaterThan(decayMultiplier(40, 30));
  });

  it("treats a non-positive half-life as no decay", () => {
    expect(decayMultiplier(50, 0)).toBe(1);
  });
});

describe("applyDecay", () => {
  const full: ReadinessBreakdown = {
    compass: 100,
    journal: 100,
    wellness: 100,
    hingeImport: 100,
    postDate: 100,
    wins: 100,
    calendar: 100,
    audits: 100,
    coaching: 100,
    instagram: 100,
    lifePulse: 100,
    taste: 100,
    lifestyle: 100,
    quizzes: 100,
    receipts: 100,
  };

  it("leaves durable lanes (no half-life) untouched", () => {
    const out = applyDecay(full, { wellness: 9999, journal: 9999, audits: 9999 });
    expect(out.wellness).toBe(100);
    expect(out.journal).toBe(100);
    expect(out.audits).toBe(100);
  });

  it("fades a stale time-sensitive lane toward the floor", () => {
    const out = applyDecay(full, { lifePulse: 100000 });
    expect(out.lifePulse).toBe(Math.round(100 * DECAY_FLOOR));
  });

  it("does not fade lanes with unknown recency", () => {
    const out = applyDecay(full, { lifePulse: null });
    expect(out.lifePulse).toBe(100);
  });

  it("never mutates the input breakdown", () => {
    const snapshot = { ...full };
    applyDecay(full, { lifePulse: 100000, compass: 100000 });
    expect(full).toEqual(snapshot);
  });

  it("halves a lane at exactly one half-life", () => {
    // lifePulse half-life is 30 days.
    const out = applyDecay(full, { lifePulse: 30 });
    expect(out.lifePulse).toBe(50);
  });
});
