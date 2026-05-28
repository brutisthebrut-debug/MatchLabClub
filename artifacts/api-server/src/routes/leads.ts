import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { z } from "zod/v4";
import { desc } from "drizzle-orm";
import { requireFounder } from "../middlewares/founderAuth";

const router: IRouter = Router();

const LeadBody = z.object({
  firstName: z.string().optional().nullable(),
  email: z.string().min(3),
  source: z.string().min(1),
  interest: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = LeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  res.status(201).json({
    ...lead,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : String(lead.createdAt),
  });
});

router.get("/leads", requireFounder, async (req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
  res.json(
    leads.map((l) => ({
      ...l,
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
    }))
  );
});

export default router;
