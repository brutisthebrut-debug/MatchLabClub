import { Router, type IRouter } from "express";
import { eq, avg, count } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import {
  CreateAuditBody,
  GetAuditParams,
  GenerateAuditReportParams,
  ListAuditsResponse,
  GetAuditResponse,
  GenerateAuditReportResponse,
  GetAuditSummaryResponse,
} from "@workspace/api-zod";
import { generateAuditReport } from "../lib/aiEngine";

const router: IRouter = Router();

router.get("/audits/summary", async (req, res): Promise<void> => {
  const audits = await db
    .select()
    .from(auditsTable)
    .orderBy(auditsTable.createdAt);

  const completed = audits.filter((a) => a.readinessScore !== null);
  const scores = completed.map((a) => a.readinessScore as number);
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
  const latest = scores.length ? scores[scores.length - 1] : null;

  const scoreHistory = completed.map((a) => ({
    date: a.createdAt instanceof Date ? a.createdAt.toISOString().split("T")[0] : String(a.createdAt).split("T")[0],
    score: a.readinessScore as number,
  }));

  const summary = GetAuditSummaryResponse.parse({
    totalAudits: audits.length,
    averageScore: avg,
    latestScore: latest,
    scoreHistory,
    topStrengths: [
      "Genuine warmth and emotional availability",
      "Clear intention about what you're looking for",
      "Consistency and follow-through in conversations",
    ],
    topRisks: [
      "Generic bio language reduces visibility",
      "Opening messages lack specificity",
      "Photo selection needs strategic curation",
    ],
  });

  res.json(summary);
});

router.get("/audits", async (req, res): Promise<void> => {
  const audits = await db.select().from(auditsTable).orderBy(auditsTable.createdAt);
  res.json(ListAuditsResponse.parse(audits.map((a) => ({
    ...a,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
  }))));
});

router.post("/audits", async (req, res): Promise<void> => {
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [audit] = await db
    .insert(auditsTable)
    .values({ ...parsed.data, status: "pending" })
    .returning();

  res.status(201).json(GetAuditResponse.parse({
    ...audit,
    createdAt: audit.createdAt instanceof Date ? audit.createdAt.toISOString() : String(audit.createdAt),
  }));
});

router.get("/audits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.json(GetAuditResponse.parse({
    ...audit,
    createdAt: audit.createdAt instanceof Date ? audit.createdAt.toISOString() : String(audit.createdAt),
  }));
});

router.post("/audits/:id/generate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  await db.update(auditsTable).set({ status: "generating" }).where(eq(auditsTable.id, id));

  const report = generateAuditReport({
    firstName: audit.firstName,
    bio: audit.bio,
    prompts: audit.prompts,
    datingGoal: audit.datingGoal,
    currentApps: audit.currentApps,
    biggestChallenge: audit.biggestChallenge,
    recentMessageSample: audit.recentMessageSample,
  });

  await db.update(auditsTable)
    .set({ status: "complete", readinessScore: report.readinessScore })
    .where(eq(auditsTable.id, id));

  res.json(GenerateAuditReportResponse.parse({ auditId: id, ...report }));
});

export default router;
