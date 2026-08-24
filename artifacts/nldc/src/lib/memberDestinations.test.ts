import { describe, expect, it } from "vitest";
import { destinationIdForPath } from "./memberDestinations";

describe("destinationIdForPath", () => {
  it.each([
    ["/today", "today"],
    ["/matches", "matches"],
    ["/my-matchlab", "my-matchlab"],
    ["/journey", "journey"],
    ["/play", "play"],
    ["/trust-data", "trust-data"],
  ])("maps canonical route %s", (path, expected) => {
    expect(destinationIdForPath(path)).toBe(expected);
  });

  it.each([
    ["/echo", "today"],
    ["/coach", "today"],
    ["/matching", "matches"],
    ["/your-mirror", "my-matchlab"],
    ["/my-matchlab/profile", "my-matchlab"],
    ["/glow-up", "my-matchlab"],
    ["/copilot/profile", "my-matchlab"],
    ["/mirror/journal", "journey"],
    ["/progress/wins", "journey"],
    ["/quizzes/attachment-style", "play"],
    ["/imports", "trust-data"],
  ])("keeps legacy route %s inside its new destination", (path, expected) => {
    expect(destinationIdForPath(path)).toBe(expected);
  });

  it("uses the most specific route when legacy prefixes overlap", () => {
    expect(destinationIdForPath("/copilot/debrief")).toBe("journey");
    expect(destinationIdForPath("/copilot/weekly-plan")).toBe("journey");
    expect(destinationIdForPath("/copilot/prep")).toBe("today");
  });

  it("does not match unrelated paths that merely share a prefix", () => {
    expect(destinationIdForPath("/matches-made-up")).toBeNull();
  });

  it("ignores query strings, hashes, and trailing slashes", () => {
    expect(destinationIdForPath("/imports/?tab=permissions#source")).toBe(
      "trust-data",
    );
  });
});
