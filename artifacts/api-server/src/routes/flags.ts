import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, flagSelectionsTable } from "@workspace/db";
import { PutFlagSelectionBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof flagSelectionsTable.$inferSelect;

function serialize(row: Row | undefined) {
  if (!row) {
    return { bringFlags: [], seekFlags: [], updatedAt: null };
  }
  return {
    bringFlags: row.bringFlags ?? [],
    seekFlags: row.seekFlags ?? [],
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : row.updatedAt == null
          ? null
          : String(row.updatedAt),
  };
}

router.get("/me/flags", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [row] = await db
    .select()
    .from(flagSelectionsTable)
    .where(eq(flagSelectionsTable.userId, req.user.id))
    .limit(1);
  res.json(serialize(row));
});

router.put("/me/flags", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = PutFlagSelectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One accumulating row per user: the selection is replaced in place so the
  // distinct-flag count that feeds readiness reflects the latest choices. We
  // store only the stable flag ids picked from the catalog, never any free text.
  const [row] = await db
    .insert(flagSelectionsTable)
    .values({
      userId: req.user.id,
      bringFlags: parsed.data.bringFlags,
      seekFlags: parsed.data.seekFlags,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [flagSelectionsTable.userId],
      set: {
        bringFlags: parsed.data.bringFlags,
        seekFlags: parsed.data.seekFlags,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json(serialize(row));
});

export default router;
