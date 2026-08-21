import { describe, expect, it } from "vitest";
import { quizResultsFromImports } from "./quizResultHistory";

describe("quizResultsFromImports", () => {
  it("uses complete server quiz rows and ignores unrelated or incomplete imports", () => {
    const results = quizResultsFromImports([
      {
        id: 1,
        source: "quiz",
        status: "complete",
        parsedSummary: {
          slug: "attachment-style",
          archetypeKey: "anchor",
          archetype: "The Anchor",
        },
        uploadedAt: "2026-08-20T12:00:00.000Z",
      },
      {
        id: 2,
        source: "calendar-ics",
        status: "complete",
        parsedSummary: { slug: "not-a-quiz" },
        uploadedAt: "2026-08-21T12:00:00.000Z",
      },
      {
        id: 3,
        source: "quiz",
        status: "pending",
        parsedSummary: {
          slug: "love-pace",
          archetypeKey: "steady",
          archetype: "The Steady One",
        },
        uploadedAt: "2026-08-21T12:00:00.000Z",
      },
    ]);

    expect(results).toEqual([
      {
        slug: "attachment-style",
        archetypeKey: "anchor",
        archetypeName: "The Anchor",
        takenAt: "2026-08-20T12:00:00.000Z",
      },
    ]);
  });

  it("keeps only the newest server result for a retaken quiz", () => {
    const results = quizResultsFromImports([
      {
        id: 10,
        source: "quiz",
        status: "complete",
        parsedSummary: {
          slug: "love-pace",
          archetypeKey: "observer",
          archetype: "The Observer",
        },
        uploadedAt: "2026-08-19T12:00:00.000Z",
      },
      {
        id: 11,
        source: "quiz",
        status: "complete",
        parsedSummary: {
          slug: "love-pace",
          archetypeKey: "steady",
          archetype: "The Steady One",
        },
        uploadedAt: "2026-08-21T12:00:00.000Z",
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.archetypeKey).toBe("steady");
  });
});
