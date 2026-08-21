import { describe, expect, it } from "vitest";
import { playJourneyMomentsFromRecords } from "./playJourneyHistory";

describe("playJourneyMomentsFromRecords", () => {
  it("turns every bounded Play record family into durable Journey moments", () => {
    const moments = playJourneyMomentsFromRecords({
      dailySpark: [
        { questionId: "spark-1", createdAt: "2026-08-21T10:00:00.000Z" },
      ],
      wouldYouRather: [
        { promptId: "wyr-1", createdAt: "2026-08-21T10:01:00.000Z" },
      ],
      scenarios: [
        { scenarioId: "scene-1", createdAt: "2026-08-21T10:02:00.000Z" },
      ],
      timeCapsules: [
        { id: 7, createdAt: "2026-08-21T10:03:00.000Z" },
      ],
      imports: [
        {
          id: 8,
          source: "preferences-paste",
          status: "complete",
          uploadedAt: "2026-08-21T10:04:00.000Z",
        },
        {
          id: 9,
          source: "quiz",
          status: "complete",
          parsedSummary: { archetype: "The Anchor" },
          uploadedAt: "2026-08-21T10:05:00.000Z",
        },
      ],
    });

    expect(moments).toHaveLength(6);
    expect(moments.map((moment) => moment.href)).toEqual([
      "/games/daily-spark",
      "/games/would-you-rather",
      "/games/scenarios",
      "/games/time-capsule",
      "/this-or-that",
      "/quizzes",
    ]);
    expect(moments.at(-1)?.title).toBe("Quiz Lab result: The Anchor");
  });

  it("ignores unrelated and incomplete imports", () => {
    const moments = playJourneyMomentsFromRecords({
      imports: [
        {
          id: 1,
          source: "calendar-ics",
          status: "complete",
          uploadedAt: "2026-08-21T10:00:00.000Z",
        },
        {
          id: 2,
          source: "quiz",
          status: "pending",
          uploadedAt: "2026-08-21T10:01:00.000Z",
        },
      ],
    });

    expect(moments).toEqual([]);
  });
});
