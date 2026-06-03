import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, predictionResponsesTable } from "@workspace/db";
import { CreatePredictionResponseBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof predictionResponsesTable.$inferSelect;

function serialize(row: Row) {
  return {
    itemId: row.itemId,
    predicted: row.predicted,
    actual: row.actual,
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
  // counts in place so the distinct-round count that feeds readiness stays
  // honest. We store only the two counts, never which statements were marked
  // true.
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

export default router;
