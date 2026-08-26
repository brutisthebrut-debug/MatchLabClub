import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, dailySparkAnswersTable } from "@workspace/db";
import { CreateDailySparkAnswerBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const PermissionPatch = z.object({
  echoUse: z.boolean().optional(),
  learningConfirmed: z.boolean().optional(),
  matchingUse: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one permission field is required",
});

type Row = typeof dailySparkAnswersTable.$inferSelect;

function serialize(row: Row) {
  return {
    questionId: row.questionId,
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

router.get("/me/daily-spark", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(dailySparkAnswersTable)
    .where(eq(dailySparkAnswersTable.userId, req.user.id))
    .orderBy(desc(dailySparkAnswersTable.createdAt))
    .limit(400);
  res.json(rows.map(serialize));
});

router.post("/me/daily-spark", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateDailySparkAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, question): answering the same question again updates the
  // choice in place. Saving stays private and never changes downstream
  // permissions. We store only which option was picked, never any free text.
  const [row] = await db
    .insert(dailySparkAnswersTable)
    .values({
      userId: req.user.id,
      questionId: parsed.data.questionId,
      choice: parsed.data.choice,
    })
    .onConflictDoUpdate({
      target: [dailySparkAnswersTable.userId, dailySparkAnswersTable.questionId],
      set: { choice: parsed.data.choice, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/me/daily-spark/:questionId/permissions", async (req, res): Promise<void> => {
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
    .from(dailySparkAnswersTable)
    .where(and(
      eq(dailySparkAnswersTable.userId, req.user.id),
      eq(dailySparkAnswersTable.questionId, req.params.questionId),
    ))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Answer not found" });
    return;
  }

  const now = new Date();
  const patch: Partial<typeof dailySparkAnswersTable.$inferInsert> = {};
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
    .update(dailySparkAnswersTable)
    .set(patch)
    .where(and(
      eq(dailySparkAnswersTable.userId, req.user.id),
      eq(dailySparkAnswersTable.questionId, req.params.questionId),
    ))
    .returning();
  res.json(serialize(updated));
});

export default router;
