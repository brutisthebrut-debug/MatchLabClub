import { describe, expect, it } from "vitest";
import { durableJourneyMoments } from "./durableJourneyMoments";

describe("durableJourneyMoments", () => {
  it("projects insights, compatibility reads, and introductions without raw or numeric data", () => {
    const moments = durableJourneyMoments({
      insights: [{ id: 1, sourceLabel: "Hinge conversation", status: "complete", createdAt: "2026-08-20T10:00:00.000Z" }],
      compatibilityReads: [{
        id: 2,
        parsedProfile: { connectionStyle: "Slow and intentional", name: "Private Name" },
        createdAt: "2026-08-21T10:00:00.000Z",
      }],
      connections: [{ id: "123e4567-e89b-12d3-a456-426614174000", status: "active", createdAt: "2026-08-22T10:00:00.000Z" }],
    });

    expect(moments.map((moment) => moment.kind)).toEqual(["insight", "compatibility", "introduction"]);
    expect(moments[1]?.title).toBe("Compatibility read: Slow and intentional");
    expect(moments[2]?.href).toBe("/matches/123e4567-e89b-12d3-a456-426614174000");
    const serialized = JSON.stringify(moments);
    expect(serialized).not.toContain("Private Name");
    expect(serialized).not.toMatch(/alignment|readinessScore|overallAlignment/);
  });

  it("uses generic language when a compatibility read has no bounded style", () => {
    const [moment] = durableJourneyMoments({
      compatibilityReads: [{ id: 4, parsedProfile: null, createdAt: new Date("2026-08-21T10:00:00.000Z") }],
    });
    expect(moment).toMatchObject({
      title: "Compatibility read saved",
      occurredAt: "2026-08-21T10:00:00.000Z",
    });
  });
});
