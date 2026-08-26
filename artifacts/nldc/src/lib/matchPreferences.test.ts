import { describe, expect, it } from "vitest";
import {
  isValidMatchAgeRange,
  normalizeMatchGenderPreference,
  parseMatchPreferenceLines,
  snapMatchRadiusKm,
} from "./matchPreferences";

describe("match preference helpers", () => {
  it("snaps historical radius values to a supported choice", () => {
    expect(snapMatchRadiusKm(null)).toBe("any");
    expect(snapMatchRadiusKm(54)).toBe("56");
    expect(snapMatchRadiusKm(200)).toBe("72");
  });

  it("keeps only current gender preference values", () => {
    expect(normalizeMatchGenderPreference("women")).toBe("women");
    expect(normalizeMatchGenderPreference("everyone")).toBe("any");
    expect(normalizeMatchGenderPreference(null)).toBe("any");
  });

  it("parses comma and newline lists without blank or duplicate values", () => {
    expect(
      parseMatchPreferenceLines("Kind\nCurious, kind,\nEmotionally available"),
    ).toEqual(["Kind", "Curious", "Emotionally available"]);
  });

  it("accepts only ordered adult age ranges", () => {
    expect(isValidMatchAgeRange(25, 45)).toBe(true);
    expect(isValidMatchAgeRange(17, 45)).toBe(false);
    expect(isValidMatchAgeRange(45, 25)).toBe(false);
    expect(isValidMatchAgeRange(25.5, 45)).toBe(false);
  });
});
