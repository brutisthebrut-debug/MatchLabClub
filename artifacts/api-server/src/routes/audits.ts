import { Router, type IRouter } from "express";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import {
  CreateAuditBody,
  ListAuditsResponse,
  GetAuditResponse,
  GenerateAuditReportResponse,
  GetAuditSummaryResponse,
  AuditFromScreenshotBody,
  AuditFromScreenshotResponse,
} from "@workspace/api-zod";
import { generateAuditReport } from "../lib/aiEngine";
import { getOrCreateAnonClaimToken } from "../lib/anonClaimToken";
import { extractProfileFromScreenshot } from "../lib/ocr";

const router: IRouter = Router();

function userScope(userId: string | undefined): SQL {
  return userId ? eq(auditsTable.userId, userId) : isNull(auditsTable.userId);
}

router.get("/audits/summary", async (req, res): Promise<void> => {
  const audits = await db
    .select()
    .from(auditsTable)
    .where(userScope(req.user?.id))
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
  const sourceParam = typeof req.query.source === "string" ? req.query.source : undefined;
  const sourceFilter =
    sourceParam === "manual" || sourceParam === "screenshot"
      ? eq(auditsTable.source, sourceParam)
      : undefined;
  const where = sourceFilter
    ? and(userScope(req.user?.id), sourceFilter)
    : userScope(req.user?.id);
  const audits = await db
    .select()
    .from(auditsTable)
    .where(where)
    .orderBy(auditsTable.createdAt);
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

  const anonymousClaimToken = req.user?.id
    ? null
    : getOrCreateAnonClaimToken(req, res);

  const [audit] = await db
    .insert(auditsTable)
    .values({
      ...parsed.data,
      status: "pending",
      userId: req.user?.id ?? null,
      anonymousClaimToken,
    })
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

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), userScope(req.user?.id)));
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

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), userScope(req.user?.id)));
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

router.post("/audits/from-screenshot", async (req, res): Promise<void> => {
  const parsed = AuditFromScreenshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let extracted: Awaited<ReturnType<typeof extractProfileFromScreenshot>>;
  try {
    extracted = await extractProfileFromScreenshot(parsed.data.imageBase64);
  } catch (err) {
    req.log.error({ err }, "OCR failed");
    res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
    return;
  }

  if (!extracted.bio && extracted.prompts.length === 0) {
    res.status(400).json({ error: "No readable profile text found in the screenshot." });
    return;
  }

  const firstName =
    parsed.data.firstName?.trim() || extracted.firstName || "Match";
  const age = extracted.age ?? 30;
  const datingGoal = parsed.data.datingGoal?.trim() || "find a relationship";
  const sourceApp =
    parsed.data.sourceApp?.trim() || extracted.sourceApp || "Hinge";

  const promptsText = extracted.prompts.length ? extracted.prompts.join("\n") : null;

  const [audit] = await db
    .insert(auditsTable)
    .values({
      firstName,
      age,
      gender: "unspecified",
      orientation: "unspecified",
      datingGoal,
      currentApps: [sourceApp],
      bio: extracted.bio || extracted.rawText,
      prompts: promptsText,
      sourceApp,
      status: "generating",
      source: "screenshot",
      userId: req.user?.id ?? null,
    })
    .returning();

  const report = generateAuditReport({
    firstName,
    bio: extracted.bio || extracted.rawText,
    prompts: promptsText,
    datingGoal,
    currentApps: [sourceApp],
  });

  await db
    .update(auditsTable)
    .set({ status: "complete", readinessScore: report.readinessScore })
    .where(eq(auditsTable.id, audit.id));

  res.json(
    AuditFromScreenshotResponse.parse({
      auditId: audit.id,
      extractedBio: extracted.bio,
      extractedPrompts: extracted.prompts,
      rawOcrText: extracted.rawText,
      report: { auditId: audit.id, ...report },
    }),
  );
});

export default router;
