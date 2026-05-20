import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { and, isNotNull, sql } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  jobHeartbeatsTable,
  AUDIT_TRASH_PURGE_JOB,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { purgeExpiredTrashedAudits } from "./auditTrashPurge";

async function clearAudits(): Promise<void> {
  await db.execute(sql`delete from audits`);
}

async function clearHeartbeat(): Promise<void> {
  await db
    .delete(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, AUDIT_TRASH_PURGE_JOB));
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
  return id as number;
}

async function setDeletedAt(id: number, date: Date): Promise<void> {
  await db.execute(
    sql`update audits set deleted_at = ${date.toISOString()} where id = ${id}`,
  );
}

describe("purgeExpiredTrashedAudits", () => {
  beforeEach(async () => {
    await clearAudits();
    await clearHeartbeat();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await clearAudits();
    await clearHeartbeat();
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
      .from(auditsTable);
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
    const before = Date.now();
    await purgeExpiredTrashedAudits(30);
    const after = Date.now();

    const rows = await db
      .select()
      .from(jobHeartbeatsTable)
      .where(eq(jobHeartbeatsTable.jobName, AUDIT_TRASH_PURGE_JOB));
    expect(rows).toHaveLength(1);
    const ts =
      rows[0].lastSuccessAt instanceof Date
        ? rows[0].lastSuccessAt.getTime()
        : new Date(rows[0].lastSuccessAt as unknown as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(after + 5);
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
