import { describe, expect, it } from "vitest";
import {
  presentPhotoLabRun,
  type ProfilePhotoLabRun,
} from "./profilePhotoLab";

describe("Profile Project Photo Lab presentation", () => {
  it("keeps provenance and ordering while omitting numeric appearance scores", () => {
    const run = {
      id: 42,
      sourcePhotoIds: [7],
      inputSnapshot: {
        photos: [
          {
            id: "profile-photo-7",
            shotType: "solo_face",
            wellLit: true,
            genuineExpression: true,
          },
        ],
        datingGoal: null,
        sourceApp: "Hinge",
      },
      result: {
        leadShotId: "profile-photo-7",
        leadShotRationale: "A clear solo introduction.",
        summary: "Start with the clearest introduction.",
        ranked: [
          {
            id: "profile-photo-7",
            rank: 1,
            score: 99,
            role: "Lead shot",
            isLead: true,
            notes: ["Clear context"],
          },
        ],
        checklist: [],
        visionMode: "fallback",
        visionFallbackReason: null,
        visionAnalysis: null,
        nextSignal: null,
        mirror: null,
      },
      createdAt: "2026-08-24T12:00:00.000Z",
    } as ProfilePhotoLabRun;

    const presented = presentPhotoLabRun(run);

    expect(presented.sourcePhotoIds).toEqual([7]);
    expect(presented.ranked[0]).toEqual({
      id: "profile-photo-7",
      rank: 1,
      role: "Lead shot",
      isLead: true,
      notes: ["Clear context"],
    });
    expect(JSON.stringify(presented)).not.toContain('"score"');
  });
});
