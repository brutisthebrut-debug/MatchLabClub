import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { z } from "zod/v4";
import { desc, eq } from "drizzle-orm";
import { requireFounder } from "../middlewares/founderAuth";

const router: IRouter = Router();

// Canonical founder triage states. Kept in lockstep with LEAD_STATUS_OPTIONS in
// the founder UI; the server is the source of truth and rejects anything else.
const LEAD_STATUS_VALUES = [
  "New",
  "Needs Review",
  "Reviewed",
  "Follow-Up Sent",
  "Converted",
  "Testimonial Requested",
  "Archived",
] as const;

const LeadBody = z.object({
  firstName: z.string().optional().nullable(),
  email: z.string().min(3),
  source: z.string().min(1),
  interest: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const LeadStatusBody = z.object({
  status: z.enum(LEAD_STATUS_VALUES),
});

function serializeLead(l: typeof leadsTable.$inferSelect) {
  return {
    ...l,
    statusUpdatedAt:
      l.statusUpdatedAt instanceof Date
        ? l.statusUpdatedAt.toISOString()
        : l.statusUpdatedAt,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
  };
}

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = LeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  res.status(201).json(serializeLead(lead));
});

router.get("/leads", requireFounder, async (_req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
  res.json(leads.map(serializeLead));
});

// Persist founder triage state per lead. Replaces the old browser-local store so
// the pipeline survives refreshes and is consistent across devices/teammates.
router.patch("/founder/leads/:id/status", requireFounder, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const parsed = LeadStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(leadsTable)
    .set({ status: parsed.data.status, statusUpdatedAt: new Date() })
    .where(eq(leadsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(serializeLead(updated));
});

export default router;
