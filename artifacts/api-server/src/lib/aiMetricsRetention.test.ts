import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import {
  db,
  pool,
  aiRequestMetricsTable,
  aiRequestMetricsDailyTable,
  jobHeartbeatsTable,
  AI_METRICS_ROLLUP_JOB,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  rollupAiMetricsForDay,
  rollupOldAiMetrics,
  rollupThenPruneAiMetrics,
  pruneOldAiMetrics,
} from "./aiMetricsRetention";

interface SeedRow {
  toolName: string;
  attempts: number;
  isFallback?: boolean;
  validated?: boolean | null;
  durationMs?: number;
  createdAt: Date;
  mode?: string;
}

async function seedRaw(rows: SeedRow[]): Promise<void> {
  for (const r of rows) {
    await db.insert(aiRequestMetricsTable).values({
      toolName: r.toolName,
      mode: r.mode ?? "structured",
      attempts: r.attempts,
      validated: r.validated ?? true,
      isFallback: r.isFallback ?? false,
      durationMs: r.durationMs ?? 100,
      createdAt: r.createdAt,
    });
  }
}

function dayOffsetUTC(daysAgo: number, hour = 12): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function dayString(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function clearMetrics(): Promise<void> {
  await db.execute(sql`truncate table ai_request_metrics restart identity`);
  await db.execute(sql`truncate table ai_request_metrics_daily restart identity`);
  await db.delete(jobHeartbeatsTable).where(eq(jobHeartbeatsTable.jobName, AI_METRICS_ROLLUP_JOB));
}

async function makeTrendsApp(): Promise<Express> {
  const founderRouter = (await import("../routes/founder")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", founderRouter);
  return app;
}

describe("rollupThenPruneAiMetrics", () => {
  beforeEach(async () => {
    await clearMetrics();
  });

  afterAll(async () => {
    await clearMetrics();
    await pool.end();
  });

  it("aggregates raw rows into one row per (day, tool) with correct totals", async () => {
    await seedRaw([
      // Day -3, audit_engine: 3 first-try OK, 1 retried OK, 1 fallback, 1 validation fail
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(3, 1), durationMs: 100 },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(3, 2), durationMs: 200 },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(3, 3), durationMs: 300 },
      { toolName: "audit_engine", attempts: 2, createdAt: dayOffsetUTC(3, 4), durationMs: 400 },
      { toolName: "audit_engine", attempts: 3, isFallback: true, createdAt: dayOffsetUTC(3, 5), durationMs: 500 },
      { toolName: "audit_engine", attempts: 1, validated: false, createdAt: dayOffsetUTC(3, 6), durationMs: 600 },
      // Day -3, message_coach: 2 first-try OK
      { toolName: "message_coach", attempts: 1, createdAt: dayOffsetUTC(3, 7), durationMs: 50 },
      { toolName: "message_coach", attempts: 1, createdAt: dayOffsetUTC(3, 8), durationMs: 150 },
      // Day -2, audit_engine: 1 first-try OK
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 5), durationMs: 100 },
    ]);

    const written = await rollupOldAiMetrics();
    expect(written).toBeGreaterThanOrEqual(3);

    const rows = await db
      .select()
      .from(aiRequestMetricsDailyTable);

    const findRow = (day: string, tool: string) =>
      rows.find((r) => String(r.day).slice(0, 10) === day && r.toolName === tool);

    const auditDay3 = findRow(dayString(3), "audit_engine");
    expect(auditDay3).toBeDefined();
    expect(auditDay3!.total).toBe(6);
    // first_try_ok counts attempts=1 and is_fallback=false regardless of validated
    expect(auditDay3!.firstTryOk).toBe(4);
    expect(auditDay3!.retriedOk).toBe(1);
    expect(auditDay3!.fallbacks).toBe(1);
    expect(auditDay3!.validationFailures).toBe(1);
    expect(auditDay3!.avgAttempts).toBeCloseTo((1 + 1 + 1 + 2 + 3 + 1) / 6, 5);
    expect(auditDay3!.avgDurationMs).toBeCloseTo(
      (100 + 200 + 300 + 400 + 500 + 600) / 6,
      5,
    );

    const coachDay3 = findRow(dayString(3), "message_coach");
    expect(coachDay3).toBeDefined();
    expect(coachDay3!.total).toBe(2);
    expect(coachDay3!.firstTryOk).toBe(2);
    expect(coachDay3!.fallbacks).toBe(0);

    const auditDay2 = findRow(dayString(2), "audit_engine");
    expect(auditDay2).toBeDefined();
    expect(auditDay2!.total).toBe(1);
    expect(auditDay2!.firstTryOk).toBe(1);

    // Only one rollup per (day, tool)
    const key = (r: { day: unknown; toolName: string }) =>
      `${String(r.day).slice(0, 10)}|${r.toolName}`;
    const keys = rows.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is idempotent: rerunning overwrites without creating duplicates", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 1) },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 2) },
    ]);
    await rollupOldAiMetrics();
    const first = await db.select().from(aiRequestMetricsDailyTable);
    expect(first).toHaveLength(1);
    expect(first[0].total).toBe(2);

    // Add another row for the same day and rerun
    await seedRaw([
      { toolName: "audit_engine", attempts: 2, createdAt: dayOffsetUTC(2, 3) },
    ]);
    await rollupOldAiMetrics();
    const second = await db.select().from(aiRequestMetricsDailyTable);
    expect(second).toHaveLength(1);
    expect(second[0].total).toBe(3);
    expect(second[0].retriedOk).toBe(1);
    // ID stable — on conflict updates the existing row
    expect(second[0].id).toBe(first[0].id);
  });

  it("prunes raw rows older than retention window but keeps the rollup", async () => {
    // Day -40 is well past a 30-day retention window
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(40, 1) },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(40, 2) },
      // recent row — should survive
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(1, 1) },
    ]);

    await rollupOldAiMetrics();
    const pruned = await pruneOldAiMetrics(30);
    expect(pruned).toBe(2);

    const remainingRaw = await db.select().from(aiRequestMetricsTable);
    expect(remainingRaw).toHaveLength(1);

    const rollups = await db.select().from(aiRequestMetricsDailyTable);
    const oldDay = rollups.find((r) => String(r.day).slice(0, 10) === dayString(40));
    expect(oldDay).toBeDefined();
    expect(oldDay!.total).toBe(2);
  });

  it("rollupThenPruneAiMetrics returns expected counts and skips prune-on-failure semantics", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(40, 1) },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 1) },
    ]);
    const result = await rollupThenPruneAiMetrics();
    expect(result.skippedPrune).toBe(false);
    expect(result.rolledUp).toBeGreaterThanOrEqual(2);
    expect(result.pruned).toBe(1);
  });

  it("buckets rows by UTC day even when their local-time day differs", async () => {
    // 2026-05-15 23:30 UTC: in any timezone east of UTC (e.g. Asia/Tokyo,
    // UTC+9 → 2026-05-16 08:30 local) this instant's local-time day is the
    // *next* calendar day. The rollup must still attribute it to UTC day
    // 2026-05-15.
    const lateUtc = new Date("2026-05-15T23:30:00.000Z");
    // 2026-05-16 00:30 UTC: in any timezone west of UTC (e.g. America/New_York,
    // UTC-4 → 2026-05-15 20:30 local) the local-time day is the *previous*
    // calendar day. The rollup must still attribute it to UTC day 2026-05-16.
    const earlyUtc = new Date("2026-05-16T00:30:00.000Z");
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: lateUtc, durationMs: 100 },
      { toolName: "audit_engine", attempts: 1, createdAt: earlyUtc, durationMs: 200 },
    ]);

    const written15 = await rollupAiMetricsForDay(new Date("2026-05-15T00:00:00.000Z"));
    const written16 = await rollupAiMetricsForDay(new Date("2026-05-16T00:00:00.000Z"));
    expect(written15).toBe(1);
    expect(written16).toBe(1);

    const rows = await db.select().from(aiRequestMetricsDailyTable);
    const day15 = rows.find((r) => String(r.day).slice(0, 10) === "2026-05-15");
    const day16 = rows.find((r) => String(r.day).slice(0, 10) === "2026-05-16");
    expect(day15).toBeDefined();
    expect(day16).toBeDefined();
    expect(day15!.total).toBe(1);
    expect(day16!.total).toBe(1);

    // Sanity check: neighbouring UTC days don't pick up the other row.
    const written14 = await rollupAiMetricsForDay(new Date("2026-05-14T00:00:00.000Z"));
    const written17 = await rollupAiMetricsForDay(new Date("2026-05-17T00:00:00.000Z"));
    expect(written14).toBe(0);
    expect(written17).toBe(0);
  });

  it("rolls up an empty day to zero rows without errors", async () => {
    const written = await rollupAiMetricsForDay(dayOffsetUTC(5));
    expect(written).toBe(0);
    const rows = await db.select().from(aiRequestMetricsDailyTable);
    expect(rows).toHaveLength(0);
  });

  it("GET /api/founder/ai-metrics/trends returns the rolled-up series", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(3, 1), durationMs: 100 },
      { toolName: "audit_engine", attempts: 2, createdAt: dayOffsetUTC(3, 2), durationMs: 200 },
      { toolName: "audit_engine", attempts: 3, isFallback: true, createdAt: dayOffsetUTC(3, 3), durationMs: 300 },
      { toolName: "message_coach", attempts: 1, createdAt: dayOffsetUTC(2, 1), durationMs: 50 },
    ]);
    await rollupThenPruneAiMetrics();

    const app = await makeTrendsApp();
    const res = await request(app).get("/api/founder/ai-metrics/trends?days=30");
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
    expect(Array.isArray(res.body.series)).toBe(true);

    const audit = res.body.series.find(
      (s: { day: string; toolName: string }) =>
        s.day === dayString(3) && s.toolName === "audit_engine",
    );
    expect(audit).toBeDefined();
    expect(audit.total).toBe(3);
    expect(audit.firstTryOk).toBe(1);
    expect(audit.retriedOk).toBe(1);
    expect(audit.fallbacks).toBe(1);
    expect(audit.firstTrySuccessRate).toBeCloseTo(1 / 3, 5);
    expect(audit.overallSuccessRate).toBeCloseTo(2 / 3, 5);
    expect(audit.fallbackRate).toBeCloseTo(1 / 3, 5);
    expect(audit.avgAttempts).toBeCloseTo(2, 5);

    const coach = res.body.series.find(
      (s: { day: string; toolName: string }) =>
        s.day === dayString(2) && s.toolName === "message_coach",
    );
    expect(coach).toBeDefined();
    expect(coach.total).toBe(1);
    expect(coach.firstTryOk).toBe(1);

    // Series is ordered by day asc, then toolName asc
    const days = res.body.series.map((s: { day: string }) => s.day);
    const sorted = [...days].sort();
    expect(days).toEqual(sorted);
  });

  it("rollupThenPruneAiMetrics records a heartbeat row on success", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 1) },
    ]);
    const before = Date.now();
    await rollupThenPruneAiMetrics();
    const rows = await db
      .select()
      .from(jobHeartbeatsTable)
      .where(eq(jobHeartbeatsTable.jobName, AI_METRICS_ROLLUP_JOB));
    expect(rows).toHaveLength(1);
    const ts = rows[0].lastSuccessAt instanceof Date
      ? rows[0].lastSuccessAt.getTime()
      : new Date(rows[0].lastSuccessAt as unknown as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(Date.now() + 5);
  });

  it("GET /api/founder/rollup-heartbeat reports fresh status after a successful rollup", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 1) },
    ]);
    await rollupThenPruneAiMetrics();

    const app = await makeTrendsApp();
    const res = await request(app).get("/api/founder/rollup-heartbeat");
    expect(res.status).toBe(200);
    expect(res.body.lastSuccessAt).toEqual(expect.any(String));
    expect(typeof res.body.ageMs).toBe("number");
    expect(res.body.ageMs).toBeLessThan(60_000);
    expect(res.body.stale).toBe(false);
    expect(typeof res.body.staleThresholdMs).toBe("number");
    expect(res.body.staleThresholdMs).toBeGreaterThan(0);
  });

  it("GET /api/founder/rollup-heartbeat reports stale=true when no heartbeat exists", async () => {
    const app = await makeTrendsApp();
    const res = await request(app).get("/api/founder/rollup-heartbeat");
    expect(res.status).toBe(200);
    expect(res.body.lastSuccessAt).toBeNull();
    expect(res.body.ageMs).toBeNull();
    expect(res.body.stale).toBe(true);
  });

  it("GET /api/founder/rollup-heartbeat reports stale=true when heartbeat is older than the threshold", async () => {
    // Insert an old heartbeat (2 days ago) — older than the 36-hour default.
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db
      .insert(jobHeartbeatsTable)
      .values({ jobName: AI_METRICS_ROLLUP_JOB, lastSuccessAt: old })
      .onConflictDoUpdate({
        target: jobHeartbeatsTable.jobName,
        set: { lastSuccessAt: old },
      });

    const app = await makeTrendsApp();
    const res = await request(app).get("/api/founder/rollup-heartbeat");
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.ageMs).toBeGreaterThan(36 * 60 * 60 * 1000);
  });

  it("GET /api/founder/ai-metrics/trends honors the days query param window", async () => {
    await seedRaw([
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(60, 1) },
      { toolName: "audit_engine", attempts: 1, createdAt: dayOffsetUTC(2, 1) },
    ]);
    await rollupOldAiMetrics();

    const app = await makeTrendsApp();
    const res = await request(app).get("/api/founder/ai-metrics/trends?days=7");
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    // Only the recent day should appear within a 7-day window
    const days = new Set(res.body.series.map((s: { day: string }) => s.day));
    expect(days.has(dayString(2))).toBe(true);
    expect(days.has(dayString(60))).toBe(false);
  });
});
