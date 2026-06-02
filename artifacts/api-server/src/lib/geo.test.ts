import { describe, it, expect } from "vitest";
import {
  canonicalizeCity,
  geocodeCity,
  haversineMiles,
  distanceToScore,
  proximityBetween,
  DEFAULT_RADIUS_MILES,
} from "./geo";

describe("canonicalizeCity", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(canonicalizeCity("  San   Francisco ")).toBe("san francisco");
  });

  it("resolves common aliases to their canonical city", () => {
    expect(canonicalizeCity("SF")).toBe("san francisco");
    expect(canonicalizeCity("NYC")).toBe("new york");
    expect(canonicalizeCity("LA")).toBe("los angeles");
    expect(canonicalizeCity("the bay")).toBe("san francisco");
  });

  it("strips a trailing state or country qualifier", () => {
    expect(canonicalizeCity("Austin, TX")).toBe("austin");
    expect(canonicalizeCity("Portland, Oregon")).toBe("portland");
  });

  it("returns empty string for empty input", () => {
    expect(canonicalizeCity(null)).toBe("");
    expect(canonicalizeCity("   ")).toBe("");
  });
});

describe("geocodeCity", () => {
  it("resolves known cities and aliases to coordinates", () => {
    const sf = geocodeCity("sf");
    expect(sf).not.toBeNull();
    expect(sf!.lat).toBeCloseTo(37.7749, 2);
  });

  it("returns null for an unknown city", () => {
    expect(geocodeCity("Smalltown")).toBeNull();
  });
});

describe("haversineMiles", () => {
  it("is zero for identical points", () => {
    const p = { lat: 40.0, lng: -75.0 };
    expect(haversineMiles(p, p)).toBeCloseTo(0, 5);
  });

  it("matches a known city-to-city distance within tolerance", () => {
    const sf = geocodeCity("san francisco")!;
    const la = geocodeCity("los angeles")!;
    // SF to LA is roughly 347 miles.
    const d = haversineMiles(sf, la);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });

  it("is symmetric", () => {
    const a = geocodeCity("new york")!;
    const b = geocodeCity("chicago")!;
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 6);
  });
});

describe("distanceToScore", () => {
  it("gives full credit inside the inner band", () => {
    expect(distanceToScore(0)).toBe(1);
    expect(distanceToScore(DEFAULT_RADIUS_MILES * 0.4)).toBe(1);
  });

  it("gives zero beyond twice the radius", () => {
    expect(distanceToScore(DEFAULT_RADIUS_MILES * 2)).toBe(0);
    expect(distanceToScore(DEFAULT_RADIUS_MILES * 5)).toBe(0);
  });

  it("falls off monotonically between the bands", () => {
    const mid = distanceToScore(DEFAULT_RADIUS_MILES);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(distanceToScore(DEFAULT_RADIUS_MILES * 1.5)).toBeLessThan(mid);
  });

  it("widens the falloff for a larger radius", () => {
    const tight = distanceToScore(50, 25);
    const wide = distanceToScore(50, 100);
    expect(wide).toBeGreaterThan(tight);
  });
});

describe("proximityBetween", () => {
  it("scores the same resolvable city as full proximity with a distance", () => {
    const r = proximityBetween("Denver", "denver");
    expect(r.score).toBe(1);
    expect(r.distanceMiles).toBeCloseTo(0, 5);
    expect(r.sameCanonicalCity).toBe(true);
    expect(r.approximate).toBe(false);
  });

  it("treats an alias and its full name as the same place", () => {
    const r = proximityBetween("SF", "San Francisco");
    expect(r.score).toBe(1);
    expect(r.distanceMiles).toBeCloseTo(0, 5);
  });

  it("grades two distant resolvable cities below a near pair", () => {
    const near = proximityBetween("San Francisco", "Oakland");
    const far = proximityBetween("San Francisco", "New York");
    expect(near.score).toBeGreaterThan(far.score);
    expect(far.score).toBe(0);
    expect(near.distanceMiles).not.toBeNull();
  });

  it("falls back to canonical equality when a city is unresolvable", () => {
    const same = proximityBetween("Smalltown", "smalltown");
    expect(same.score).toBe(1);
    expect(same.distanceMiles).toBeNull();
    expect(same.approximate).toBe(true);

    const diff = proximityBetween("Smalltown", "Othertown");
    expect(diff.score).toBe(0);
    expect(diff.approximate).toBe(true);
  });

  it("treats empty hints as no proximity, never a crash", () => {
    const r = proximityBetween(null, "Denver");
    expect(r.score).toBe(0);
    expect(r.sameCanonicalCity).toBe(false);
  });

  it("is symmetric in its two cities", () => {
    const ab = proximityBetween("Austin", "Chicago");
    const ba = proximityBetween("Chicago", "Austin");
    expect(ab.score).toBe(ba.score);
    expect(ab.distanceMiles).toBeCloseTo(ba.distanceMiles!, 6);
  });
});
