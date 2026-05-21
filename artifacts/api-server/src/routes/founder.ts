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
  aiToolAlertStateTable,
  jobHeartbeatsTable,
  founderSettingsTable,
  FOUNDER_SETTINGS_REBREACH_COOLDOWN,
} from "@workspace/db";
import { and, count, sql, desc, gte, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod/v4";
import { requireFounder } from "../middlewares/founderAuth";
import type { OcrCorrectionsRecord, OcrCorrectionField } from "@workspace/db";
import {
  learnFromCorrections,
  listLearnedRules,
  listPendingRules,
  approveOcrRule,
  rejectOcrRule,
  listOcrRuleReviewLog,
  clearLearnedRules,
  deleteLearnedRule,
  toggleOcrRuleApproved,
} from "../lib/ocrLearning";
import {
  getRollupHeartbeat,
  getRollupStaleThresholdMs,
} from "../lib/aiMetricsRetention";
import {
  getTrashPurgeHeartbeat,
  getTrashPurgeStaleThresholdMs,
  purgeExpiredTrashedAudits,
} from "../lib/auditTrashPurge";
import { KNOWN_JOB_NAMES, getStaleThresholdMs } from "../lib/jobHeartbeat";
import { runGeoipUpdate } from "../lib/geoipUpdateJob";
import {
  DEFAULT_REBREACH_COOLDOWN_MINUTES,
  getEnvRebreachCooldownMinutes,
  getRebreachCooldownMs,
} from "../lib/aiReliabilityAlerts";

const router: IRouter = Router();

router.get("/founder/stats", requireFounder, async (req, res): Promise<void> => {
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

export function buildAlertReason(args: {
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

router.get("/founder/ai-metrics", requireFounder, async (_req, res): Promise<void> => {
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

  const alertStates = await db
    .select({
      toolName: aiToolAlertStateTable.toolName,
      breached: aiToolAlertStateTable.breached,
      lastClearedAt: aiToolAlertStateTable.lastClearedAt,
      consecutiveSendFailures: aiToolAlertStateTable.consecutiveSendFailures,
      lastSendFailureAt: aiToolAlertStateTable.lastSendFailureAt,
      lastSendFailureMessage: aiToolAlertStateTable.lastSendFailureMessage,
    })
    .from(aiToolAlertStateTable);

  const now = new Date();
  const cooldownMs = await getRebreachCooldownMs();

  const alertStateByTool = new Map(alertStates.map((s) => [s.toolName, s]));

  const mailerHealth = alertStates
    .filter((s) => (s.consecutiveSendFailures ?? 0) > 0)
    .map((s) => ({
      toolName: s.toolName,
      consecutiveSendFailures: Number(s.consecutiveSendFailures ?? 0),
      lastSendFailureAt: s.lastSendFailureAt,
      lastSendFailureMessage: s.lastSendFailureMessage,
    }))
    .sort((a, b) => b.consecutiveSendFailures - a.consecutiveSendFailures);

  // Compute cooldown state for every tool that has a lastClearedAt timestamp
  const cooldownStates = alertStates
    .filter((s) => s.lastClearedAt !== null)
    .map((s) => {
      const lastClearedAt = s.lastClearedAt!;
      const cooldownEndsAt = new Date(lastClearedAt.getTime() + cooldownMs);
      const remainingMs = Math.max(0, cooldownEndsAt.getTime() - now.getTime());
      const inCooldown = remainingMs > 0;
      const rebreachedDuringCooldown = inCooldown && (s.breached ?? false);
      return {
        toolName: s.toolName,
        inCooldown,
        lastClearedAt: lastClearedAt.toISOString(),
        cooldownEndsAt: cooldownEndsAt.toISOString(),
        cooldownRemainingMs: remainingMs,
        rebreachedDuringCooldown,
      };
    })
    .filter((s) => s.inCooldown);

  const cooldownToolNames = new Set(cooldownStates.map((s) => s.toolName));
  const cooldownByTool = new Map(cooldownStates.map((s) => [s.toolName, s]));

  const perToolWithCooldown = perToolNorm.map((t) => {
    const cd = cooldownByTool.get(t.toolName);
    return {
      ...t,
      inCooldown: cd != null,
      cooldownEndsAt: cd?.cooldownEndsAt ?? null,
      cooldownRemainingMs: cd?.cooldownRemainingMs ?? null,
    };
  });

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
    perTool: perToolWithCooldown,
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
    mailerHealth,
    cooldownStates,
    alerts: alerts.map((t) => {
      const state = alertStateByTool.get(t.toolName);
      const suppressedByCooldown = cooldownToolNames.has(t.toolName) && (state?.breached ?? false);
      return {
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
        suppressedByCooldown,
      };
    }),
  });
});

router.get("/founder/rollup-heartbeat", requireFounder, async (_req, res): Promise<void> => {
  const lastSuccessAt = await getRollupHeartbeat();
  const staleThresholdMs = getRollupStaleThresholdMs();
  if (!lastSuccessAt) {
    res.json({
      lastSuccessAt: null,
      ageMs: null,
      staleThresholdMs,
      stale: true,
    });
    return;
  }
  const ageMs = Date.now() - lastSuccessAt.getTime();
  res.json({
    lastSuccessAt: lastSuccessAt.toISOString(),
    ageMs,
    staleThresholdMs,
    stale: ageMs > staleThresholdMs,
  });
});

router.post("/founder/purge-trash", requireFounder, async (_req, res): Promise<void> => {
  const deleted = await purgeExpiredTrashedAudits();
  res.json({ deleted });
});

router.get("/founder/trash-purge-heartbeat", requireFounder, async (_req, res): Promise<void> => {
  const lastSuccessAt = await getTrashPurgeHeartbeat();
  const staleThresholdMs = getTrashPurgeStaleThresholdMs();
  if (!lastSuccessAt) {
    res.json({
      lastSuccessAt: null,
      ageMs: null,
      staleThresholdMs,
      stale: true,
    });
    return;
  }
  const ageMs = Date.now() - lastSuccessAt.getTime();
  res.json({
    lastSuccessAt: lastSuccessAt.toISOString(),
    ageMs,
    staleThresholdMs,
    stale: ageMs > staleThresholdMs,
  });
});

router.post("/founder/geoip/refresh", requireFounder, async (_req, res): Promise<void> => {
  const success = await runGeoipUpdate();
  if (success) {
    res.json({
      success: true,
      message: "GeoIP database refreshed successfully.",
    });
    return;
  }
  const licenseKey = process.env["MAXMIND_LICENSE_KEY"]?.trim();
  if (!licenseKey) {
    res.json({
      success: false,
      message:
        "MAXMIND_LICENSE_KEY is not set. Add it as a secret to enable GeoIP refreshes.",
    });
    return;
  }
  res.json({
    success: false,
    message:
      "GeoIP refresh failed. Check the server logs for details and verify the MaxMind license key is valid.",
  });
});

router.get("/founder/background-jobs", requireFounder, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(jobHeartbeatsTable)
    .orderBy(asc(jobHeartbeatsTable.jobName));

  const byName = new Map(
    rows.map((r) => [
      r.jobName,
      r.lastSuccessAt instanceof Date
        ? r.lastSuccessAt
        : new Date(r.lastSuccessAt as unknown as string),
    ]),
  );

  const allNames = new Set([
    ...KNOWN_JOB_NAMES,
    ...rows.map((r) => r.jobName),
  ]);

  const now = Date.now();
  const jobs = Array.from(allNames)
    .sort()
    .map((jobName) => {
      const lastSuccessAt = byName.get(jobName) ?? null;
      const staleThresholdMs = getStaleThresholdMs(jobName);
      if (!lastSuccessAt) {
        return { jobName, lastSuccessAt: null, ageMs: null, staleThresholdMs, stale: true };
      }
      const ageMs = now - lastSuccessAt.getTime();
      return {
        jobName,
        lastSuccessAt: lastSuccessAt.toISOString(),
        ageMs,
        staleThresholdMs,
        stale: ageMs > staleThresholdMs,
      };
    });

  res.json({ jobs });
});

router.get("/founder/ai-metrics/trends", requireFounder, async (req, res): Promise<void> => {
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

const OCR_WINDOW_DAYS = new Set([7, 30, 90]);
type OcrSortMode = "total" | "top";

router.get("/founder/ocr-mismatches", requireFounder, async (req, res): Promise<void> => {
  const rawWindow = typeof req.query.window === "string" ? req.query.window : "";
  const parsedWindow = Number(rawWindow);
  const windowDays =
    Number.isFinite(parsedWindow) && OCR_WINDOW_DAYS.has(parsedWindow)
      ? parsedWindow
      : null;
  const since = windowDays
    ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    : null;
  const rawSort = typeof req.query.sort === "string" ? req.query.sort : "";
  const sortMode: OcrSortMode = rawSort === "top" ? "top" : "total";

  const totalsWhere = since ? gte(auditsTable.createdAt, since) : undefined;
  const totalsQuery = db
    .select({
      totalScreenshotAudits: sql<number>`sum(case when ${auditsTable.source} = 'screenshot' then 1 else 0 end)`,
      auditsWithRawOcr: sql<number>`sum(case when ${auditsTable.rawOcrText} is not null then 1 else 0 end)`,
      auditsWithCorrections: sql<number>`sum(case when ${auditsTable.ocrCorrections} is not null then 1 else 0 end)`,
    })
    .from(auditsTable);
  const [totals] = totalsWhere
    ? await totalsQuery.where(totalsWhere)
    : await totalsQuery;

  const rowsWhere = since
    ? and(isNotNull(auditsTable.ocrCorrections), gte(auditsTable.createdAt, since))
    : isNotNull(auditsTable.ocrCorrections);
  const rowsQuery = db
    .select({
      id: auditsTable.id,
      ocrCorrections: auditsTable.ocrCorrections,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(rowsWhere)
    .orderBy(desc(auditsTable.createdAt));
  // When no time window is specified, keep the legacy 500-audit cap for
  // backward compatibility. When a window is selected, aggregate over every
  // corrected audit inside that window so per-field counts are accurate.
  const rows = since ? await rowsQuery : await rowsQuery.limit(500);

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
    const topDiffCount = diffs.length > 0 ? diffs[0].count : 0;
    return {
      field,
      correctionsCount: fieldCounts[field],
      topDiffCount,
      topDiffs: diffs,
    };
  }).sort((a, b) => {
    if (sortMode === "top") {
      if (b.topDiffCount !== a.topDiffCount) return b.topDiffCount - a.topDiffCount;
      return b.correctionsCount - a.correctionsCount;
    }
    if (b.correctionsCount !== a.correctionsCount) {
      return b.correctionsCount - a.correctionsCount;
    }
    return b.topDiffCount - a.topDiffCount;
  });

  res.json({
    summary: {
      totalScreenshotAudits: Number(totals?.totalScreenshotAudits ?? 0),
      auditsWithRawOcr: Number(totals?.auditsWithRawOcr ?? 0),
      auditsWithCorrections: Number(totals?.auditsWithCorrections ?? 0),
      sampleSize: rows.length,
      windowDays,
      since: since ? since.toISOString() : null,
      sort: sortMode,
    },
    perField,
    recent,
  });
});

router.get("/founder/ocr-mismatches/trends", requireFounder, async (req, res): Promise<void> => {
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), 90) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      ocrCorrections: auditsTable.ocrCorrections,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(and(isNotNull(auditsTable.ocrCorrections), gte(auditsTable.createdAt, since)))
    .orderBy(asc(auditsTable.createdAt));

  const byDayField = new Map<string, Record<OcrCorrectionField, number>>();

  for (const row of rows) {
    const corr = row.ocrCorrections as OcrCorrectionsRecord | null;
    if (!corr) continue;
    const raw = row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt);
    const day = raw.slice(0, 10);

    let entry = byDayField.get(day);
    if (!entry) {
      entry = { firstName: 0, age: 0, sourceApp: 0, bio: 0, prompts: 0 };
      byDayField.set(day, entry);
    }
    for (const field of OCR_FIELDS) {
      if (corr[field]) entry[field] += 1;
    }
  }

  const series: Array<{
    day: string;
    firstName: number;
    age: number;
    sourceApp: number;
    bio: number;
    prompts: number;
    total: number;
  }> = [];

  for (let d = 0; d <= days; d++) {
    const day = new Date(since.getTime() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const entry = byDayField.get(day) ?? { firstName: 0, age: 0, sourceApp: 0, bio: 0, prompts: 0 };
    const total = OCR_FIELDS.reduce((sum, f) => sum + entry[f], 0);
    series.push({ day, ...entry, total });
  }

  res.json({ days, since: since.toISOString().slice(0, 10), series });
});

function serializeRule(r: {
  id: string;
  kind: string;
  pattern: string;
  replacement: string;
  scope: string | null;
  occurrences: number;
  status: string;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  learnedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    kind: r.kind,
    pattern: r.pattern,
    replacement: r.replacement,
    scope: r.scope,
    occurrences: r.occurrences,
    status: r.status,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : (r.reviewedAt ? String(r.reviewedAt) : null),
    reviewedBy: r.reviewedBy ?? null,
    learnedAt: r.learnedAt instanceof Date ? r.learnedAt.toISOString() : String(r.learnedAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

router.get("/founder/ocr-rules", requireFounder, async (_req, res): Promise<void> => {
  const rules = await listLearnedRules();
  res.json({ rules: rules.map(serializeRule) });
});

router.get("/founder/ocr-pending-rules", requireFounder, async (_req, res): Promise<void> => {
  const rules = await listPendingRules();
  res.json({ rules: rules.map(serializeRule) });
});

router.post("/founder/ocr-pending-rules/:id/approve", requireFounder, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "Rule id is required." });
    return;
  }
  const rule = await approveOcrRule(id, "founder");
  if (!rule) {
    res.status(404).json({ error: "Rule not found." });
    return;
  }
  res.json({ rule: serializeRule(rule) });
});

router.post("/founder/ocr-pending-rules/:id/reject", requireFounder, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "Rule id is required." });
    return;
  }
  const rule = await rejectOcrRule(id, "founder");
  if (!rule) {
    res.status(404).json({ error: "Rule not found." });
    return;
  }
  res.json({ rule: serializeRule(rule) });
});

router.get("/founder/ocr-rule-review-log", requireFounder, async (req, res): Promise<void> => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;
  const log = await listOcrRuleReviewLog(limit);
  res.json({
    log: log.map((entry) => ({
      id: entry.id,
      ruleId: entry.ruleId,
      action: entry.action,
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt instanceof Date ? entry.reviewedAt.toISOString() : String(entry.reviewedAt),
      kind: entry.kind,
      pattern: entry.pattern,
      replacement: entry.replacement,
    })),
  });
});

router.post("/founder/ocr-learn", requireFounder, async (req, res): Promise<void> => {
  const sinceRaw = req.body?.since;
  let since: Date | undefined;
  if (sinceRaw !== undefined && sinceRaw !== null && sinceRaw !== "") {
    if (typeof sinceRaw !== "string" && typeof sinceRaw !== "number") {
      res.status(400).json({ error: "Invalid 'since' value." });
      return;
    }
    const parsed = new Date(sinceRaw);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: "Invalid 'since' value." });
      return;
    }
    since = parsed;
  }
  const result = await learnFromCorrections(since ? { since } : undefined);
  res.json({
    scannedAudits: result.scannedAudits,
    candidates: result.candidates,
    persisted: result.persisted,
  });
});

router.patch("/founder/ocr-rules/:id", requireFounder, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({ error: "Missing rule id" });
    return;
  }
  const rule = await toggleOcrRuleApproved(id.trim());
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json({ rule: serializeRule(rule) });
});

router.delete("/founder/ocr-rules/:id", requireFounder, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({ error: "Missing rule id" });
    return;
  }
  const deleted = await deleteLearnedRule(id.trim());
  if (!deleted) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/founder/ocr-rules", requireFounder, async (_req, res): Promise<void> => {
  const { deleted, preserved } = await clearLearnedRules();
  res.json({ ok: true, deleted, preserved });
});

router.get("/founder/ocr-mismatches/:auditId", requireFounder, async (req, res): Promise<void> => {
  const parsed = Number(req.params.auditId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    res.status(400).json({ error: "Invalid auditId" });
    return;
  }

  const [row] = await db
    .select({
      id: auditsTable.id,
      firstName: auditsTable.firstName,
      age: auditsTable.age,
      gender: auditsTable.gender,
      orientation: auditsTable.orientation,
      datingGoal: auditsTable.datingGoal,
      currentApps: auditsTable.currentApps,
      sourceApp: auditsTable.sourceApp,
      bio: auditsTable.bio,
      prompts: auditsTable.prompts,
      source: auditsTable.source,
      status: auditsTable.status,
      readinessScore: auditsTable.readinessScore,
      rawOcrText: auditsTable.rawOcrText,
      ocrCorrections: auditsTable.ocrCorrections,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, parsed))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.json({
    id: row.id,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    source: row.source,
    status: row.status,
    readinessScore: row.readinessScore ?? null,
    rawOcrText: row.rawOcrText ?? null,
    ocrCorrections: (row.ocrCorrections ?? null) as OcrCorrectionsRecord | null,
    profile: {
      firstName: row.firstName,
      age: row.age,
      gender: row.gender,
      orientation: row.orientation ?? null,
      datingGoal: row.datingGoal,
      currentApps: row.currentApps,
      sourceApp: row.sourceApp ?? null,
      bio: row.bio,
      prompts: row.prompts ?? null,
    },
  });
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

router.post("/founder/ai-threshold-changes/:id/undo", requireFounder, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid change id." });
    return;
  }
  const [row] = await db
    .select()
    .from(aiAlertThresholdChangesTable)
    .where(eq(aiAlertThresholdChangesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Threshold change not found." });
    return;
  }

  const toolName = row.toolName;
  const isGlobal = toolName === AI_ALERT_GLOBAL_KEY;
  const hasOld =
    row.oldWindowSize !== null && row.oldMinSample !== null && row.oldThreshold !== null;
  const [existing] = await db
    .select()
    .from(aiAlertThresholdsTable)
    .where(eq(aiAlertThresholdsTable.toolName, toolName))
    .limit(1);
  const hadRow = Boolean(existing);
  const current: ThresholdConfig | undefined = existing
    ? { windowSize: existing.windowSize, minSample: existing.minSample, threshold: existing.threshold }
    : undefined;

  let undoAction: "create" | "update" | "remove" | "reset";

  if (hasOld) {
    // Restore previous values (covers update, remove, reset originals).
    const w = row.oldWindowSize as number;
    const m = row.oldMinSample as number;
    const t = row.oldThreshold as number;
    await db
      .insert(aiAlertThresholdsTable)
      .values({ toolName, windowSize: w, minSample: m, threshold: t })
      .onConflictDoUpdate({
        target: aiAlertThresholdsTable.toolName,
        set: { windowSize: w, minSample: m, threshold: t, updatedAt: new Date() },
      });
    undoAction = hadRow ? "update" : "create";
    await db.insert(aiAlertThresholdChangesTable).values({
      toolName,
      action: undoAction,
      oldWindowSize: current?.windowSize ?? null,
      oldMinSample: current?.minSample ?? null,
      oldThreshold: current?.threshold ?? null,
      newWindowSize: w,
      newMinSample: m,
      newThreshold: t,
    });
  } else {
    // Original action was a "create" with no prior values — inverse is to remove the row.
    await db.delete(aiAlertThresholdsTable).where(eq(aiAlertThresholdsTable.toolName, toolName));
    undoAction = isGlobal ? "reset" : "remove";
    await db.insert(aiAlertThresholdChangesTable).values({
      toolName,
      action: undoAction,
      oldWindowSize: current?.windowSize ?? null,
      oldMinSample: current?.minSample ?? null,
      oldThreshold: current?.threshold ?? null,
      newWindowSize: null,
      newMinSample: null,
      newThreshold: null,
    });
  }

  const { global: g, perTool: pt } = await loadThresholds();
  res.json({
    undoneId: id,
    undoAction,
    global: {
      windowSize: g.windowSize,
      minSample: g.minSample,
      firstTrySuccessRate: g.threshold,
    },
    perTool: Array.from(pt.entries()).map(([n, c]) => ({
      toolName: n,
      windowSize: c.windowSize,
      minSample: c.minSample,
      firstTrySuccessRate: c.threshold,
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

const MAX_REBREACH_COOLDOWN_MINUTES = 1440;

router.get("/founder/alert-settings", requireFounder, async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(founderSettingsTable)
    .where(eq(founderSettingsTable.key, FOUNDER_SETTINGS_REBREACH_COOLDOWN))
    .limit(1);
  const envMinutes = getEnvRebreachCooldownMinutes();
  res.json({
    rebreachCooldownMinutes: row != null ? row.value : envMinutes,
    envMinutes,
    defaultMinutes: DEFAULT_REBREACH_COOLDOWN_MINUTES,
    isOverridden: row != null,
    updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
  });
});

const putAlertSettingsSchema = z.object({
  rebreachCooldownMinutes: z
    .number()
    .min(1, "Must be at least 1 minute")
    .max(MAX_REBREACH_COOLDOWN_MINUTES, `Cannot exceed ${MAX_REBREACH_COOLDOWN_MINUTES} minutes`),
});

router.put("/founder/alert-settings", requireFounder, async (req, res): Promise<void> => {
  const parsed = putAlertSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid alert settings payload.", details: parsed.error.format() });
    return;
  }
  const { rebreachCooldownMinutes } = parsed.data;
  const now = new Date();
  await db
    .insert(founderSettingsTable)
    .values({ key: FOUNDER_SETTINGS_REBREACH_COOLDOWN, value: rebreachCooldownMinutes, updatedAt: now })
    .onConflictDoUpdate({
      target: founderSettingsTable.key,
      set: { value: rebreachCooldownMinutes, updatedAt: now },
    });
  res.json({
    rebreachCooldownMinutes,
    updatedAt: now.toISOString(),
    isOverridden: true,
  });
});

router.delete("/founder/alert-settings/rebreach-cooldown", requireFounder, async (_req, res): Promise<void> => {
  await db
    .delete(founderSettingsTable)
    .where(eq(founderSettingsTable.key, FOUNDER_SETTINGS_REBREACH_COOLDOWN));
  const envMinutes = getEnvRebreachCooldownMinutes();
  res.json({
    rebreachCooldownMinutes: envMinutes,
    envMinutes,
    defaultMinutes: DEFAULT_REBREACH_COOLDOWN_MINUTES,
    isOverridden: false,
    updatedAt: null,
  });
});

export default router;
