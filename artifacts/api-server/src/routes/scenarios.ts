import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, scenarioResponsesTable } from "@workspace/db";
import { CreateScenarioResponseBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof scenarioResponsesTable.$inferSelect;

function serialize(row: Row) {
  return {
    scenarioId: row.scenarioId,
    optionId: row.optionId,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/scenarios", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(scenarioResponsesTable)
    .where(eq(scenarioResponsesTable.userId, req.user.id))
    .orderBy(desc(scenarioResponsesTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/scenarios", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateScenarioResponseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, scenario): answering the same scenario again updates the
  // chosen option in place so the distinct-scenario count that feeds readiness
  // stays honest. We store only which option was picked, never any free text.
  const [row] = await db
    .insert(scenarioResponsesTable)
    .values({
      userId: req.user.id,
      scenarioId: parsed.data.scenarioId,
      optionId: parsed.data.optionId,
    })
    .onConflictDoUpdate({
      target: [scenarioResponsesTable.userId, scenarioResponsesTable.scenarioId],
      set: { optionId: parsed.data.optionId, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(serialize(row));
});

export default router;
