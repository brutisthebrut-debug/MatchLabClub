import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, predictionResponsesTable } from "@workspace/db";
import { CreatePredictionResponseBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const PermissionPatch = z.object({
  echoUse: z.boolean().optional(),
  learningConfirmed: z.boolean().optional(),
  matchingUse: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one permission field is required",
});

type Row = typeof predictionResponsesTable.$inferSelect;

function serialize(row: Row) {
  return {
    itemId: row.itemId,
    predicted: row.predicted,
    actual: row.actual,
    echoUseAllowed: row.echoUseAllowed,
    learningConfirmed: row.learningConfirmed,
    matchingUseAllowed: row.matchingUseAllowed,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/predictions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(predictionResponsesTable)
    .where(eq(predictionResponsesTable.userId, req.user.id))
    .orderBy(desc(predictionResponsesTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/predictions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreatePredictionResponseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, item): replaying a round updates the predicted and actual
  // counts in place. Saving stays private and never changes downstream
  // permissions. We store only the two counts, never individual statements.
  const [row] = await db
    .insert(predictionResponsesTable)
    .values({
      userId: req.user.id,
      itemId: parsed.data.itemId,
      predicted: parsed.data.predicted,
      actual: parsed.data.actual,
    })
    .onConflictDoUpdate({
      target: [predictionResponsesTable.userId, predictionResponsesTable.itemId],
      set: {
        predicted: parsed.data.predicted,
        actual: parsed.data.actual,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/me/predictions/:itemId/permissions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = PermissionPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(predictionResponsesTable).where(and(
    eq(predictionResponsesTable.userId, req.user.id),
    eq(predictionResponsesTable.itemId, req.params.itemId),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Response not found" });
    return;
  }
  const now = new Date();
  const patch: Partial<typeof predictionResponsesTable.$inferInsert> = {};
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
  const [updated] = await db.update(predictionResponsesTable).set(patch).where(and(
    eq(predictionResponsesTable.userId, req.user.id),
    eq(predictionResponsesTable.itemId, req.params.itemId),
  )).returning();
  res.json(serialize(updated));
});

export default router;
