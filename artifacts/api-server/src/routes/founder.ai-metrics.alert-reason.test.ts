import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, aiRequestMetricsTable, usersTable } from "@workspace/db";
import founderRouter, { buildAlertReason } from "./founder";

const FOUNDER_USER = "founder-alert-reason-route-test";
function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: FOUNDER_USER, email: null, firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  app.use("/api", founderRouter);
  return app;
}

const usedToolNames: string[] = [];

function uniqueTool(label: string): string {
  const name = `alert-reason-${label}-${crypto.randomBytes(6).toString("hex")}`;
  usedToolNames.push(name);
  return name;
}

interface Row {
  attempts: number;
  isFallback: boolean;
  validated: boolean;
}

async function seedRows(toolName: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(aiRequestMetricsTable).values(
    rows.map((r) => ({
      toolName,
      mode: "live",
      attempts: r.attempts,
      isFallback: r.isFallback,
      validated: r.validated,
      durationMs: 50,
    })),
  );
}

interface AlertRow {
  toolName: string;
  recentTotal: number;
  recentFirstTrySuccessRate: number;
  reason: string;
}

async function fetchAlertFor(app: Express, toolName: string): Promise<AlertRow> {
  const res = await request(app).get("/api/founder/ai-metrics");
  expect(res.status).toBe(200);
  const alerts = res.body.alerts as AlertRow[];
  const row = alerts.find((a) => a.toolName === toolName);
  expect(row, `expected alert for ${toolName}`).toBeTruthy();
  return row as AlertRow;
}

let app: Express;

beforeAll(async () => {
  await db.insert(usersTable).values({ id: FOUNDER_USER, role: "founder" }).onConflictDoNothing();
  app = makeTestApp();
});

afterEach(async () => {
  if (usedToolNames.length === 0) return;
  await db
    .delete(aiRequestMetricsTable)
    .where(inArray(aiRequestMetricsTable.toolName, usedToolNames));
  usedToolNames.length = 0;
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, FOUNDER_USER));
  await pool.end();
});

describe("GET /api/founder/ai-metrics alert reason selection", () => {
  it("reports fallback-dominant reason when fallbacks lead the recent window", async () => {
    const toolName = uniqueTool("fallback");
    // 10 rows: 7 fallbacks, 3 clean first-try OK.
    // first-try OK = 3/10 = 30% (below 70% threshold) → alert fires.
    // fallbacks (7) >= validationFailures (0) and >= retried (0) → fallback branch.
    const rows: Row[] = [
      ...Array.from({ length: 7 }, () => ({
        attempts: 1,
        isFallback: true,
        validated: true,
      })),
      ...Array.from({ length: 3 }, () => ({
        attempts: 1,
        isFallback: false,
        validated: true,
      })),
    ];
    await seedRows(toolName, rows);

    const alert = await fetchAlertFor(app, toolName);
    expect(alert.recentTotal).toBe(10);
    expect(alert.reason).toBe("70% of recent runs used the fallback (7/10)");
  });

  it("reports validation-dominant reason and exercises the validated SQL column", async () => {
    const toolName = uniqueTool("validation");
    // 10 rows, all non-fallback, all validated=false.
    // - 5 rows attempts=1 (first-try OK by the metric, but validation-failed)
    // - 5 rows attempts=2 (retried, validation-failed)
    // first-try OK = 5/10 = 50% → alert fires.
    // fallbacks=0 → fallback branch skipped.
    // validationFailures=10 >= retried=5 → validation branch.
    const rows: Row[] = [
      ...Array.from({ length: 5 }, () => ({
        attempts: 1,
        isFallback: false,
        validated: false,
      })),
      ...Array.from({ length: 5 }, () => ({
        attempts: 2,
        isFallback: false,
        validated: false,
      })),
    ];
    await seedRows(toolName, rows);

    const alert = await fetchAlertFor(app, toolName);
    expect(alert.recentTotal).toBe(10);
    expect(alert.reason).toBe("10 validation failures in last 10");
  });

  it("uses singular 'validation failure' when exactly one validation failure dominates", () => {
    // Reaching this branch through the route requires validationFailures===1
    // while still alerting (first-try success < 70%) and without retried or
    // fallbacks exceeding 1 — that combination is unsatisfiable with a
    // min-sample of 10. Cover the singular-vs-plural pluralization directly.
    const reason = buildAlertReason({
      recentTotal: 10,
      recentFallbacks: 0,
      recentValidationFailures: 1,
      recentRetried: 0,
      recentFirstTrySuccessRate: 0.9,
    });
    expect(reason).toBe("1 validation failure in last 10");
  });

  it("reports retry-dominant reason when retries lead the recent window", async () => {
    const toolName = uniqueTool("retry");
    // 10 rows: 7 retried (attempts=2, non-fallback, validated=true), 3 first-try OK.
    // first-try OK = 3/10 = 30% → alert fires.
    // fallbacks=0, validationFailures=0, retried=7 → retry branch.
    const rows: Row[] = [
      ...Array.from({ length: 7 }, () => ({
        attempts: 2,
        isFallback: false,
        validated: true,
      })),
      ...Array.from({ length: 3 }, () => ({
        attempts: 1,
        isFallback: false,
        validated: true,
      })),
    ];
    await seedRows(toolName, rows);

    const alert = await fetchAlertFor(app, toolName);
    expect(alert.recentTotal).toBe(10);
    expect(alert.reason).toBe("7 of last 10 needed a retry");
  });

  it("falls back to the first-try-success summary string when no failure mode is present", () => {
    // This branch is unreachable through the alert flow (an alert with zero
    // fallbacks, zero validation failures, and zero retries implies a 100%
    // first-try success rate, which cannot drop below the 70% threshold).
    // Cover it with a direct unit call so silent regressions to the fallback
    // string are still caught.
    const reason = buildAlertReason({
      recentTotal: 25,
      recentFallbacks: 0,
      recentValidationFailures: 0,
      recentRetried: 0,
      recentFirstTrySuccessRate: 0.32,
    });
    expect(reason).toBe("First-try success 32% over last 25");
  });
});
