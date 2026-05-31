import { Router, type IRouter } from "express";
import {
  db,
  leadsTable,
  purchaseInterestTable,
  auditsTable,
  waitlistTable,
  messageCoachingSessionsTable,
  referralsTable,
  usersTable,
  aiRequestMetricsTable,
  aiRequestMetricsDailyTable,
  aiAlertThresholdsTable,
  aiAlertThresholdChangesTable,
  aiUsageCountersTable,
  AI_ALERT_GLOBAL_KEY,
  coachFollowUpsTable,
  aiToolAlertStateTable,
  jobHeartbeatsTable,
  founderSettingsTable,
  FOUNDER_SETTINGS_REBREACH_COOLDOWN,
  wellnessAnswersTable,
  wellnessTagsTable,
  matchProposalsTable,
  matchPoolMembershipTable,
  matchPreferencesTable,
  compatibilityReadsTable,
  lifePulsesTable,
  founderCurationTable,
  matchingReadinessSnapshotsTable,
} from "@workspace/db";
import {
  loadBrainControls,
  saveBrainControls,
  resetBrainControls,
  brainControlsOverridden,
  defaultControls,
  effectiveBaseWeights,
  effectiveReadinessThreshold,
  CONNECTOR_CATALOG,
  type BrainControls,
} from "../lib/brainConfig";
import {
  SIGNAL_REGISTRY,
  normalizedWeights,
  proposeWeightAdjustments,
} from "../lib/signalRegistry";
import {
  computeReadiness,
  computeOutcomeInsightForUser,
} from "./matching";
import { and, count, sql, desc, gte, asc, eq, isNotNull, lt, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
import { PLAYBOOK, buildEchoSystemPrompt } from "@workspace/echo";
import { generate as aiGenerate } from "../lib/aiService";

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

router.get("/founder/wellness-stats", requireFounder, async (_req, res): Promise<void> => {
  const [totalAnswers] = await db.select({ c: count() }).from(wellnessAnswersTable);
  const [totalTags]    = await db.select({ c: count() }).from(wellnessTagsTable);
  const [usersWithAnswers] = await db
    .select({ c: sql<number>`count(distinct ${wellnessAnswersTable.userId})::int` })
    .from(wellnessAnswersTable);
  const [usersApprovedMatching] = await db
    .select({ c: sql<number>`count(distinct ${wellnessAnswersTable.userId})::int` })
    .from(wellnessAnswersTable)
    .where(sql`${wellnessAnswersTable.consentLevel} in ('matching', 'all')`);

  // dimensions answered (distinct dimension values)
  const dimensionRows = await db
    .selectDistinct({ dimension: wellnessAnswersTable.dimension })
    .from(wellnessAnswersTable);

  // answers per dimension
  const dimensionCounts = await db
    .select({
      dimension: wellnessAnswersTable.dimension,
      c: count(),
    })
    .from(wellnessAnswersTable)
    .groupBy(wellnessAnswersTable.dimension)
    .orderBy(desc(count()));

  res.json({
    totalAnswers:          Number(totalAnswers?.c ?? 0),
    totalTags:             Number(totalTags?.c ?? 0),
    usersWithAnswers:      Number(usersWithAnswers?.c ?? 0),
    usersApprovedMatching: Number(usersApprovedMatching?.c ?? 0),
    dimensionsAnswered:    dimensionRows.length,
    topDimensions:         dimensionCounts.slice(0, 6).map(d => ({ dimension: d.dimension, count: Number(d.c) })),
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

router.get("/founder/ai-usage/today", requireFounder, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const topRows = await db
    .select({
      userId: aiUsageCountersTable.userId,
      provider: aiUsageCountersTable.provider,
      callCount: aiUsageCountersTable.callCount,
    })
    .from(aiUsageCountersTable)
    .where(eq(aiUsageCountersTable.date, today))
    .orderBy(desc(aiUsageCountersTable.callCount))
    .limit(20);

  const [totals] = await db
    .select({
      totalCalls: sql<number>`coalesce(sum(${aiUsageCountersTable.callCount}), 0)::int`,
      uniqueUsers: sql<number>`count(distinct ${aiUsageCountersTable.userId})::int`,
    })
    .from(aiUsageCountersTable)
    .where(eq(aiUsageCountersTable.date, today));

  res.json({
    date: today,
    totalCalls: Number(totals?.totalCalls ?? 0),
    uniqueUsers: Number(totals?.uniqueUsers ?? 0),
    topUsers: topRows.map((r) => ({
      userId: r.userId,
      provider: r.provider,
      callCount: Number(r.callCount),
    })),
  });
});

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

router.post("/founder/users/set-tier", requireFounder, async (req, res): Promise<void> => {
  const emailRaw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const tierRaw = req.body?.tier;
  if (!emailRaw || !emailRaw.includes("@")) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  const allowedTiers = new Set(["free", "reset", "wingman", null]);
  const tier: string | null = tierRaw === null || tierRaw === "" ? null : String(tierRaw);
  if (!allowedTiers.has(tier)) {
    res.status(400).json({ error: "Tier must be one of: free, reset, wingman, or null to clear." });
    return;
  }
  const now = new Date();
  const updated = await db
    .update(usersTable)
    .set({
      tier,
      tierGrantedAt: tier === null ? null : now,
      updatedAt: now,
    })
    .where(eq(usersTable.email, emailRaw))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      tier: usersTable.tier,
      tierGrantedAt: usersTable.tierGrantedAt,
    });
  if (updated.length === 0) {
    res.status(404).json({ error: `No user with email ${emailRaw}.` });
    return;
  }
  const row = updated[0]!;
  req.log.info(
    { userId: row.id, email: row.email, tier: row.tier },
    "Founder set user tier",
  );
  res.json({
    user: {
      id: row.id,
      email: row.email,
      tier: row.tier,
      tierGrantedAt: row.tierGrantedAt ? row.tierGrantedAt.toISOString() : null,
    },
  });
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

// Paid signal: purchase_interest.status = 'paid' (the only status the rest of
// the founder dashboard treats as money-in). purchase_interest has no userId
// column, so we join on email, the same key Stripe checkout sessions are
// created with. Users without an email on file can never be marked converted.
router.get("/founder/referrals", requireFounder, async (_req, res): Promise<void> => {
  const inviter = alias(usersTable, "inviter");
  const invitee = alias(usersTable, "invitee");

  const paidEmailRows = await db
    .selectDistinct({ email: purchaseInterestTable.email })
    .from(purchaseInterestTable)
    .where(eq(purchaseInterestTable.status, "paid"));
  const paidEmails = new Set(
    paidEmailRows
      .map((r) => (r.email ?? "").toLowerCase())
      .filter((e) => e.length > 0),
  );

  const [{ total = 0, unique = 0 } = { total: 0, unique: 0 }] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${referralsTable.inviterUserId})::int`,
    })
    .from(referralsTable);

  const inviterRows = await db
    .select({
      inviterUserId: referralsTable.inviterUserId,
      inviterEmail: inviter.email,
      inviterFirstName: inviter.firstName,
      inviterLastName: inviter.lastName,
      invitedCount: sql<number>`count(${referralsTable.inviteeUserId})::int`,
      paidCount: sql<number>`count(${referralsTable.inviteeUserId}) filter (where lower(${invitee.email}) in (
        select lower(email) from ${purchaseInterestTable} where ${purchaseInterestTable.status} = 'paid' and email is not null
      ))::int`,
    })
    .from(referralsTable)
    .leftJoin(inviter, eq(inviter.id, referralsTable.inviterUserId))
    .leftJoin(invitee, eq(invitee.id, referralsTable.inviteeUserId))
    .groupBy(referralsTable.inviterUserId, inviter.email, inviter.firstName, inviter.lastName)
    .orderBy(desc(sql`count(${referralsTable.inviteeUserId})`))
    .limit(20);

  const topInviters = inviterRows.map((r) => {
    const invitedCount = Number(r.invitedCount ?? 0);
    const paidCount = Number(r.paidCount ?? 0);
    const first = (r.inviterFirstName ?? "").trim();
    const last = (r.inviterLastName ?? "").trim();
    const display = [first, last].filter((s) => s.length > 0).join(" ");
    return {
      inviterUserId: r.inviterUserId,
      inviterEmail: r.inviterEmail ?? "",
      inviterDisplayName: display.length > 0 ? display : null,
      invitedCount,
      paidCount,
      conversionRate: invitedCount > 0 ? paidCount / invitedCount : 0,
    };
  });

  const surfaceRows = await db
    .select({
      surface: referralsTable.surface,
      count: sql<number>`count(*)::int`,
      paidCount: sql<number>`count(*) filter (where lower(${invitee.email}) in (
        select lower(email) from ${purchaseInterestTable} where ${purchaseInterestTable.status} = 'paid' and email is not null
      ))::int`,
    })
    .from(referralsTable)
    .leftJoin(invitee, eq(invitee.id, referralsTable.inviteeUserId))
    .groupBy(referralsTable.surface)
    .orderBy(desc(sql`count(*)`));

  const surfaceBreakdown = surfaceRows.map((r) => {
    const count = Number(r.count ?? 0);
    const paidCount = Number(r.paidCount ?? 0);
    return {
      surface: r.surface ?? "(unknown)",
      count,
      paidCount,
      conversionRate: count > 0 ? paidCount / count : 0,
    };
  });

  const recentRows = await db
    .select({
      createdAt: referralsTable.landedAt,
      inviterEmail: inviter.email,
      inviteeEmail: invitee.email,
      surface: referralsTable.surface,
      invitedAt: invitee.invitedAt,
    })
    .from(referralsTable)
    .leftJoin(inviter, eq(inviter.id, referralsTable.inviterUserId))
    .leftJoin(invitee, eq(invitee.id, referralsTable.inviteeUserId))
    .orderBy(desc(referralsTable.landedAt))
    .limit(50);

  const recentReferrals = recentRows.map((r) => {
    const inviteeEmail = (r.inviteeEmail ?? "").toLowerCase();
    return {
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as unknown as string)).toISOString(),
      inviterEmail: r.inviterEmail ?? "",
      inviteeEmail: r.inviteeEmail ?? "",
      surface: r.surface ?? null,
      invitedAt: r.invitedAt
        ? (r.invitedAt instanceof Date ? r.invitedAt : new Date(r.invitedAt as unknown as string)).toISOString()
        : null,
      invitedConverted: inviteeEmail.length > 0 && paidEmails.has(inviteeEmail),
    };
  });

  const totalInvited = Number(total);
  const totalPaid = surfaceBreakdown.reduce((sum, s) => sum + s.paidCount, 0);

  res.json({
    totalReferrals: totalInvited,
    uniqueInviters: Number(unique),
    overallConversionRate: totalInvited > 0 ? totalPaid / totalInvited : 0,
    topInviters,
    surfaceBreakdown,
    recentReferrals,
  });
});

// Attribution view: paid is defined by users.tier IN ('reset','wingman'),
// the founder-stamped source of truth for paid customers (post Stripe). This
// differs from /founder/referrals above, which leans on purchase_interest.
router.get("/founder/referrals/attribution", requireFounder, async (req, res): Promise<void> => {
  const inviter = alias(usersTable, "inviter_attr");
  const invitee = alias(usersTable, "invitee_attr");

  const [totalsRow] = await db
    .select({
      totalReferrals: sql<number>`count(*)::int`,
      totalInviters: sql<number>`count(distinct ${referralsTable.inviterUserId})::int`,
      totalPaidConverts: sql<number>`count(${referralsTable.inviteeUserId}) filter (where ${invitee.tier} in ('reset','wingman'))::int`,
    })
    .from(referralsTable)
    .leftJoin(invitee, eq(invitee.id, referralsTable.inviteeUserId));

  const totalReferrals = Number(totalsRow?.totalReferrals ?? 0);
  const totalInviters = Number(totalsRow?.totalInviters ?? 0);
  const totalPaidConverts = Number(totalsRow?.totalPaidConverts ?? 0);

  const topReferrerRows = await db
    .select({
      inviterUserId: referralsTable.inviterUserId,
      inviterEmail: inviter.email,
      inviterFirstName: inviter.firstName,
      inviteeCount: sql<number>`count(${referralsTable.inviteeUserId})::int`,
      paidConversions: sql<number>`count(${referralsTable.inviteeUserId}) filter (where ${invitee.tier} in ('reset','wingman'))::int`,
    })
    .from(referralsTable)
    .leftJoin(inviter, eq(inviter.id, referralsTable.inviterUserId))
    .leftJoin(invitee, eq(invitee.id, referralsTable.inviteeUserId))
    .groupBy(referralsTable.inviterUserId, inviter.email, inviter.firstName)
    .orderBy(desc(sql`count(${referralsTable.inviteeUserId})`))
    .limit(25);

  const topReferrers = topReferrerRows.map((r) => {
    const inviteeCount = Number(r.inviteeCount ?? 0);
    const paidConversions = Number(r.paidConversions ?? 0);
    return {
      inviterUserId: r.inviterUserId,
      inviterEmail: r.inviterEmail ?? "",
      inviterFirstName: r.inviterFirstName ?? null,
      inviteeCount,
      paidConversions,
      conversionRate: inviteeCount > 0 ? paidConversions / inviteeCount : 0,
    };
  });

  const surfaceRows = await db
    .select({
      surface: referralsTable.surface,
      count: sql<number>`count(*)::int`,
    })
    .from(referralsTable)
    .groupBy(referralsTable.surface)
    .orderBy(desc(sql`count(*)`))
    .limit(15);

  const topSurfaces = surfaceRows.map((r) => ({
    surface: r.surface ?? "(unknown)",
    count: Number(r.count ?? 0),
  }));

  req.log.info(
    {
      totalReferrals,
      totalInviters,
      totalPaidConverts,
      topReferrerCount: topReferrers.length,
      surfaceCount: topSurfaces.length,
    },
    "founder.referrals.attribution served",
  );

  res.json({
    topReferrers,
    topSurfaces,
    totals: {
      totalReferrals,
      totalInviters,
      totalPaidConverts,
      overallConversionRate: totalReferrals > 0 ? totalPaidConverts / totalReferrals : 0,
    },
  });
});

// Readiness-to-revenue funnel. Counts distinct users at each stage of the
// journey (accounts -> fed a signal -> gained readiness -> entered the pool ->
// got a match intro -> purchased) so the founder can see where people drop off.
// Anonymous visits are tracked client-side via analytics, so the first
// server-visible stage is accounts.
router.get("/founder/funnel", requireFounder, async (req, res): Promise<void> => {
  const [
    accountsRow,
    auditUsers,
    wellnessUsers,
    compatibilityUsers,
    lifePulseUsers,
    readinessRows,
    poolRows,
    proposalUserRows,
    proposalToRows,
    paidUserRows,
    paidInterestRow,
    readinessThreshold,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(usersTable),
    db
      .selectDistinct({ userId: auditsTable.userId })
      .from(auditsTable)
      .where(isNotNull(auditsTable.userId)),
    db
      .selectDistinct({ userId: wellnessAnswersTable.userId })
      .from(wellnessAnswersTable)
      .where(isNotNull(wellnessAnswersTable.userId)),
    db
      .selectDistinct({ userId: compatibilityReadsTable.userId })
      .from(compatibilityReadsTable)
      .where(isNotNull(compatibilityReadsTable.userId)),
    db
      .selectDistinct({ userId: lifePulsesTable.userId })
      .from(lifePulsesTable)
      .where(isNotNull(lifePulsesTable.userId)),
    db
      .selectDistinct({ userId: matchingReadinessSnapshotsTable.userId })
      .from(matchingReadinessSnapshotsTable)
      .where(gte(matchingReadinessSnapshotsTable.score, 1)),
    db
      .selectDistinct({ userId: matchPoolMembershipTable.userId })
      .from(matchPoolMembershipTable)
      .where(sql`${matchPoolMembershipTable.status} <> 'off'`),
    db
      .selectDistinct({ userId: matchProposalsTable.userId })
      .from(matchProposalsTable),
    db
      .selectDistinct({ userId: matchProposalsTable.proposedToUserId })
      .from(matchProposalsTable)
      .where(isNotNull(matchProposalsTable.proposedToUserId)),
    db
      .selectDistinct({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.tier, ["reset", "wingman"])),
    db
      .select({
        n: sql<number>`count(distinct lower(${purchaseInterestTable.email}))::int`,
      })
      .from(purchaseInterestTable)
      .where(eq(purchaseInterestTable.status, "paid")),
    effectiveReadinessThreshold(),
  ]);

  const accounts = Number(accountsRow[0]?.n ?? 0);

  const signalFed = new Set<string>(
    [...auditUsers, ...wellnessUsers, ...compatibilityUsers, ...lifePulseUsers]
      .map((r) => r.userId)
      .filter((id): id is string => Boolean(id)),
  ).size;

  const readinessGained = readinessRows.length;
  const enteredMatching = poolRows.length;

  const matched = new Set<string>([
    ...proposalUserRows.map((r) => r.userId).filter((id): id is string => Boolean(id)),
    ...proposalToRows.map((r) => r.userId).filter((id): id is string => Boolean(id)),
  ]).size;

  const purchased = paidUserRows.length;
  const paidViaPurchaseInterest = Number(paidInterestRow[0]?.n ?? 0);

  const ordered = [
    { key: "accounts", label: "Accounts", count: accounts },
    { key: "signal_fed", label: "Fed a signal", count: signalFed },
    { key: "readiness_gained", label: "Gained readiness", count: readinessGained },
    { key: "entered_matching", label: "Entered matching pool", count: enteredMatching },
    { key: "matched", label: "Got a match intro", count: matched },
    { key: "purchased", label: "Purchased", count: purchased },
  ];

  const stages = ordered.map((stage, i) => {
    if (i === 0) return { ...stage, conversionFromPrev: null };
    const prev = ordered[i - 1].count;
    return {
      ...stage,
      conversionFromPrev: prev > 0 ? stage.count / prev : 0,
    };
  });

  req.log.info(
    { accounts, signalFed, readinessGained, enteredMatching, matched, purchased },
    "founder.funnel served",
  );

  res.json({
    stages,
    readinessThreshold,
    paidViaPurchaseInterest,
    overallConversionRate: accounts > 0 ? purchased / accounts : 0,
  });
});

router.post("/founder/geoip/refresh", requireFounder, async (_req, res): Promise<void> => {
  if (process.env.NODE_ENV === "test") {
    res.json({
      success: true,
      message: "GeoIP refresh skipped in test environment.",
    });
    return;
  }
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
    // Original action was a "create" with no prior values, inverse is to remove the row.
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

const askCopilotSchema = z.object({
  question: z.string().min(4).max(2000),
  contextHint: z.string().max(1000).optional(),
});

function pickClosestPlaybookEntry(question: string): typeof PLAYBOOK[number] {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  let best = PLAYBOOK[0];
  let bestScore = -1;
  for (const entry of PLAYBOOK) {
    const haystack =
      `${entry.id} ${entry.decision} ${entry.rationale} ${entry.revisitWhen}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (haystack.includes(tok)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

router.post("/founder/copilot/ask", requireFounder, async (req, res): Promise<void> => {
  const parsed = askCopilotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body.", details: parsed.error.format() });
    return;
  }
  const { question, contextHint } = parsed.data;

  const playbookJson = JSON.stringify(PLAYBOOK);
  const taskBrief = [
    "You are Echo, MatchLab Club's cofounder voice. The founder is asking you for strategic guidance based on the playbook below.",
    "Reply in Echo's voice. Be specific, be willing to push back, no jargon, no em dashes. Reference the playbook decisions when relevant. Max 350 words.",
    "",
    "Embedded playbook (JSON, reference material only, do not echo it back verbatim):",
    playbookJson,
  ].join("\n");
  const system = buildEchoSystemPrompt(taskBrief);

  const userMessage = contextHint && contextHint.trim().length > 0
    ? `Question: ${question}\n\nContext the founder added: ${contextHint}`
    : `Question: ${question}`;

  // requireContentConsent is intentionally false here: the founder copilot
  // operates on the founder's own strategic questions, not on end-user
  // content (bios, messages, journal entries). The account-level AI
  // consent gate is scoped to end-user data. This endpoint is gated by
  // requireFounder instead, which is the appropriate trust boundary.
  const result = await aiGenerate(
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user: userMessage,
      expectJson: false,
      requireContentConsent: false,
      maxTokens: 2048,
      context: { toolName: "founder-copilot-ask" },
    },
    "",
  );

  if (result.isFallback || result.output.trim().length === 0) {
    const closest = pickClosestPlaybookEntry(question);
    res.json({
      answer:
        `Echo couldn't reach the model right now. Here's the relevant playbook entry instead: ` +
        `${closest.decision} (revisit when: ${closest.revisitWhen})`,
      fallback: true,
    });
    return;
  }

  res.json({ answer: result.output });
});

// ---------------------------------------------------------------------------
// Founder Matching Review Queue
// ---------------------------------------------------------------------------

const MatchingProposalStatusBody = z.object({
  status: z.enum(["reviewed", "sent", "dismissed"]),
});

const MatchingProposalNoteBody = z.object({
  note: z.string().trim().min(1).max(4000),
});

router.get(
  "/founder/matching/queue",
  requireFounder,
  async (req, res): Promise<void> => {
    const beforeRaw = typeof req.query.before === "string" ? req.query.before : "";
    const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
    const conditions = [eq(matchProposalsTable.status, "proposed")];
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      conditions.push(lt(matchProposalsTable.createdAt, beforeDate));
    }

    const rows = await db
      .select({
        id: matchProposalsTable.id,
        userId: matchProposalsTable.userId,
        proposedToUserId: matchProposalsTable.proposedToUserId,
        source: matchProposalsTable.source,
        compatibilityScore: matchProposalsTable.compatibilityScore,
        summary: matchProposalsTable.summary,
        status: matchProposalsTable.status,
        createdAt: matchProposalsTable.createdAt,
        updatedAt: matchProposalsTable.updatedAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        poolStatus: matchPoolMembershipTable.status,
        poolTier: matchPoolMembershipTable.tier,
      })
      .from(matchProposalsTable)
      .leftJoin(usersTable, eq(usersTable.id, matchProposalsTable.userId))
      .leftJoin(
        matchPoolMembershipTable,
        eq(matchPoolMembershipTable.userId, matchProposalsTable.userId),
      )
      .where(and(...conditions))
      .orderBy(desc(matchProposalsTable.createdAt))
      .limit(50);

    // For external_paste rows, look up the most recent compatibility_reads
    // row written by that user with mode='matching_external' at or before the
    // proposal createdAt. The matching route inserts both rows back to back,
    // so this is the right pairing in practice.
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let rawText: string | null = null;
        if (row.source === "external_paste") {
          const readRows = await db
            .select({ rawText: compatibilityReadsTable.rawText })
            .from(compatibilityReadsTable)
            .where(
              and(
                eq(compatibilityReadsTable.userId, row.userId),
                eq(compatibilityReadsTable.mode, "matching_external"),
                lte(compatibilityReadsTable.createdAt, row.createdAt),
              ),
            )
            .orderBy(desc(compatibilityReadsTable.createdAt))
            .limit(1);
          rawText = readRows[0]?.rawText ?? null;
        }
        return {
          id: row.id,
          userId: row.userId,
          proposedToUserId: row.proposedToUserId,
          source: row.source,
          compatibilityScore: row.compatibilityScore,
          summary: row.summary,
          status: row.status,
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
          updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
          user: {
            email: row.userEmail ?? null,
            firstName: row.userFirstName ?? null,
          },
          pool: {
            status: row.poolStatus ?? null,
            tier: row.poolTier ?? null,
          },
          rawText,
        };
      }),
    );

    res.json({ items: enriched });
  },
);

router.post(
  "/founder/matching/proposals/:id/note",
  requireFounder,
  async (req, res): Promise<void> => {
    const id = String(req.params.id ?? "");
    if (!id) {
      res.status(400).json({ error: "Missing proposal id" });
      return;
    }
    const parsed = MatchingProposalNoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await db
      .select({ summary: matchProposalsTable.summary })
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    const prior = existing[0]?.summary ?? "";
    const stamp = new Date().toISOString();
    const appended = `${prior ? `${prior}\n\n` : ""}FOUNDER: ${parsed.data.note.trim()} (${stamp})`;
    const [updated] = await db
      .update(matchProposalsTable)
      .set({ summary: appended })
      .where(eq(matchProposalsTable.id, id))
      .returning({
        id: matchProposalsTable.id,
        summary: matchProposalsTable.summary,
      });
    req.log.info({ proposalId: id }, "founder.matching.note appended");
    res.json({ id: updated!.id, summary: updated!.summary });
  },
);

router.post(
  "/founder/matching/proposals/:id/status",
  requireFounder,
  async (req, res): Promise<void> => {
    const id = String(req.params.id ?? "");
    if (!id) {
      res.status(400).json({ error: "Missing proposal id" });
      return;
    }
    const parsed = MatchingProposalStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [updated] = await db
      .update(matchProposalsTable)
      .set({ status: parsed.data.status })
      .where(eq(matchProposalsTable.id, id))
      .returning({
        id: matchProposalsTable.id,
        status: matchProposalsTable.status,
      });
    if (!updated) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    req.log.info(
      { proposalId: id, status: parsed.data.status },
      "founder.matching.proposal status changed",
    );
    res.json({ id: updated.id, status: updated.status });
  },
);

router.get(
  "/founder/matching/pool",
  requireFounder,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        userId: matchPoolMembershipTable.userId,
        status: matchPoolMembershipTable.status,
        tier: matchPoolMembershipTable.tier,
        readyAt: matchPoolMembershipTable.readyAt,
        updatedAt: matchPoolMembershipTable.updatedAt,
        pausedReason: matchPoolMembershipTable.pausedReason,
        userEmail: usersTable.email,
        userTier: usersTable.tier,
        cityHint: matchPreferencesTable.cityHint,
        ageMin: matchPreferencesTable.ageMin,
        ageMax: matchPreferencesTable.ageMax,
        genderPreference: matchPreferencesTable.genderPreference,
      })
      .from(matchPoolMembershipTable)
      .leftJoin(usersTable, eq(usersTable.id, matchPoolMembershipTable.userId))
      .leftJoin(
        matchPreferencesTable,
        eq(matchPreferencesTable.userId, matchPoolMembershipTable.userId),
      )
      .where(inArray(matchPoolMembershipTable.status, ["ready", "concierge_only"]))
      .orderBy(desc(matchPoolMembershipTable.readyAt))
      .limit(50);

    res.json({
      items: rows.map((row) => ({
        userId: row.userId,
        status: row.status,
        tier: row.tier,
        readyAt: row.readyAt instanceof Date ? row.readyAt.toISOString() : row.readyAt ? String(row.readyAt) : null,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
        pausedReason: row.pausedReason ?? null,
        user: {
          email: row.userEmail ?? null,
          tier: row.userTier ?? null,
        },
        preferences: {
          cityHint: row.cityHint ?? null,
          ageMin: row.ageMin ?? null,
          ageMax: row.ageMax ?? null,
          genderPreference: row.genderPreference ?? null,
        },
      })),
    });
  },
);

// T122 Echo copilot: consolidated per-user signals for the founder dashboard
// "What Echo would do" panel. Read-only. The frontend feeds these into
// playbook.ts decision helpers; this route just shapes the data.
router.get(
  "/founder/users/by-email/:email/echo-signals",
  requireFounder,
  async (req, res): Promise<void> => {
    const emailRaw = typeof req.params.email === "string" ? req.params.email.trim().toLowerCase() : "";
    if (!emailRaw || !emailRaw.includes("@")) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }
    const userRows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        tier: usersTable.tier,
        tierGrantedAt: usersTable.tierGrantedAt,
        createdAt: usersTable.createdAt,
        aiContentConsentGranted: usersTable.aiContentConsentGranted,
        invitedByUserId: usersTable.invitedByUserId,
        invitedAt: usersTable.invitedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.email, emailRaw))
      .limit(1);
    if (userRows.length === 0) {
      res.status(404).json({ error: `No user with email ${emailRaw}.` });
      return;
    }
    const user = userRows[0]!;

    const [auditAgg] = await db
      .select({
        total: count(),
        lastAt: sql<Date | null>`max(${auditsTable.createdAt})`,
      })
      .from(auditsTable)
      .where(eq(auditsTable.userId, user.id));
    const [wellnessAgg] = await db
      .select({ total: count() })
      .from(wellnessAnswersTable)
      .where(eq(wellnessAnswersTable.userId, user.id));
    const [lifePulseAgg] = await db
      .select({ total: count() })
      .from(lifePulsesTable)
      .where(eq(lifePulsesTable.userId, user.id));

    const tier = user.tier === "reset" || user.tier === "wingman" || user.tier === "free" ? user.tier : null;
    const createdAt = user.createdAt instanceof Date ? user.createdAt : null;
    const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const lastAuditAt = auditAgg?.lastAt instanceof Date ? auditAgg.lastAt.toISOString() : null;

    res.json({
      signals: {
        email: user.email ?? emailRaw,
        tier,
        createdAt: createdAt ? createdAt.toISOString() : null,
        ageDays,
        auditCount: Number(auditAgg?.total ?? 0),
        lastAuditAt,
        wellnessAnswerCount: Number(wellnessAgg?.total ?? 0),
        lifePulseCount: Number(lifePulseAgg?.total ?? 0),
        consentGranted: Boolean(user.aiContentConsentGranted),
        invitedByUserId: user.invitedByUserId ?? null,
        invitedAt: user.invitedAt instanceof Date ? user.invitedAt.toISOString() : null,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// Founder brain: control center + brain map + curation
// ---------------------------------------------------------------------------

function signalCatalog() {
  const defaults = normalizedWeights();
  return SIGNAL_REGISTRY.map((c) => ({
    id: c.id as string,
    label: c.label,
    defaultWeight: Number((defaults[c.id] ?? 0).toFixed(4)),
    confidence: c.confidence,
    dimensions: c.dimensions,
    describe: c.describe(100),
  }));
}

function serializeControls(controls: BrainControls, overridden: boolean) {
  return {
    controls,
    overridden,
    defaults: defaultControls(),
    effectiveBaseWeights: Object.fromEntries(
      Object.entries(effectiveBaseWeights(controls)).map(([k, v]) => [
        k,
        Number(v.toFixed(4)),
      ]),
    ),
    signalCatalog: signalCatalog(),
    connectorCatalog: CONNECTOR_CATALOG,
  };
}

router.get(
  "/founder/brain/controls",
  requireFounder,
  async (_req, res): Promise<void> => {
    const [controls, overridden] = await Promise.all([
      loadBrainControls(),
      brainControlsOverridden(),
    ]);
    res.json(serializeControls(controls, overridden));
  },
);

const BrainControlsPatch = z.object({
  readinessThreshold: z.number().int().min(0).max(100).optional(),
  matchingRadiusMiles: z.number().int().min(1).max(500).optional(),
  cohortMinSize: z.number().int().min(1).max(1000).optional(),
  anonDailyCap: z.number().int().min(0).max(10000).optional(),
  freeDailyCap: z.number().int().min(0).max(100000).optional(),
  reweightingMode: z.enum(["hold", "applied"]).optional(),
  signalWeightOverrides: z.record(z.string(), z.number().min(0)).nullable().optional(),
  connectorToggles: z.record(z.string(), z.boolean()).optional(),
});

router.put(
  "/founder/brain/controls",
  requireFounder,
  async (req, res): Promise<void> => {
    const parsed = BrainControlsPatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const controls = await saveBrainControls(parsed.data as Partial<BrainControls>);
    res.json(serializeControls(controls, true));
  },
);

router.post(
  "/founder/brain/controls/reset",
  requireFounder,
  async (_req, res): Promise<void> => {
    const controls = await resetBrainControls();
    res.json(serializeControls(controls, false));
  },
);

router.get(
  "/founder/brain/map",
  requireFounder,
  async (_req, res): Promise<void> => {
    const controls = await loadBrainControls();

    // Background jobs: same status computation as /founder/background-jobs.
    const jobRows = await db
      .select()
      .from(jobHeartbeatsTable)
      .orderBy(asc(jobHeartbeatsTable.jobName));
    const byName = new Map(
      jobRows.map((r) => [
        r.jobName,
        r.lastSuccessAt instanceof Date
          ? r.lastSuccessAt
          : new Date(r.lastSuccessAt as unknown as string),
      ]),
    );
    const allNames = new Set([
      ...KNOWN_JOB_NAMES,
      ...jobRows.map((r) => r.jobName),
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

    // Signal registry with effective weights and the founder's curation verdict.
    const base = effectiveBaseWeights(controls);
    const defaults = normalizedWeights();
    const curationRows = await db
      .select()
      .from(founderCurationTable)
      .where(eq(founderCurationTable.entityType, "signal"));
    const verdictById = new Map(
      curationRows.map((r) => [r.entityId, { verdict: r.verdict, note: r.note }]),
    );
    const signals = SIGNAL_REGISTRY.map((c) => {
      const id = c.id as string;
      const curated = verdictById.get(id) ?? null;
      return {
        id,
        label: c.label,
        defaultWeight: Number((defaults[id] ?? 0).toFixed(4)),
        effectiveWeight: Number((base[id] ?? 0).toFixed(4)),
        confidence: c.confidence,
        dimensions: c.dimensions,
        describe: c.describe(100),
        curation: curated,
      };
    });

    // Readiness aggregate across the most recent snapshot per user.
    const latestPerUser = db
      .select({
        userId: matchingReadinessSnapshotsTable.userId,
        latest: sql<string>`max(${matchingReadinessSnapshotsTable.day})`.as("latest"),
      })
      .from(matchingReadinessSnapshotsTable)
      .groupBy(matchingReadinessSnapshotsTable.userId)
      .as("latest_per_user");
    const readinessAgg = await db
      .select({
        users: sql<number>`count(*)::int`,
        avgScore: sql<number>`coalesce(avg(${matchingReadinessSnapshotsTable.score}), 0)`,
        eligible: sql<number>`count(*) filter (where ${matchingReadinessSnapshotsTable.score} >= ${controls.readinessThreshold})::int`,
      })
      .from(matchingReadinessSnapshotsTable)
      .innerJoin(
        latestPerUser,
        and(
          eq(matchingReadinessSnapshotsTable.userId, latestPerUser.userId),
          eq(matchingReadinessSnapshotsTable.day, latestPerUser.latest),
        ),
      );

    const poolAgg = await db
      .select({
        status: matchPoolMembershipTable.status,
        n: sql<number>`count(*)::int`,
      })
      .from(matchPoolMembershipTable)
      .groupBy(matchPoolMembershipTable.status);

    const proposalAgg = await db
      .select({
        status: matchProposalsTable.status,
        n: sql<number>`count(*)::int`,
      })
      .from(matchProposalsTable)
      .groupBy(matchProposalsTable.status);

    res.json({
      controls,
      jobs,
      signals,
      readiness: {
        scoredUsers: Number(readinessAgg[0]?.users ?? 0),
        averageScore: Math.round(Number(readinessAgg[0]?.avgScore ?? 0)),
        eligibleUsers: Number(readinessAgg[0]?.eligible ?? 0),
        threshold: controls.readinessThreshold,
      },
      pool: poolAgg.map((r) => ({ status: r.status, count: Number(r.n) })),
      proposals: proposalAgg.map((r) => ({ status: r.status, count: Number(r.n) })),
    });
  },
);

router.get(
  "/founder/brain/reweighting/:email",
  requireFounder,
  async (req, res): Promise<void> => {
    const email = String(req.params.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "Email required." });
      return;
    }
    const userRows = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`)
      .limit(1);
    const user = userRows[0];
    if (!user) {
      res.status(404).json({ error: "No user with that email." });
      return;
    }

    const controls = await loadBrainControls();
    const base = effectiveBaseWeights(controls);
    const [readiness, outcome] = await Promise.all([
      computeReadiness(user.id),
      computeOutcomeInsightForUser(user.id),
    ]);
    const adjustments = proposeWeightAdjustments(outcome, SIGNAL_REGISTRY, base);

    res.json({
      user: { id: user.id, email: user.email },
      mode: controls.reweightingMode,
      readinessScore: readiness.score,
      outcome: {
        totalDates: outcome.totalDates,
        anotherDate: outcome.anotherDate,
        noMore: outcome.noMore,
        ghosted: outcome.ghosted,
        unsure: outcome.unsure,
        headline: outcome.headline,
      },
      adjustments,
    });
  },
);

const CurationBody = z.object({
  entityType: z.enum(["match_proposal", "signal"]),
  entityId: z.string().min(1).max(200),
  verdict: z.enum(["good", "bad"]),
  note: z.string().max(2000).nullable().optional(),
});

router.post(
  "/founder/curation",
  requireFounder,
  async (req, res): Promise<void> => {
    const parsed = CurationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { entityType, entityId, verdict, note } = parsed.data;
    const now = new Date();
    const [row] = await db
      .insert(founderCurationTable)
      .values({ entityType, entityId, verdict, note: note ?? null, updatedAt: now })
      .onConflictDoUpdate({
        target: [founderCurationTable.entityType, founderCurationTable.entityId],
        set: { verdict, note: note ?? null, updatedAt: now },
      })
      .returning();
    res.json({ curation: row });
  },
);

router.get(
  "/founder/curation",
  requireFounder,
  async (req, res): Promise<void> => {
    const entityType =
      typeof req.query.entityType === "string" ? req.query.entityType : null;
    const rows = entityType
      ? await db
          .select()
          .from(founderCurationTable)
          .where(eq(founderCurationTable.entityType, entityType))
          .orderBy(desc(founderCurationTable.updatedAt))
      : await db
          .select()
          .from(founderCurationTable)
          .orderBy(desc(founderCurationTable.updatedAt));
    res.json({ curation: rows });
  },
);

export default router;
