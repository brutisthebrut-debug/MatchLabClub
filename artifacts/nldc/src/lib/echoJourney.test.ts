import { describe, expect, it } from "vitest";
import {
  JOURNEY_CHAPTERS,
  PRIMARY_DESTINATIONS,
  chapterForLocation,
  destinationForLocation,
} from "./echoJourney";

describe("Echo Journey shell contract", () => {
  it("keeps exactly the five approved primary destinations", () => {
    expect(PRIMARY_DESTINATIONS.map((destination) => destination.name)).toEqual(
      ["Today", "Matches", "My MatchLab", "Journey", "Play"],
    );
  });

  it("keeps the eight approved story chapters in order", () => {
    expect(JOURNEY_CHAPTERS.map((chapter) => chapter.name)).toEqual([
      "Arrive",
      "First read",
      "Play",
      "Confirm",
      "Waiting",
      "Introduction",
      "Date",
      "Reflect",
    ]);
  });

  it("maps deep routes back to one visible destination", () => {
    expect(destinationForLocation("/matches/member-1")).toBe("matches");
    expect(destinationForLocation("/mirror/journal")).toBe("matchlab");
    expect(destinationForLocation("/progress/scorecard")).toBe("journey");
    expect(destinationForLocation("/games/time-capsule")).toBe("play");
    expect(destinationForLocation("/copilot/reply")).toBe("today");
    expect(destinationForLocation("/report/42")).toBe("matchlab");
    expect(destinationForLocation("/reflection")).toBe("journey");
    expect(destinationForLocation("/account")).toBeNull();
  });

  it("uses the most specific story chapter when a route has one", () => {
    expect(chapterForLocation("/today")).toBe(0);
    expect(chapterForLocation("/matches")).toBe(5);
    expect(chapterForLocation("/date-safety")).toBe(6);
    expect(chapterForLocation("/progress/timeline")).toBe(7);
  });
});
