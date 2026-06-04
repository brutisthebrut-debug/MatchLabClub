import { describe, it, expect } from "vitest";
import {
  computeChart,
  synastryResonance,
  buildCosmicWeather,
} from "./cosmic";

const CHART_A = computeChart({
  birthDate: "1990-07-15",
  birthTime: "14:30",
  birthPlace: "New York, NY",
  birthLat: 40.7128,
  birthLng: -74.006,
});

const CHART_B = computeChart({
  birthDate: "1988-11-02",
  birthTime: "06:10",
  birthPlace: "Lisbon, PT",
  birthLat: 38.7223,
  birthLng: -9.1393,
});

describe("synastryResonance", () => {
  it("stays inside the gentle 35 to 97 band", () => {
    const { score } = synastryResonance(CHART_A, CHART_B);
    expect(score).toBeGreaterThanOrEqual(35);
    expect(score).toBeLessThanOrEqual(97);
  });

  it("is symmetric and carries a short note", () => {
    const ab = synastryResonance(CHART_A, CHART_B);
    const ba = synastryResonance(CHART_B, CHART_A);
    expect(ab.score).toBe(ba.score);
    expect(typeof ab.note).toBe("string");
    expect(ab.note.length).toBeGreaterThan(0);
  });

  it("gives a chart compared with itself a high but still bounded score", () => {
    const { score } = synastryResonance(CHART_A, CHART_A);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(97);
  });
});

describe("buildCosmicWeather", () => {
  it("wraps a real action and carries its honest detail underneath", () => {
    const action = {
      label: "Add a post-date note",
      detail: "Reflecting on your last date is the highest-value signal now.",
      href: "/me/matching",
    };
    const weather = buildCosmicWeather(CHART_A, action);
    expect(typeof weather.headline).toBe("string");
    expect(weather.headline.length).toBeGreaterThan(0);
    // The real action travels through unchanged: no rewrite, no swap.
    expect(weather.action).toEqual(action);
    expect(weather.reframe).toContain(action.detail);
  });

  it("stays honest when there is no pending action", () => {
    const weather = buildCosmicWeather(CHART_A, null);
    expect(weather.action).toBeNull();
    expect(typeof weather.reframe).toBe("string");
    expect(weather.reframe.length).toBeGreaterThan(0);
  });
});
