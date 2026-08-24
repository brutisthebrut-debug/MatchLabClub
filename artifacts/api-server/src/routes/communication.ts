import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { communicationRecordsTable, db, matchPoolMembershipTable, mirrorLearningsTable } from "@workspace/db";

const router: IRouter = Router();
const Lens = z.enum(["connection_style", "personal_blueprint"]);
const GeneratedBy = z.enum(["ai", "deterministic", "legacy_local"]);

const ConnectionStyleInput = z.object({
  answers: z.array(z.number().int().min(0).max(3)).length(6),
});
const ConnectionStyleResult = z.object({
  styleKey: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().min(10).max(1200),
  strengths: z.array(z.string().trim().min(3).max(400)).min(1).max(6),
  activationPattern: z.string().trim().min(10).max(1800),
  whatHelps: z.string().trim().min(10).max(1800),
  nextExperiment: z.string().trim().min(10).max(1800),
});
const BlueprintInput = z.object({
  selfDescription: z.string().max(8000).default(""),
  pattern: z.string().max(500).default(""),
  misread: z.string().max(2000).default(""),
  want: z.string().max(500).default(""),
  legacy: z.boolean().optional(),
});
const BlueprintResult = z.object({
  firstImpression: z.string().trim().min(10).max(2400),
  repeatingPattern: z.string().trim().min(10).max(2400),
  communicationStyle: z.string().trim().min(10).max(2400),
  attractionPattern: z.string().trim().min(10).max(2400),
  comfortNeeds: z.string().trim().min(10).max(2400),
  riskLoop: z.string().trim().min(10).max(2400),
  growthEdge: z.string().trim().min(10).max(2400),
});
const SaveBody = z.object({
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
  generatedBy: GeneratedBy,
  confidence: z.number().int().min(0).max(100),
});

function serialize(row: typeof communicationRecordsTable.$inferSelect) {
  return {
    lens: row.lens,
    input: row.input,
    result: row.result,
    generatedBy: row.generatedBy,
    confidence: row.confidence,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

router.get("/me/communication", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db.select().from(communicationRecordsTable)
    .where(eq(communicationRecordsTable.userId, req.user.id))
    .orderBy(desc(communicationRecordsTable.updatedAt));
  res.json({ records: rows.map(serialize) });
});

router.put("/me/communication/:lens", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const lens = Lens.safeParse(req.params.lens);
  const body = SaveBody.safeParse(req.body);
  if (!lens.success || !body.success) {
    res.status(400).json({ error: "Invalid Communication record" });
    return;
  }
  const detail = lens.data === "connection_style"
    ? z.object({ input: ConnectionStyleInput, result: ConnectionStyleResult }).safeParse(body.data)
    : z.object({ input: BlueprintInput, result: BlueprintResult }).safeParse(body.data);
  if (!detail.success) {
    res.status(400).json({ error: "Invalid Communication lens result" });
    return;
  }
  const now = new Date();
  const [saved] = await db.insert(communicationRecordsTable).values({
    userId: req.user.id,
    lens: lens.data,
    input: detail.data.input,
    result: detail.data.result,
    generatedBy: body.data.generatedBy,
    confidence: body.data.confidence,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [communicationRecordsTable.userId, communicationRecordsTable.lens],
    set: {
      input: detail.data.input,
      result: detail.data.result,
      generatedBy: body.data.generatedBy,
      confidence: body.data.confidence,
      updatedAt: now,
    },
  }).returning();
  res.json(serialize(saved!));
});

router.delete("/me/communication/:lens", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const lens = Lens.safeParse(req.params.lens);
  if (!lens.success) {
    res.status(400).json({ error: "Invalid Communication lens" });
    return;
  }
  const sourceRef = lens.data === "connection_style" ? "connection-style" : "personal-blueprint";
  const [learning] = await db.select().from(mirrorLearningsTable).where(and(
    eq(mirrorLearningsTable.userId, req.user.id),
    eq(mirrorLearningsTable.sourceType, "relationship_language"),
    eq(mirrorLearningsTable.sourceRef, sourceRef),
  )).limit(1);
  if (learning?.matchingUseApproved) {
    const [membership] = await db.select().from(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, req.user.id)).limit(1);
    if (membership && ["building", "ready", "concierge_only"].includes(membership.status)) {
      await db.update(matchPoolMembershipTable).set({
        status: "paused",
        pausedReason: "A matching-approved Communication source was removed.",
        updatedAt: new Date(),
      }).where(eq(matchPoolMembershipTable.userId, req.user.id));
    }
  }
  await db.delete(mirrorLearningsTable).where(and(
    eq(mirrorLearningsTable.userId, req.user.id),
    eq(mirrorLearningsTable.sourceType, "relationship_language"),
    eq(mirrorLearningsTable.sourceRef, sourceRef),
  ));
  const removed = await db.delete(communicationRecordsTable).where(and(
    eq(communicationRecordsTable.userId, req.user.id),
    eq(communicationRecordsTable.lens, lens.data),
  )).returning({ id: communicationRecordsTable.id });
  res.json({ deleted: removed.length > 0 });
});

export default router;
