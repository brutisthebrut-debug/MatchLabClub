import { describe, it, expect } from "vitest";
import { buildCosmicShareText } from "./cosmic";

describe("buildCosmicShareText", () => {
  it("renders sign labels and love-line cities into a readable string", () => {
    const text = buildCosmicShareText(
      { sun: "Cancer", moon: "Pisces", rising: "Libra" },
      ["Lisbon, Portugal", "Austin, TX", "Kyoto, Japan"],
    );
    expect(text).toContain("Sun Cancer");
    expect(text).toContain("Moon Pisces");
    expect(text).toContain("Rising Libra");
    expect(text).toContain(
      "My love lines run through Lisbon, Portugal, Austin, TX, Kyoto, Japan.",
    );
    expect(text).not.toContain("[object Object]");
  });

  it("omits missing signs and the love-line clause when there are no cities", () => {
    const text = buildCosmicShareText(
      { sun: "Aries", moon: null, rising: null },
      [],
    );
    expect(text).toContain("Sun Aries");
    expect(text).not.toContain("Moon");
    expect(text).not.toContain("Rising");
    expect(text).not.toContain("love lines run through");
  });

  it("caps love-line cities at three", () => {
    const text = buildCosmicShareText({ sun: "Leo", moon: null, rising: null }, [
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(text).toContain("A, B, C");
    expect(text).not.toContain("D");
  });

  it("returns an empty string when no signs are present", () => {
    expect(
      buildCosmicShareText({ sun: null, moon: null, rising: null }, ["Paris"]),
    ).toBe("");
  });
});
