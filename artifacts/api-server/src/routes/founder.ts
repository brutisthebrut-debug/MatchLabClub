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
} from "@workspace/db";
import { count, sql, desc, gte, asc, isNotNull } from "drizzle-orm";
import {
  ALERT_WINDOW,
  ALERT_MIN_SAMPLE,
  ALERT_THRESHOLD,
} from "../lib/aiReliabilityAlerts";
import type { OcrCorrectionsRecord, OcrCorrectionField } from "@workspace/db";

const router: IRouter = Router();

router.get("/founder/stats", async (req, res): Promise<void> => {
  const [leadsCount] = await db.select({ c: count() }).from(leadsTable);
  const [purchaseCount] = await db.select({ c: count() }).from(purchaseInterestTable);
  const [auditsCount] = await db.select({ c: count() }).from(auditsTable);
  const [waitlistCount] = await db.select({ c: count() }).from(waitlistTable);
  const [messagesCount] = await db.select({ c: count() }).from(messageCoachingSessionsTable);

  res.json({
    leads: Number(leadsCount?.c ?? 0),
    purchaseInterest: Number(purchaseCount?.c ?? 0),
    audits: Number(auditsCount?.c ?? 0),
    waitlist: Number(waitlistCount?.c ?? 0),
    messages: Number(messagesCount?.c ?? 0),
  });
});

router.get("/founder/ai-metrics", async (_req, res): Promise<void> => {
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

  const recentRows = await db.execute<{
    tool_name: string;
    recent_total: string | number;
    recent_first_try_ok: string | number;
    recent_fallbacks: string | number;
  }>(sql`
    select
      tool_name,
      count(*) as recent_total,
      sum(case when attempts = 1 and is_fallback = false then 1 else 0 end) as recent_first_try_ok,
      sum(case when is_fallback = true then 1 else 0 end) as recent_fallbacks
    from (
      select
        tool_name,
        attempts,
        is_fallback,
        row_number() over (partition by tool_name order by created_at desc) as rn
      from ai_request_metrics
    ) t
    where rn <= ${ALERT_WINDOW}
    group by tool_name
  `);

  const recentByTool = new Map<string, { total: number; firstTryOk: number; fallbacks: number }>();
  for (const r of recentRows.rows ?? []) {
    recentByTool.set(r.tool_name, {
      total: Number(r.recent_total ?? 0),
      firstTryOk: Number(r.recent_first_try_ok ?? 0),
      fallbacks: Number(r.recent_fallbacks ?? 0),
    });
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
    const recent = recentByTool.get(row.toolName) ?? { total: 0, firstTryOk: 0, fallbacks: 0 };
    const recentRate = recent.total > 0 ? recent.firstTryOk / recent.total : 0;
    const alert =
      recent.total >= ALERT_MIN_SAMPLE && recentRate < ALERT_THRESHOLD;
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
        windowSize: ALERT_WINDOW,
        total: recent.total,
        firstTryOk: recent.firstTryOk,
        fallbacks: recent.fallbacks,
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
      windowSize: ALERT_WINDOW,
      minSample: ALERT_MIN_SAMPLE,
      firstTrySuccessRate: ALERT_THRESHOLD,
    },
    alerts: alerts.map((t) => ({
      toolName: t.toolName,
      recentTotal: t.recent.total,
      recentFirstTrySuccessRate: t.recent.firstTrySuccessRate,
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

export default router;
