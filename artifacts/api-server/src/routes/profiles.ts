import { Router, type IRouter } from "express";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import {
  CreateProfileBody,
  UpdateProfileBody,
  ListProfilesResponse,
  GetProfileResponse,
  UpdateProfileResponse,
  RewriteProfileBioResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function userScope(userId: string | undefined): SQL {
  return userId ? eq(profilesTable.userId, userId) : isNull(profilesTable.userId);
}

router.get("/profiles", async (req, res): Promise<void> => {
  const profiles = await db
    .select()
    .from(profilesTable)
    .where(userScope(req.user?.id))
    .orderBy(profilesTable.createdAt);
  res.json(ListProfilesResponse.parse(profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
  }))));
});

router.post("/profiles", async (req, res): Promise<void> => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({ ...parsed.data, userId: req.user?.id ?? null })
    .returning();
  res.status(201).json(GetProfileResponse.parse({
    ...profile,
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : String(profile.createdAt),
  }));
});

router.get("/profiles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(and(eq(profilesTable.id, id), userScope(req.user?.id)));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(GetProfileResponse.parse({
    ...profile,
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : String(profile.createdAt),
  }));
});

router.patch("/profiles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db
    .update(profilesTable)
    .set(parsed.data)
    .where(and(eq(profilesTable.id, id), userScope(req.user?.id)))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(UpdateProfileResponse.parse({
    ...profile,
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : String(profile.createdAt),
  }));
});

router.post("/profiles/:id/rewrite", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(and(eq(profilesTable.id, id), userScope(req.user?.id)));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const rewrite = RewriteProfileBioResponse.parse({
    profileId: id,
    rewrittenBio: `I make a genuinely great first date — I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to. Currently: way too invested in my sourdough starter, rewatching things I've already seen, and looking for someone worth getting off the couch for. If any of that sounds familiar, let's find out.`,
    rewrittenPrompts: [
      {
        original: profile.prompts?.split("\n")[0] || "The way to win me over is...",
        rewritten: "Remembering the weird specific thing I mentioned once. That's it. That's the whole thing.",
        tip: "Specificity beats sincerity. Readers fill in the blanks with their own version of you.",
      },
      {
        original: profile.prompts?.split("\n")[1] || "A green flag I look for...",
        rewritten: "When someone admits they don't know something. Confidence without ego is wildly attractive.",
        tip: "This reveals values without sounding like a therapist. Standards are attractive.",
      },
    ],
    tips: [
      "Lead with a scene, not a list of traits — put the reader in a moment with you",
      "Cut any phrase that could appear in 1,000 other bios ('love to travel', 'big on authenticity')",
      "End your bio with a soft invitation — make it easy for someone to message you",
    ],
  });

  res.json(rewrite);
});

export default router;
