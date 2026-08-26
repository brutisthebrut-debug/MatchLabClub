import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, wyrAnswersTable } from "@workspace/db";
import { CreateWouldYouRatherAnswerBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const PermissionPatch = z.object({
  echoUse: z.boolean().optional(),
  learningConfirmed: z.boolean().optional(),
  matchingUse: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one permission field is required",
});

type Row = typeof wyrAnswersTable.$inferSelect;

function serialize(row: Row) {
  return {
    promptId: row.promptId,
    choice: row.choice,
    echoUseAllowed: row.echoUseAllowed,
    learningConfirmed: row.learningConfirmed,
    matchingUseAllowed: row.matchingUseAllowed,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/would-you-rather", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(wyrAnswersTable)
    .where(eq(wyrAnswersTable.userId, req.user.id))
    .orderBy(desc(wyrAnswersTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/would-you-rather", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateWouldYouRatherAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, prompt): answering the same prompt again updates the
  // choice in place so the distinct-prompt count that feeds readiness stays
  // honest. We store only which side was picked, never any free text.
  const [row] = await db
    .insert(wyrAnswersTable)
    .values({
      userId: req.user.id,
      promptId: parsed.data.promptId,
      choice: parsed.data.choice,
    })
    .onConflictDoUpdate({
      target: [wyrAnswersTable.userId, wyrAnswersTable.promptId],
      set: { choice: parsed.data.choice, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/me/would-you-rather/:promptId/permissions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = PermissionPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(wyrAnswersTable)
    .where(and(
      eq(wyrAnswersTable.userId, req.user.id),
      eq(wyrAnswersTable.promptId, req.params.promptId),
    ))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Answer not found" });
    return;
  }

  const now = new Date();
  const patch: Partial<typeof wyrAnswersTable.$inferInsert> = {};
  if (parsed.data.echoUse !== undefined) {
    patch.echoUseAllowed = parsed.data.echoUse;
    patch.echoUseUpdatedAt = now;
  }
  if (parsed.data.learningConfirmed !== undefined) {
    patch.learningConfirmed = parsed.data.learningConfirmed;
    patch.learningConfirmedAt = parsed.data.learningConfirmed ? now : null;
  }
  if (parsed.data.matchingUse !== undefined) {
    patch.matchingUseAllowed = parsed.data.matchingUse;
    patch.matchingUseUpdatedAt = now;
  }

  const [updated] = await db
    .update(wyrAnswersTable)
    .set(patch)
    .where(and(
      eq(wyrAnswersTable.userId, req.user.id),
      eq(wyrAnswersTable.promptId, req.params.promptId),
    ))
    .returning();
  res.json(serialize(updated));
});

export default router;
