/**
 * One-off / cron script: hard-delete soft-deleted audits past the retention window.
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm --filter @workspace/scripts run purge-expired-trash
 *
 * Optional env overrides:
 *   AUDIT_TRASH_RETENTION_DAYS  — days before a trashed audit is permanently
 *                                 deleted (default 30)
 *
 * The script is idempotent: running it multiple times is safe.
 */

import { and, isNotNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { auditsTable } from "@workspace/db/schema";

const RETENTION_DAYS = (() => {
  const raw = process.env["AUDIT_TRASH_RETENTION_DAYS"];
  if (!raw) return 30;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function run(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(
    `Purging soft-deleted audits older than ${RETENTION_DAYS} day(s) (before ${cutoff.toISOString()})…`,
  );

  const result = await db
    .delete(auditsTable)
    .where(
      and(
        isNotNull(auditsTable.deletedAt),
        lt(auditsTable.deletedAt, cutoff),
      ),
    )
    .returning({ id: auditsTable.id });

  if (result.length === 0) {
    console.log("Nothing to purge — no soft-deleted audits past the retention window.");
  } else {
    console.log(`Done. Permanently deleted ${result.length} audit(s).`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  pool.end().finally(() => process.exit(1));
});
