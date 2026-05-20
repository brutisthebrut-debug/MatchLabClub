import { Router, type IRouter } from "express";
import {
  db,
  leadsTable,
  purchaseInterestTable,
  auditsTable,
  waitlistTable,
  messageCoachingSessionsTable,
  aiRequestMetricsTable,
  aiRequestMetricsDailyTable,
  aiAlertThresholdsTable,
  aiAlertThresholdChangesTable,
  AI_ALERT_GLOBAL_KEY,
  coachFollowUpsTable,
} from "@workspace/db";
import { count, sql, desc, gte, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod/v4";
import { requireFounder } from "../middlewares/founderAuth";
import type { OcrCorrectionsRecord, OcrCorrectionField } from "@workspace/db";
import {
  learnFromCorrections,
  listLearnedRules,
  clearLearnedRules,
} from "../lib/ocrLearning";

const router: IRouter = Router();

router.get("/founder/stats", async (req, res): Promise<void> => {
  const [leadsCount] = await db.select({ c: count() }).from(leadsTable);
  const [purchaseCount] = await db.select({ c: count() }).from(purchaseInterestTable);
  const [auditsCount] = await db.select({ c: count() }).from(auditsTable);
  const [waitlistCount] = await db.select({ c: count() }).from(waitlistTable);
  const [messagesCount] = await db.select({ c: count() }).from(messageCoachingSessionsTable);
  const [followUpAgg] = await db
    .select({
      snoozed: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'snoozed')::int`,
      dismissed: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'dismissed')::int`,
    })
    .from(coachFollowUpsTable);

  res.json({
    leads: Number(leadsCount?.c ?? 0),
    purchaseInterest: Number(purchaseCount?.c ?? 0),
    audits: Number(auditsCount?.c ?? 0),
    waitlist: Number(waitlistCount?.c ?? 0),
    messages: Number(messagesCount?.c ?? 0),
    followUpSnoozeCount: Number(followUpAgg?.snoozed ?? 0),
    followUpDismissCount: Number(followUpAgg?.dismissed ?? 0),
  });
});

const DEFAULT_ALERT_WINDOW = 50;
const DEFAULT_ALERT_MIN_SAMPLE = 10;
const DEFAULT_ALERT_THRESHOLD = 0.7;

interface ThresholdConfig {
  windowSize: number;
  minSample: number;
  threshold: number;
}

function buildAlertReason(args: {
  recentTotal: number;
  recentFallbacks: number;
  recentValidationFailures: number;
  recentRetried: number;
  recentFirstTrySuccessRate: number;
}): string {
  const { recentTotal, recentFallbacks, recentValidationFailures, recentRetried, recentFirstTrySuccessRate } = args;
  const fallbackPct = recentTotal > 0 ? Math.round((recentFallbacks / recentTotal) * 100) : 0;
  const successPct = Math.round(recentFirstTrySuccessRate * 100);

  // Pick the dominant failure mode in the recent window.
  if (
    recentFallbacks > 0 &&
    recentFallbacks >= recentValidationFailures &&
    recentFallbacks >= recentRetried
  ) {
    return `${fallbackPct}% of recent runs used the fallback (${recentFallbacks}/${recentTotal})`;
  }
  if (recentValidationFailures > 0 && recentValidationFailures >= recentRetried) {
    return `${recentValidationFailures} validation failure${recentValidationFailures === 1 ? "" : "s"} in last ${recentTotal}`;
  }
  if (recentRetried > 0) {
    return `${recentRetried} of last ${recentTotal} needed a retry`;
  }
  return `First-try success ${successPct}% over last ${recentTotal}`;
}

async function loadThresholds(): Promise<{
  global: ThresholdConfig;
  perTool: Map<string, ThresholdConfig>;
}> {
  const rows = await db.select().from(aiAlertThresholdsTable);
  let global: ThresholdConfig = {
    windowSize: DEFAULT_ALERT_WINDOW,
    minSample: DEFAULT_ALERT_MIN_SAMPLE,
    threshold: DEFAULT_ALERT_THRESHOLD,
  };
  const perTool = new Map<string, ThresholdConfig>();
  for (const r of rows) {
    const cfg: ThresholdConfig = {
      windowSize: r.windowSize,
      minSample: r.minSample,
      threshold: r.threshold,
    };
    if (r.toolName === AI_ALERT_GLOBAL_KEY) {
      global = cfg;
    } else {
      perTool.set(r.toolName, cfg);
    }
  }
  return { global, perTool };
}

router.get("/founder/ai-metrics", async (_req, res): Promise<void> => {
  const { global: globalCfg, perTool: perToolCfg } = await loadThresholds();

  const perTool = await db
    .select({
      toolName: aiRequestMetricsTable.toolName,
      total: count(),
      firstTryOk: sql<number>`sum(case when ${aiRequestMetricsTable.attempts} = 1 and ${aiRequestMetricsTable.isFallback} = false then 1 else 0 end)`,
      retriedOk: sql<number>`sum(case when ${aiRequestMetricsTable.attempts} = 2 and ${aiRequestMetricsTable.isFallback} = false then 1 else 0 end)`,
      fallbacks: sql<number>`sum(case when ${aiRequestMetricsTable.isFallback} = true then 1 else 0 end)`,
      validationFailures: sql<number>`sum(case when ${aiRequestMetricsTable.validated} = false then 1 else 0 end)`,
      avgAttempts: sql<number>`avg(${aiRequestMetricsTable.attempts})`,
      avgDurationMs: sql<number>`avg(${aiRequestMetricsTable.durationMs})`,
      total24h: sql<number>`sum(case when ${aiRequestMetricsTable.createdAt} >= now() - interval '24 hours' then 1 else 0 end)`,
      fallbacks24h: sql<number>`sum(case when ${aiRequestMetricsTable.createdAt} >= now() - interval '24 hours' and ${aiRequestMetricsTable.isFallback} = true then 1 else 0 end)`,
      total7d: sql<number>`sum(case when ${aiRequestMetricsTable.createdAt} >= now() - interval '7 days' then 1 else 0 end)`,
      fallbacks7d: sql<number>`sum(case when ${aiRequestMetricsTable.createdAt} >= now() - interval '7 days' and ${aiRequestMetricsTable.isFallback} = true then 1 else 0 end)`,
    })
    .from(aiRequestMetricsTable)
    .groupBy(aiRequestMetricsTable.toolName)
    .orderBy(desc(count()));

  // Recent-window stats are computed per-tool because the window size can
  // differ across tools. We compute a max window across all tools once,
  // then filter per-tool downstream.
  const maxWindow = Math.max(
    globalCfg.windowSize,
    ...Array.from(perToolCfg.values()).map((c) => c.windowSize),
    1,
  );

  const recentRows = await db.execute<{
    tool_name: string;
    rn: string | number;
    attempts: number;
    is_fallback: boolean;
    validated: boolean;
  }>(sql`
    select tool_name, attempts, is_fallback, validated, rn
    from (
      select
        tool_name,
        attempts,
        is_fallback,
        validated,
        row_number() over (partition by tool_name order by created_at desc) as rn
      from ai_request_metrics
    ) t
    where rn <= ${maxWindow}
    order by tool_name, rn
  `);

  const recentByTool = new Map<
    string,
    Array<{ rn: number; attempts: number; isFallback: boolean; validated: boolean }>
  >();
  for (const r of recentRows.rows ?? []) {
    const arr = recentByTool.get(r.tool_name) ?? [];
    arr.push({
      rn: Number(r.rn),
      attempts: Number(r.attempts),
      isFallback: Boolean(r.is_fallback),
      validated: Boolean(r.validated),
    });
    recentByTool.set(r.tool_name, arr);
  }
  // Defensive: ensure ordered by rn ascending (most-recent first) regardless of driver behavior.
  for (const arr of recentByTool.values()) {
    arr.sort((a, b) => a.rn - b.rn);
  }

  const [totals] = await db
    .select({
      total: count(),
      firstTryOk: sql<number>`sum(case when ${aiRequestMetricsTable.attempts} = 1 and ${aiRequestMetricsTable.isFallback} = false then 1 else 0 end)`,
      retriedOk: sql<number>`sum(case when ${aiRequestMetricsTable.attempts} = 2 and ${aiRequestMetricsTable.isFallback} = false then 1 else 0 end)`,
      fallbacks: sql<number>`sum(case when ${aiRequestMetricsTable.isFallback} = true then 1 else 0 end)`,
      avgAttempts: sql<number>`avg(${aiRequestMetricsTable.attempts})`,
      avgDurationMs: sql<number>`avg(${aiRequestMetricsTable.durationMs})`,
    })
    .from(aiRequestMetricsTable);

  const norm = (row: typeof perTool[number]) => {
    const total = Number(row.total ?? 0);
    const firstTryOk = Number(row.firstTryOk ?? 0);
    const retriedOk = Number(row.retriedOk ?? 0);
    const fallbacks = Number(row.fallbacks ?? 0);
    const validationFailures = Number(row.validationFailures ?? 0);
    const total24h = Number(row.total24h ?? 0);
    const fallbacks24h = Number(row.fallbacks24h ?? 0);
    const total7d = Number(row.total7d ?? 0);
    const fallbacks7d = Number(row.fallbacks7d ?? 0);
    const cfg = perToolCfg.get(row.toolName) ?? globalCfg;
    const all = recentByTool.get(row.toolName) ?? [];
    const sliced = all.slice(0, cfg.windowSize);
    const recentTotal = sliced.length;
    const recentFirstTryOk = sliced.filter((r) => r.attempts === 1 && !r.isFallback).length;
    const recentFallbacks = sliced.filter((r) => r.isFallback).length;
    const recentValidationFailures = sliced.filter((r) => !r.validated).length;
    const recentRetried = sliced.filter((r) => !r.isFallback && r.attempts > 1).length;
    const recentRate = recentTotal > 0 ? recentFirstTryOk / recentTotal : 0;
    const alert = recentTotal >= cfg.minSample && recentRate < cfg.threshold;
    return {
      toolName: row.toolName,
      total,
      firstTryOk,
      retriedOk,
      fallbacks,
      validationFailures,
      firstTrySuccessRate: total > 0 ? firstTryOk / total : 0,
      overallSuccessRate: total > 0 ? (firstTryOk + retriedOk) / total : 0,
      avgAttempts: Number(row.avgAttempts ?? 0),
      avgDurationMs: Number(row.avgDurationMs ?? 0),
      recent: {
        windowSize: cfg.windowSize,
        total: recentTotal,
        firstTryOk: recentFirstTryOk,
        fallbacks: recentFallbacks,
        validationFailures: recentValidationFailures,
        retried: recentRetried,
        firstTrySuccessRate: recentRate,
      },
      last24h: {
        total: total24h,
        fallbacks: fallbacks24h,
        fallbackRate: total24h > 0 ? fallbacks24h / total24h : 0,
      },
      last7d: {
        total: total7d,
        fallbacks: fallbacks7d,
        fallbackRate: total7d > 0 ? fallbacks7d / total7d : 0,
      },
      effectiveThreshold: {
        windowSize: cfg.windowSize,
        minSample: cfg.minSample,
        firstTrySuccessRate: cfg.threshold,
        isOverride: perToolCfg.has(row.toolName),
      },
      alert,
    };
  };

  const totalRows = Number(totals?.total ?? 0);
  const totalFirstTry = Number(totals?.firstTryOk ?? 0);
  const totalRetried = Number(totals?.retriedOk ?? 0);
  const totalFallbacks = Number(totals?.fallbacks ?? 0);

  const perToolNorm = perTool.map(norm);
  const alerts = perToolNorm.filter((t) => t.alert);

  res.json({
    overall: {
      total: totalRows,
      firstTryOk: totalFirstTry,
      retriedOk: totalRetried,
      fallbacks: totalFallbacks,
      firstTrySuccessRate: totalRows > 0 ? totalFirstTry / totalRows : 0,
      overallSuccessRate: totalRows > 0 ? (totalFirstTry + totalRetried) / totalRows : 0,
      avgAttempts: Number(totals?.avgAttempts ?? 0),
      avgDurationMs: Number(totals?.avgDurationMs ?? 0),
    },
    perTool: perToolNorm,
    alertThreshold: {
      windowSize: globalCfg.windowSize,
      minSample: globalCfg.minSample,
      firstTrySuccessRate: globalCfg.threshold,
    },
    perToolOverrides: Array.from(perToolCfg.entries()).map(([toolName, c]) => ({
      toolName,
      windowSize: c.windowSize,
      minSample: c.minSample,
      firstTrySuccessRate: c.threshold,
    })),
    alerts: alerts.map((t) => ({
      toolName: t.toolName,
      recentTotal: t.recent.total,
      recentFirstTrySuccessRate: t.recent.firstTrySuccessRate,
      reason: buildAlertReason({
        recentTotal: t.recent.total,
        recentFallbacks: t.recent.fallbacks,
        recentValidationFailures: t.recent.validationFailures,
        recentRetried: t.recent.retried,
        recentFirstTrySuccessRate: t.recent.firstTrySuccessRate,
      }),
    })),
  });
});

router.get("/founder/ai-metrics/trends", async (req, res): Promise<void> => {
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), 365) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceDay = since.toISOString().slice(0, 10);

  const rows = await db
    .select({
      day: aiRequestMetricsDailyTable.day,
      toolName: aiRequestMetricsDailyTable.toolName,
      total: aiRequestMetricsDailyTable.total,
      firstTryOk: aiRequestMetricsDailyTable.firstTryOk,
      retriedOk: aiRequestMetricsDailyTable.retriedOk,
      fallbacks: aiRequestMetricsDailyTable.fallbacks,
      validationFailures: aiRequestMetricsDailyTable.validationFailures,
      avgAttempts: aiRequestMetricsDailyTable.avgAttempts,
      avgDurationMs: aiRequestMetricsDailyTable.avgDurationMs,
    })
    .from(aiRequestMetricsDailyTable)
    .where(gte(aiRequestMetricsDailyTable.day, sinceDay))
    .orderBy(asc(aiRequestMetricsDailyTable.day), asc(aiRequestMetricsDailyTable.toolName));

  const series = rows.map((r) => {
    const total = Number(r.total);
    const firstTryOk = Number(r.firstTryOk);
    const retriedOk = Number(r.retriedOk);
    const fallbacks = Number(r.fallbacks);
    return {
      day: typeof r.day === "string" ? r.day : new Date(r.day as unknown as string).toISOString().slice(0, 10),
      toolName: r.toolName,
      total,
      firstTryOk,
      retriedOk,
      fallbacks,
      validationFailures: Number(r.validationFailures),
      firstTrySuccessRate: total > 0 ? firstTryOk / total : 0,
      overallSuccessRate: total > 0 ? (firstTryOk + retriedOk) / total : 0,
      fallbackRate: total > 0 ? fallbacks / total : 0,
      avgAttempts: Number(r.avgAttempts),
      avgDurationMs: Number(r.avgDurationMs),
    };
  });

  res.json({ days, since: sinceDay, series });
});

const OCR_FIELDS: OcrCorrectionField[] = ["firstName", "age", "sourceApp", "bio", "prompts"];

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((s) => String(s)).join(" | ");
  return String(v);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

router.get("/founder/ocr-mismatches", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalScreenshotAudits: sql<number>`sum(case when ${auditsTable.source} = 'screenshot' then 1 else 0 end)`,
      auditsWithRawOcr: sql<number>`sum(case when ${auditsTable.rawOcrText} is not null then 1 else 0 end)`,
      auditsWithCorrections: sql<number>`sum(case when ${auditsTable.ocrCorrections} is not null then 1 else 0 end)`,
    })
    .from(auditsTable);

  const rows = await db
    .select({
      id: auditsTable.id,
      ocrCorrections: auditsTable.ocrCorrections,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(isNotNull(auditsTable.ocrCorrections))
    .orderBy(desc(auditsTable.createdAt))
    .limit(500);

  const fieldCounts: Record<OcrCorrectionField, number> = {
    firstName: 0,
    age: 0,
    sourceApp: 0,
    bio: 0,
    prompts: 0,
  };
  const topDiffs: Record<OcrCorrectionField, Map<string, number>> = {
    firstName: new Map(),
    age: new Map(),
    sourceApp: new Map(),
    bio: new Map(),
    prompts: new Map(),
  };
  const recent: Array<{
    auditId: number;
    field: OcrCorrectionField;
    raw: string;
    corrected: string;
    createdAt: string;
  }> = [];

  for (const row of rows) {
    const corr = row.ocrCorrections as OcrCorrectionsRecord | null;
    if (!corr) continue;
    for (const field of OCR_FIELDS) {
      const entry = corr[field];
      if (!entry) continue;
      fieldCounts[field] += 1;
      const rawStr = truncate(asString(entry.raw), 80);
      const correctedStr = truncate(asString(entry.corrected), 80);
      const key = `${rawStr} \u2192 ${correctedStr}`;
      topDiffs[field].set(key, (topDiffs[field].get(key) ?? 0) + 1);
      if (recent.length < 50) {
        recent.push({
          auditId: row.id,
          field,
          raw: rawStr,
          corrected: correctedStr,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : String(row.createdAt),
        });
      }
    }
  }

  const perField = OCR_FIELDS.map((field) => {
    const diffs = Array.from(topDiffs[field].entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([example, n]) => ({ example, count: n }));
    return { field, correctionsCount: fieldCounts[field], topDiffs: diffs };
  }).sort((a, b) => b.correctionsCount - a.correctionsCount);

  res.json({
    summary: {
      totalScreenshotAudits: Number(totals?.totalScreenshotAudits ?? 0),
      auditsWithRawOcr: Number(totals?.auditsWithRawOcr ?? 0),
      auditsWithCorrections: Number(totals?.auditsWithCorrections ?? 0),
      sampleSize: rows.length,
    },
    perField,
    recent,
  });
});

router.get("/founder/ocr-rules", requireFounder, async (_req, res): Promise<void> => {
  const rules = await listLearnedRules();
  res.json({
    rules: rules.map((r) => ({
      id: r.id,
      kind: r.kind,
      pattern: r.pattern,
      replacement: r.replacement,
      scope: r.scope,
      occurrences: r.occurrences,
      learnedAt: r.learnedAt instanceof Date ? r.learnedAt.toISOString() : String(r.learnedAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    })),
  });
});

router.post("/founder/ocr-learn", requireFounder, async (_req, res): Promise<void> => {
  const result = await learnFromCorrections();
  res.json({
    scannedAudits: result.scannedAudits,
    candidates: result.candidates,
    persisted: result.persisted,
  });
});

router.delete("/founder/ocr-rules", requireFounder, async (_req, res): Promise<void> => {
  await clearLearnedRules();
  res.json({ ok: true });
});

router.get("/founder/ai-thresholds", requireFounder, async (_req, res): Promise<void> => {
  const { global, perTool } = await loadThresholds();
  res.json({
    global: {
      windowSize: global.windowSize,
      minSample: global.minSample,
      firstTrySuccessRate: global.threshold,
    },
    perTool: Array.from(perTool.entries()).map(([toolName, c]) => ({
      toolName,
      windowSize: c.windowSize,
      minSample: c.minSample,
      firstTrySuccessRate: c.threshold,
    })),
    defaults: {
      windowSize: DEFAULT_ALERT_WINDOW,
      minSample: DEFAULT_ALERT_MIN_SAMPLE,
      firstTrySuccessRate: DEFAULT_ALERT_THRESHOLD,
    },
  });
});

const thresholdShape = z.object({
  windowSize: z.number().int().min(1).max(10000),
  minSample: z.number().int().min(1).max(10000),
  firstTrySuccessRate: z.number().min(0).max(1),
});

const putThresholdsSchema = z.object({
  global: thresholdShape.optional(),
  perTool: z
    .array(
      thresholdShape.extend({
        toolName: z.string().min(1).max(200),
      }),
    )
    .optional(),
  resetGlobal: z.boolean().optional(),
  removeToolNames: z.array(z.string().min(1).max(200)).optional(),
});

router.get("/founder/ai-threshold-changes", requireFounder, async (req, res): Promise<void> => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 10;
  const rows = await db
    .select()
    .from(aiAlertThresholdChangesTable)
    .orderBy(desc(aiAlertThresholdChangesTable.createdAt))
    .limit(limit);
  res.json({
    changes: rows.map((r) => ({
      id: r.id,
      toolName: r.toolName,
      action: r.action,
      oldWindowSize: r.oldWindowSize,
      oldMinSample: r.oldMinSample,
      oldFirstTrySuccessRate: r.oldThreshold,
      newWindowSize: r.newWindowSize,
      newMinSample: r.newMinSample,
      newFirstTrySuccessRate: r.newThreshold,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  });
});

router.put("/founder/ai-thresholds", requireFounder, async (req, res): Promise<void> => {
  const parsed = putThresholdsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid threshold payload.", details: parsed.error.format() });
    return;
  }
  const { global, perTool, resetGlobal, removeToolNames } = parsed.data;

  const before = await loadThresholds();
  const beforeFor = (name: string): ThresholdConfig | undefined => {
    if (name === AI_ALERT_GLOBAL_KEY) return before.global;
    return before.perTool.get(name);
  };
  const changeRows: Array<typeof aiAlertThresholdChangesTable.$inferInsert> = [];
  const sameCfg = (a: ThresholdConfig, b: ThresholdConfig) =>
    a.windowSize === b.windowSize && a.minSample === b.minSample && a.threshold === b.threshold;

  if (resetGlobal) {
    const prev = beforeFor(AI_ALERT_GLOBAL_KEY);
    await db.delete(aiAlertThresholdsTable).where(eq(aiAlertThresholdsTable.toolName, AI_ALERT_GLOBAL_KEY));
    if (prev) {
      changeRows.push({
        toolName: AI_ALERT_GLOBAL_KEY,
        action: "reset",
        oldWindowSize: prev.windowSize,
        oldMinSample: prev.minSample,
        oldThreshold: prev.threshold,
        newWindowSize: null,
        newMinSample: null,
        newThreshold: null,
      });
    }
  } else if (global) {
    const prev = beforeFor(AI_ALERT_GLOBAL_KEY);
    const next: ThresholdConfig = {
      windowSize: global.windowSize,
      minSample: global.minSample,
      threshold: global.firstTrySuccessRate,
    };
    await db
      .insert(aiAlertThresholdsTable)
      .values({
        toolName: AI_ALERT_GLOBAL_KEY,
        windowSize: next.windowSize,
        minSample: next.minSample,
        threshold: next.threshold,
      })
      .onConflictDoUpdate({
        target: aiAlertThresholdsTable.toolName,
        set: {
          windowSize: next.windowSize,
          minSample: next.minSample,
          threshold: next.threshold,
          updatedAt: new Date(),
        },
      });
    if (!prev || !sameCfg(prev, next)) {
      changeRows.push({
        toolName: AI_ALERT_GLOBAL_KEY,
        action: prev ? "update" : "create",
        oldWindowSize: prev?.windowSize ?? null,
        oldMinSample: prev?.minSample ?? null,
        oldThreshold: prev?.threshold ?? null,
        newWindowSize: next.windowSize,
        newMinSample: next.minSample,
        newThreshold: next.threshold,
      });
    }
  }

  if (removeToolNames && removeToolNames.length > 0) {
    for (const name of removeToolNames) {
      if (name === AI_ALERT_GLOBAL_KEY) continue;
      const prev = beforeFor(name);
      await db.delete(aiAlertThresholdsTable).where(eq(aiAlertThresholdsTable.toolName, name));
      if (prev) {
        changeRows.push({
          toolName: name,
          action: "remove",
          oldWindowSize: prev.windowSize,
          oldMinSample: prev.minSample,
          oldThreshold: prev.threshold,
          newWindowSize: null,
          newMinSample: null,
          newThreshold: null,
        });
      }
    }
  }

  if (perTool && perTool.length > 0) {
    for (const t of perTool) {
      if (t.toolName === AI_ALERT_GLOBAL_KEY) continue;
      const prev = beforeFor(t.toolName);
      const next: ThresholdConfig = {
        windowSize: t.windowSize,
        minSample: t.minSample,
        threshold: t.firstTrySuccessRate,
      };
      await db
        .insert(aiAlertThresholdsTable)
        .values({
          toolName: t.toolName,
          windowSize: next.windowSize,
          minSample: next.minSample,
          threshold: next.threshold,
        })
        .onConflictDoUpdate({
          target: aiAlertThresholdsTable.toolName,
          set: {
            windowSize: next.windowSize,
            minSample: next.minSample,
            threshold: next.threshold,
            updatedAt: new Date(),
          },
        });
      if (!prev || !sameCfg(prev, next)) {
        changeRows.push({
          toolName: t.toolName,
          action: prev ? "update" : "create",
          oldWindowSize: prev?.windowSize ?? null,
          oldMinSample: prev?.minSample ?? null,
          oldThreshold: prev?.threshold ?? null,
          newWindowSize: next.windowSize,
          newMinSample: next.minSample,
          newThreshold: next.threshold,
        });
      }
    }
  }

  if (changeRows.length > 0) {
    await db.insert(aiAlertThresholdChangesTable).values(changeRows);
  }

  const { global: g, perTool: pt } = await loadThresholds();
  res.json({
    global: {
      windowSize: g.windowSize,
      minSample: g.minSample,
      firstTrySuccessRate: g.threshold,
    },
    perTool: Array.from(pt.entries()).map(([toolName, c]) => ({
      toolName,
      windowSize: c.windowSize,
      minSample: c.minSample,
      firstTrySuccessRate: c.threshold,
    })),
  });
});

export default router;
