import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, timeCapsulesTable } from "@workspace/db";
import { CreateTimeCapsuleBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof timeCapsulesTable.$inferSelect;

function serialize(row: Row) {
  return {
    id: row.id,
    body: row.body,
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
  // Notes accumulate over time so the user can replay them. We store the body
  // for the user's own replay only; only the derived count feeds readiness, and
  // the body is never sent to any external model.
  const [row] = await db
    .insert(timeCapsulesTable)
    .values({
      userId: req.user.id,
      body: parsed.data.body,
    })
    .returning();
  res.status(201).json(serialize(row));
});

export default router;
