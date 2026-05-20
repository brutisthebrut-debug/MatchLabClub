import { Router, type IRouter } from "express";
import { db, purchaseInterestTable } from "@workspace/db";
import { z } from "zod/v4";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

const PurchaseInterestBody = z.object({
  firstName: z.string().optional().nullable(),
  email: z.string().min(3),
  product: z.enum(["signal-audit", "dating-reset", "wingman"]),
  amountCents: z.number().int().min(0),
  source: z.string().optional().nullable(),
});

router.post("/purchase-interest", async (req, res): Promise<void> => {
  const parsed = PurchaseInterestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [entry] = await db.insert(purchaseInterestTable).values(parsed.data).returning();
  res.status(201).json({
    ...entry,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
  });
});

router.get("/purchase-interest", async (req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(purchaseInterestTable)
    .orderBy(desc(purchaseInterestTable.createdAt));
  res.json(
    entries.map((e) => ({
      ...e,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    }))
  );
});

export default router;
