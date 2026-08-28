import { describe, expect, it } from "vitest";
import { playJourneyMoments } from "./playJourneyMoments";

describe("playJourneyMoments", () => {
  it("turns every durable Play family into a Journey moment", () => {
    const moments = playJourneyMoments({
      dailySpark: [{ questionId: "spark-1", createdAt: "2026-08-21T10:00:00.000Z" }],
      wouldYouRather: [{ promptId: "wyr-1", createdAt: "2026-08-21T10:01:00.000Z" }],
      scenarios: [{ scenarioId: "scene-1", createdAt: "2026-08-21T10:02:00.000Z" }],
      timeCapsules: [{ id: 7, createdAt: "2026-08-21T10:03:00.000Z" }],
      imports: [
        { id: 8, source: "preferences-paste", status: "complete", uploadedAt: "2026-08-21T10:04:00.000Z" },
        { id: 9, source: "quiz", status: "complete", parsedSummary: { archetype: "The Anchor" }, uploadedAt: "2026-08-21T10:05:00.000Z" },
      ],
    });

    expect(moments).toHaveLength(6);
    expect(moments.at(-1)?.title).toBe("Quiz result: The Anchor");
    expect(moments.every((moment) => moment.href.startsWith("/play"))).toBe(true);
  });

  it("ignores unrelated and incomplete imports", () => {
    expect(playJourneyMoments({
      imports: [
        { id: 1, source: "calendar-ics", status: "complete", uploadedAt: "2026-08-21T10:00:00.000Z" },
        { id: 2, source: "quiz", status: "pending", uploadedAt: "2026-08-21T10:01:00.000Z" },
      ],
    })).toEqual([]);
  });
});
