import { Router, type IRouter } from "express";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db, emailInsightsTable } from "@workspace/db";
import {
  CreateInsightBody,
  ListInsightsResponse,
  AnalyzeInsightResponse,
} from "@workspace/api-zod";
import { generateEmailInsightAnalysis } from "../lib/aiEngine";
import { getOrCreateAnonClaimToken } from "../lib/anonClaimToken";

const router: IRouter = Router();

function userScope(userId: string | undefined): SQL {
  return userId ? eq(emailInsightsTable.userId, userId) : isNull(emailInsightsTable.userId);
}

router.get("/insights", async (req, res): Promise<void> => {
  const insights = await db
    .select()
    .from(emailInsightsTable)
    .where(userScope(req.user?.id))
    .orderBy(emailInsightsTable.createdAt);
  res.json(ListInsightsResponse.parse(insights.map((i) => ({
    ...i,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
  }))));
});

router.post("/insights", async (req, res): Promise<void> => {
  const parsed = CreateInsightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const anonymousClaimToken = req.user?.id
    ? null
    : getOrCreateAnonClaimToken(req, res);

  const [insight] = await db
    .insert(emailInsightsTable)
    .values({
      ...parsed.data,
      status: "pending",
      userId: req.user?.id ?? null,
      anonymousClaimToken,
    })
    .returning();

  res.status(201).json({
    ...insight,
    createdAt: insight.createdAt instanceof Date ? insight.createdAt.toISOString() : String(insight.createdAt),
  });
});

router.post("/insights/:id/analyze", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [insight] = await db
    .select()
    .from(emailInsightsTable)
    .where(and(eq(emailInsightsTable.id, id), userScope(req.user?.id)));
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  await db.update(emailInsightsTable).set({ status: "analyzing" }).where(eq(emailInsightsTable.id, id));

  const analysis = generateEmailInsightAnalysis({
    pastedContent: insight.pastedContent,
    sourceLabel: insight.sourceLabel,
  });

  await db.update(emailInsightsTable).set({ status: "complete" }).where(eq(emailInsightsTable.id, id));

  res.json(AnalyzeInsightResponse.parse({ insightId: id, ...analysis }));
});

export default router;
