import { Router, type IRouter } from "express";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db, emailInsightsTable } from "@workspace/db";
import {
  CreateInsightBody,
  ListInsightsResponse,
  AnalyzeInsightResponse,
  GetInsightsRollupResponse,
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

type TraitKey = "warmth" | "curiosity" | "verbosity" | "humor";
const TRAIT_KEYS: TraitKey[] = ["warmth", "curiosity", "verbosity", "humor"];
const TRAIT_LABELS: Record<TraitKey, string> = {
  warmth: "warmer",
  curiosity: "more curious",
  verbosity: "more elaborate",
  humor: "more playful",
};

function scoreTraits(content: string): Record<TraitKey, number> {
  const lower = content.toLowerCase();
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const totalChars = lower.length;
  const avgLine = lines.length > 0 ? totalChars / lines.length : totalChars;

  const humorHits = (lower.match(/\b(haha|lol|jk|kidding|lmao)\b/g) || []).length;
  const emotionalHits = (lower.match(/\b(feel|miss|hurt|sorry|love|care|happy|sad|excited)\b/g) || []).length;
  const questionHits = (lower.match(/\?/g) || []).length;

  const lineCount = Math.max(1, lines.length);
  const warmth = Math.min(100, Math.round((emotionalHits / lineCount) * 200));
  const curiosity = Math.min(100, Math.round((questionHits / lineCount) * 150));
  const humor = Math.min(100, Math.round((humorHits / lineCount) * 220));
  const verbosity = Math.min(100, Math.round((avgLine / 120) * 100));
  return { warmth, curiosity, verbosity, humor };
}

router.get("/insights/rollup", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(emailInsightsTable)
    .where(userScope(req.user?.id))
    .orderBy(emailInsightsTable.createdAt);

  const analyzed = rows.filter((r) => r.status === "complete");

  const groups = new Map<
    string,
    {
      count: number;
      traits: Record<TraitKey, number>;
      attachmentStyles: Map<string, number>;
      patterns: Map<string, number>;
      summaries: string[];
    }
  >();

  for (const row of analyzed) {
    const result = generateEmailInsightAnalysis({
      pastedContent: row.pastedContent,
      sourceLabel: row.sourceLabel,
      sourceApp: row.sourceApp,
    });
    const key = (result.sourceApp || row.sourceApp || "Other").toString();
    const traits = scoreTraits(row.pastedContent);

    const existing = groups.get(key) ?? {
      count: 0,
      traits: { warmth: 0, curiosity: 0, verbosity: 0, humor: 0 },
      attachmentStyles: new Map<string, number>(),
      patterns: new Map<string, number>(),
      summaries: [] as string[],
    };
    existing.count += 1;
    for (const t of TRAIT_KEYS) existing.traits[t] += traits[t];
    existing.attachmentStyles.set(
      result.attachmentStyle,
      (existing.attachmentStyles.get(result.attachmentStyle) ?? 0) + 1,
    );
    for (const p of result.communicationPatterns) {
      existing.patterns.set(p.pattern, (existing.patterns.get(p.pattern) ?? 0) + 1);
    }
    existing.summaries.push(result.summary);
    groups.set(key, existing);
  }

  const sources = Array.from(groups.entries())
    .map(([sourceApp, g]) => {
      const traits: Record<TraitKey, number> = {
        warmth: Math.round(g.traits.warmth / g.count),
        curiosity: Math.round(g.traits.curiosity / g.count),
        verbosity: Math.round(g.traits.verbosity / g.count),
        humor: Math.round(g.traits.humor / g.count),
      };
      const topStyle = Array.from(g.attachmentStyles.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const topPattern = Array.from(g.patterns.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const summary =
        g.count === 1
          ? `One import from ${sourceApp}. ${g.summaries[0]?.split(".")[0] ?? ""}.`
          : `${g.count} imports from ${sourceApp}. ${topPattern} shows up most, and your attachment read here trends ${topStyle.split("—")[0]?.trim().toLowerCase() ?? "secure"}.`;
      return {
        sourceApp,
        count: g.count,
        attachmentStyle: topStyle,
        traits,
        signaturePattern: topPattern,
        summary,
      };
    })
    .sort((a, b) => b.count - a.count);

  const comparisons: {
    trait: TraitKey;
    leader: string;
    laggard: string;
    delta: number;
    sentence: string;
  }[] = [];

  if (sources.length >= 2) {
    for (const trait of TRAIT_KEYS) {
      const sorted = [...sources].sort((a, b) => b.traits[trait] - a.traits[trait]);
      const leader = sorted[0]!;
      const laggard = sorted[sorted.length - 1]!;
      const delta = leader.traits[trait] - laggard.traits[trait];
      if (delta >= 15) {
        comparisons.push({
          trait,
          leader: leader.sourceApp,
          laggard: laggard.sourceApp,
          delta,
          sentence: `You're ${TRAIT_LABELS[trait]} on ${leader.sourceApp} than on ${laggard.sourceApp} (+${delta} pts).`,
        });
      }
    }
    comparisons.sort((a, b) => b.delta - a.delta);
  }

  res.json(
    GetInsightsRollupResponse.parse({
      totalAnalyzed: analyzed.length,
      sources,
      comparisons: comparisons.slice(0, 4),
    }),
  );
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

router.delete("/insights/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(emailInsightsTable)
    .where(and(eq(emailInsightsTable.id, id), userScope(req.user?.id)));
  if (!existing) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  await db.delete(emailInsightsTable).where(eq(emailInsightsTable.id, id));

  res.json({ success: true, deletedId: id });
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
    sourceApp: insight.sourceApp,
  });

  if (analysis.sourceApp && !insight.sourceApp) {
    await db
      .update(emailInsightsTable)
      .set({ sourceApp: analysis.sourceApp })
      .where(eq(emailInsightsTable.id, id));
  }

  await db.update(emailInsightsTable).set({ status: "complete" }).where(eq(emailInsightsTable.id, id));

  res.json(AnalyzeInsightResponse.parse({ insightId: id, ...analysis }));
});

export default router;
