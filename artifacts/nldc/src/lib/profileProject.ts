export type ProfileProjectDraft = {
  platform: string;
  bio: string;
  prompts: string;
  photoCount: string;
  notes: string;
};

export type SavedProfileLike = {
  id: number;
  platform: string;
  bio: string;
  prompts?: string | null;
  photoCount?: number | null;
  notes?: string | null;
};

export type ProfileRewriteLike = {
  rewrittenBio: string;
  rewrittenPrompts: Array<{ rewritten: string }>;
  tips: string[];
};

export function emptyProfileProjectDraft(): ProfileProjectDraft {
  return {
    platform: "",
    bio: "",
    prompts: "",
    photoCount: "",
    notes: "",
  };
}

export function draftFromSavedProfile(
  profile: SavedProfileLike,
): ProfileProjectDraft {
  return {
    platform: profile.platform,
    bio: profile.bio,
    prompts: profile.prompts ?? "",
    photoCount:
      profile.photoCount === null || profile.photoCount === undefined
        ? ""
        : String(profile.photoCount),
    notes: profile.notes ?? "",
  };
}

export function buildProfileVersionInput(draft: ProfileProjectDraft) {
  const platform = draft.platform.trim();
  const bio = draft.bio.trim();
  if (!platform || !bio) return null;

  const parsedPhotoCount =
    draft.photoCount.trim() === "" ? null : Number(draft.photoCount);

  return {
    platform,
    bio,
    prompts: draft.prompts.trim() || null,
    photoCount:
      parsedPhotoCount !== null &&
      Number.isInteger(parsedPhotoCount) &&
      parsedPhotoCount >= 0
        ? parsedPhotoCount
        : null,
    notes: draft.notes.trim() || null,
  };
}

export function buildRewriteVersionInput(
  source: SavedProfileLike,
  rewrite: ProfileRewriteLike,
) {
  const prompts = rewrite.rewrittenPrompts
    .map((prompt) => prompt.rewritten.trim())
    .filter(Boolean)
    .join("\n\n");

  const versionNote = `Rewrite version created from saved profile #${source.id}.`;
  const tips = rewrite.tips.map((tip) => tip.trim()).filter(Boolean).join(" ");

  return {
    platform: source.platform,
    bio: rewrite.rewrittenBio.trim(),
    prompts: prompts || source.prompts || null,
    photoCount: source.photoCount ?? null,
    notes: [versionNote, tips, source.notes?.trim()]
      .filter(Boolean)
      .join(" "),
  };
}
