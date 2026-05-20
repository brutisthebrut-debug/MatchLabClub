import { Router, type IRouter } from "express";
import {
  db,
  leadsTable,
  purchaseInterestTable,
  auditsTable,
  waitlistTable,
  messageCoachingSessionsTable,
  aiRequestMetricsTable,
} from "@workspace/db";
import { count, sql, desc } from "drizzle-orm";

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

const ALERT_WINDOW = 50;
const ALERT_MIN_SAMPLE = 10;
const ALERT_THRESHOLD = 0.7;

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

export default router;
