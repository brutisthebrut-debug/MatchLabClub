import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  jobHeartbeatsTable,
  usersTable,
  AUDIT_TRASH_PURGE_JOB,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { purgeExpiredTrashedAudits } from "./auditTrashPurge";

// Track only the IDs seeded by THIS test file so cleanup never touches rows
// owned by concurrently-running test files (e.g. claim.test.ts).
const FOUNDER_USER = "founder-trash-purge-route-test";
const seededAuditIds: number[] = [];

const usedHeartbeatJobNames: string[] = [];

function uniqueHeartbeatJob(label: string): string {
  const name = `test-trash-purge-${label}-${crypto.randomBytes(6).toString("hex")}`;
  usedHeartbeatJobNames.push(name);
  return name;
}

async function clearAudits(): Promise<void> {
  if (seededAuditIds.length > 0) {
    await db
      .delete(auditsTable)
      .where(inArray(auditsTable.id, [...seededAuditIds]));
    seededAuditIds.length = 0;
  }
}

async function clearHeartbeat(): Promise<void> {
  const names = [...usedHeartbeatJobNames, AUDIT_TRASH_PURGE_JOB];
  await db
    .delete(jobHeartbeatsTable)
    .where(inArray(jobHeartbeatsTable.jobName, names));
  usedHeartbeatJobNames.length = 0;
}

interface SeedAuditOpts {
  deletedAt?: Date | null;
}

async function seedAudit(opts: SeedAuditOpts = {}): Promise<number> {
  const [{ id }] = await db
    .insert(auditsTable)
    .values({
      firstName: "Test",
      age: 28,
      gender: "m",
      orientation: "straight",
      datingGoal: "find a relationship",
      currentApps: ["Hinge"],
      bio: "Test bio",
      prompts: null,
      status: "complete",
      source: "manual",
      readinessScore: 70,
      userId: null,
      anonymousClaimToken: "test-token",
      deletedAt: opts.deletedAt ?? null,
    })
    .returning({ id: auditsTable.id });
  const numId = id as number;
  seededAuditIds.push(numId);
  return numId;
}

async function setDeletedAt(id: number, date: Date): Promise<void> {
  await db.execute(
    sql`update audits set deleted_at = ${date.toISOString()} where id = ${id}`,
  );
}

async function makePurgeApp(): Promise<Express> {
  const founderRouter = (await import("../routes/founder")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: FOUNDER_USER, email: null, firstName: null, lastName: null, profileImageUrl: null };
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", founderRouter);
  return app;
}

describe("purgeExpiredTrashedAudits", () => {
  beforeEach(async () => {
    await db.insert(usersTable).values({ id: FOUNDER_USER, role: "founder" }).onConflictDoNothing();
    await clearAudits();
    await clearHeartbeat();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await clearAudits();
    await clearHeartbeat();
  });

  afterAll(async () => {
    await clearAudits();
    await clearHeartbeat();
    await db.delete(usersTable).where(eq(usersTable.id, FOUNDER_USER));
    await pool.end();
  });

  it("hard-deletes audits whose deletedAt is older than the retention window", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const expiredId = await seedAudit();
    const freshId = await seedAudit();
    const activeId = await seedAudit();

    await setDeletedAt(
      expiredId,
      new Date("2026-04-18T12:00:00.000Z"),
    );
    await setDeletedAt(
      freshId,
      new Date("2026-05-15T12:00:00.000Z"),
    );

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(1);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable);
    const ids = remaining.map((r) => r.id);
    expect(ids).not.toContain(expiredId);
    expect(ids).toContain(freshId);
    expect(ids).toContain(activeId);
  });

  it("returns 0 and leaves rows intact when nothing is past the retention window", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const id1 = await seedAudit();
    const id2 = await seedAudit();
    await setDeletedAt(id1, new Date("2026-04-21T12:00:00.000Z"));
    await setDeletedAt(id2, new Date("2026-05-10T12:00:00.000Z"));

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(0);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable)
      .where(inArray(auditsTable.id, [id1, id2]));
    expect(remaining).toHaveLength(2);
  });

  it("never touches active (non-deleted) audits regardless of age", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const veryOldActiveId = await seedAudit({ deletedAt: null });

    await db.execute(
      sql`update audits set created_at = '2020-01-01T00:00:00.000Z' where id = ${veryOldActiveId}`,
    );

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(0);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable);
    expect(remaining.map((r) => r.id)).toContain(veryOldActiveId);
  });

  it("purges all expired rows in a single call (bulk idempotency)", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const ids = await Promise.all([
      seedAudit(),
      seedAudit(),
      seedAudit(),
    ]);

    for (const id of ids) {
      await setDeletedAt(id, new Date("2026-03-01T00:00:00.000Z"));
    }

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(3);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable)
      .where(isNotNull(auditsTable.deletedAt));
    expect(remaining).toHaveLength(0);
  });

  it("is idempotent: running twice does not error and second call returns 0", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const id = await seedAudit();
    await setDeletedAt(id, new Date("2026-04-01T00:00:00.000Z"));

    const first = await purgeExpiredTrashedAudits(30);
    expect(first).toBe(1);

    const second = await purgeExpiredTrashedAudits(30);
    expect(second).toBe(0);
  });

  it("respects a custom retention window (e.g. 7 days)", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const expiredId = await seedAudit();
    const survivingId = await seedAudit();

    await setDeletedAt(expiredId, new Date("2026-05-12T00:00:00.000Z"));
    await setDeletedAt(survivingId, new Date("2026-05-15T00:00:00.000Z"));

    const deleted = await purgeExpiredTrashedAudits(7);
    expect(deleted).toBe(1);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable);
    const ids = remaining.map((r) => r.id);
    expect(ids).not.toContain(expiredId);
    expect(ids).toContain(survivingId);
  });

  it("records a job heartbeat after a successful purge run", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const id = await seedAudit();
    await setDeletedAt(id, new Date("2026-04-01T00:00:00.000Z"));

    vi.useRealTimers();
    const jobName = uniqueHeartbeatJob("records");
    const before = Date.now();
    await purgeExpiredTrashedAudits(30, { jobName });
    const after = Date.now();

    const rows = await db
      .select()
      .from(jobHeartbeatsTable)
      .where(eq(jobHeartbeatsTable.jobName, jobName));
    expect(rows).toHaveLength(1);
    const ts =
      rows[0].lastSuccessAt instanceof Date
        ? rows[0].lastSuccessAt.getTime()
        : new Date(rows[0].lastSuccessAt as unknown as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(after + 5);
  });

  it("GET /api/founder/trash-purge-heartbeat reports fresh status after a successful purge", async () => {
    vi.useRealTimers();

    const id = await seedAudit();
    await setDeletedAt(id, new Date("2026-04-01T00:00:00.000Z"));

    await purgeExpiredTrashedAudits(30);

    const app = await makePurgeApp();
    const res = await request(app)
      .get("/api/founder/trash-purge-heartbeat")
      ;
    expect(res.status).toBe(200);
    expect(res.body.lastSuccessAt).toEqual(expect.any(String));
    expect(typeof res.body.ageMs).toBe("number");
    expect(res.body.ageMs).toBeLessThan(60_000);
    expect(res.body.stale).toBe(false);
    expect(typeof res.body.staleThresholdMs).toBe("number");
    expect(res.body.staleThresholdMs).toBeGreaterThan(0);
  });

  it("GET /api/founder/trash-purge-heartbeat reports stale=true when no heartbeat exists", async () => {
    vi.useRealTimers();

    const app = await makePurgeApp();
    const res = await request(app)
      .get("/api/founder/trash-purge-heartbeat")
      ;
    expect(res.status).toBe(200);
    expect(res.body.lastSuccessAt).toBeNull();
    expect(res.body.ageMs).toBeNull();
    expect(res.body.stale).toBe(true);
  });

  it("GET /api/founder/trash-purge-heartbeat reports stale=true when heartbeat is older than threshold", async () => {
    vi.useRealTimers();

    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db
      .insert(jobHeartbeatsTable)
      .values({ jobName: AUDIT_TRASH_PURGE_JOB, lastSuccessAt: old })
      .onConflictDoUpdate({
        target: jobHeartbeatsTable.jobName,
        set: { lastSuccessAt: old },
      });

    const app = await makePurgeApp();
    const res = await request(app)
      .get("/api/founder/trash-purge-heartbeat")
      ;
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.ageMs).toBeGreaterThan(36 * 60 * 60 * 1000);
  });

  it("handles an empty table without errors and returns 0", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(0);
  });

  it("keeps an audit deleted exactly at the cutoff boundary (strict less-than semantics)", async () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    vi.setSystemTime(now);

    const cutoff = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    const expiredId = await seedAudit();
    const borderlineId = await seedAudit();

    await setDeletedAt(
      expiredId,
      new Date(cutoff.getTime() - 1),
    );
    await setDeletedAt(borderlineId, cutoff);

    const deleted = await purgeExpiredTrashedAudits(30);
    expect(deleted).toBe(1);

    const remaining = await db
      .select({ id: auditsTable.id })
      .from(auditsTable);
    const ids = remaining.map((r) => r.id);
    expect(ids).not.toContain(expiredId);
    expect(ids).toContain(borderlineId);
  });
});
