import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, behavioralGrowthEventsTable } from "@workspace/db";
import { RecordGrowthEventBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof behavioralGrowthEventsTable.$inferSelect;

function serialize(row: Row) {
  return {
    id: row.id,
    type: row.type,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/growth-events", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(behavioralGrowthEventsTable)
    .where(
      and(
        eq(behavioralGrowthEventsTable.userId, req.user.id),
        isNull(behavioralGrowthEventsTable.deletedAt),
      ),
    )
    .orderBy(desc(behavioralGrowthEventsTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/growth-events", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = RecordGrowthEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(behavioralGrowthEventsTable)
    .values({
      userId: req.user.id,
      type: parsed.data.type,
    })
    .returning();
  res.status(201).json(serialize(row));
});

export default router;
