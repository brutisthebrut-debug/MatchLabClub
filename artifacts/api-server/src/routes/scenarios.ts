import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, scenarioResponsesTable } from "@workspace/db";
import { CreateScenarioResponseBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const PermissionPatch = z.object({
  echoUse: z.boolean().optional(),
  learningConfirmed: z.boolean().optional(),
  matchingUse: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one permission field is required",
});

type Row = typeof scenarioResponsesTable.$inferSelect;

function serialize(row: Row) {
  return {
    scenarioId: row.scenarioId,
    optionId: row.optionId,
    echoUseAllowed: row.echoUseAllowed,
    learningConfirmed: row.learningConfirmed,
    matchingUseAllowed: row.matchingUseAllowed,
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
  // chosen option in place. Saving stays private and never changes downstream
  // permissions. We store only which option was picked, never any free text.
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

router.patch("/me/scenarios/:scenarioId/permissions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = PermissionPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(scenarioResponsesTable).where(and(
    eq(scenarioResponsesTable.userId, req.user.id),
    eq(scenarioResponsesTable.scenarioId, req.params.scenarioId),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Response not found" });
    return;
  }

  const now = new Date();
  const patch: Partial<typeof scenarioResponsesTable.$inferInsert> = {};
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

  const [updated] = await db.update(scenarioResponsesTable).set(patch).where(and(
    eq(scenarioResponsesTable.userId, req.user.id),
    eq(scenarioResponsesTable.scenarioId, req.params.scenarioId),
  )).returning();
  res.json(serialize(updated));
});

export default router;
