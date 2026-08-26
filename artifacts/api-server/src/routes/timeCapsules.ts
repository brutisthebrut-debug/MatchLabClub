import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, timeCapsulesTable } from "@workspace/db";
import { CreateTimeCapsuleBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const PermissionPatch = z.object({
  echoUse: z.boolean().optional(),
  learningConfirmed: z.boolean().optional(),
  matchingUse: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one permission field is required",
});

type Row = typeof timeCapsulesTable.$inferSelect;

function serialize(row: Row) {
  return {
    id: row.id,
    body: row.body,
    echoUseAllowed: row.echoUseAllowed,
    learningConfirmed: row.learningConfirmed,
    matchingUseAllowed: row.matchingUseAllowed,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/time-capsules", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(timeCapsulesTable)
    .where(eq(timeCapsulesTable.userId, req.user.id))
    .orderBy(desc(timeCapsulesTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/time-capsules", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateTimeCapsuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Notes accumulate for private owner replay. Saving never grants downstream
  // use, and the raw body is never sent to an external model.
  const [row] = await db
    .insert(timeCapsulesTable)
    .values({
      userId: req.user.id,
      body: parsed.data.body,
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/me/time-capsules/:id/permissions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid capsule id" });
    return;
  }
  const parsed = PermissionPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(timeCapsulesTable).where(and(
    eq(timeCapsulesTable.userId, req.user.id),
    eq(timeCapsulesTable.id, id),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Capsule not found" });
    return;
  }
  const now = new Date();
  const patch: Partial<typeof timeCapsulesTable.$inferInsert> = {};
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
  const [updated] = await db.update(timeCapsulesTable).set(patch).where(and(
    eq(timeCapsulesTable.userId, req.user.id),
    eq(timeCapsulesTable.id, id),
  )).returning();
  res.json(serialize(updated));
});

export default router;
