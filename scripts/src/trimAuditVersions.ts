/**
 * One-off backfill / cleanup script: trim audit_report_versions rows that
 * exceed the retention cap for each audit.
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm --filter @workspace/scripts run trim-audit-versions
 *
 * Optional env overrides:
 *   AUDIT_VERSION_MAX_COUNT   — max versions to keep per audit (default 25)
 *
 * The script is idempotent: running it multiple times is safe.
 */

import { eq, sql, and, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { auditReportVersionsTable } from "@workspace/db/schema";

const MAX_COUNT = (() => {
  const raw = process.env["AUDIT_VERSION_MAX_COUNT"];
  if (!raw) return 25;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 25;
})();

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function run(): Promise<void> {
  console.log(`Retention cap: ${MAX_COUNT} versions per audit`);

  const overLimitRows = await db
    .select({ auditId: auditReportVersionsTable.auditId })
    .from(auditReportVersionsTable)
    .groupBy(auditReportVersionsTable.auditId)
    .having(sql`count(*) > ${MAX_COUNT}`);

  if (overLimitRows.length === 0) {
    console.log("Nothing to trim — all audits are within the retention cap.");
    await pool.end();
    return;
  }

  console.log(
    `Found ${overLimitRows.length} audit(s) with more than ${MAX_COUNT} version(s). Trimming…`,
  );

  let totalDeleted = 0;
  for (const { auditId } of overLimitRows) {
    const keepIds = await db
      .select({ id: auditReportVersionsTable.id })
      .from(auditReportVersionsTable)
      .where(eq(auditReportVersionsTable.auditId, auditId))
      .orderBy(sql`${auditReportVersionsTable.generatedAt} DESC`)
      .limit(MAX_COUNT);

    const keepIdList = keepIds.map((r) => r.id);
    const deleted = await db
      .delete(auditReportVersionsTable)
      .where(
        and(
          eq(auditReportVersionsTable.auditId, auditId),
          notInArray(auditReportVersionsTable.id, keepIdList),
        ),
      )
      .returning({ id: auditReportVersionsTable.id });

    console.log(`  audit ${auditId}: deleted ${deleted.length} old version(s)`);
    totalDeleted += deleted.length;
  }

  console.log(
    `Done. Deleted ${totalDeleted} row(s) across ${overLimitRows.length} audit(s).`,
  );
  await pool.end();
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  pool.end().finally(() => process.exit(1));
});
