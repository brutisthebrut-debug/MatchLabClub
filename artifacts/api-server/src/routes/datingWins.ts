import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, datingWinsTable } from "@workspace/db";
import { CreateDatingWinBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof datingWinsTable.$inferSelect;

function serialize(row: Row) {
  return {
    id: row.id,
    category: row.category,
    body: row.body,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/dating-wins", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(datingWinsTable)
    .where(
      and(
        eq(datingWinsTable.userId, req.user.id),
        isNull(datingWinsTable.deletedAt),
      ),
    )
    .orderBy(desc(datingWinsTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/dating-wins", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateDatingWinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(datingWinsTable)
    .values({
      userId: req.user.id,
      category: parsed.data.category,
      body: parsed.data.body,
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.delete("/me/dating-wins/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .update(datingWinsTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(datingWinsTable.id, id),
        eq(datingWinsTable.userId, req.user.id),
        isNull(datingWinsTable.deletedAt),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
