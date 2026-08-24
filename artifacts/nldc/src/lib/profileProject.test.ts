import { describe, expect, it } from "vitest";
import {
  buildProfileVersionInput,
  buildRewriteVersionInput,
  draftFromSavedProfile,
  emptyProfileProjectDraft,
} from "./profileProject";

describe("Profile Project versions", () => {
  it("requires a platform and bio before creating a durable version", () => {
    expect(buildProfileVersionInput(emptyProfileProjectDraft())).toBeNull();
  });

  it("normalizes a member-authored profile version without scoring it", () => {
    expect(
      buildProfileVersionInput({
        platform: "  Hinge ",
        bio: "  A specific bio. ",
        prompts: " Prompt answer ",
        photoCount: "6",
        notes: " Current live version ",
      }),
    ).toEqual({
      platform: "Hinge",
      bio: "A specific bio.",
      prompts: "Prompt answer",
      photoCount: 6,
      notes: "Current live version",
    });
  });

  it("reopens every saved field for another version", () => {
    expect(
      draftFromSavedProfile({
        id: 8,
        platform: "Feeld",
        bio: "Bio",
        prompts: "Prompts",
        photoCount: 4,
        notes: "Version note",
      }),
    ).toEqual({
      platform: "Feeld",
      bio: "Bio",
      prompts: "Prompts",
      photoCount: "4",
      notes: "Version note",
    });
  });

  it("saves a rewrite as a new traceable version instead of overwriting", () => {
    const source = {
      id: 42,
      platform: "Hinge",
      bio: "Original bio",
      prompts: "Original prompt",
      photoCount: 5,
      notes: "Spring profile",
    };

    expect(
      buildRewriteVersionInput(source, {
        rewrittenBio: "A warmer, more specific bio.",
        rewrittenPrompts: [
          { rewritten: "A specific prompt answer." },
          { rewritten: "Another answer." },
        ],
        tips: ["Keep the concrete detail.", "Invite a real question."],
      }),
    ).toEqual({
      platform: "Hinge",
      bio: "A warmer, more specific bio.",
      prompts: "A specific prompt answer.\n\nAnother answer.",
      photoCount: 5,
      notes:
        "Rewrite version created from saved profile #42. Keep the concrete detail. Invite a real question. Spring profile",
    });

    expect(source.bio).toBe("Original bio");
  });
});
