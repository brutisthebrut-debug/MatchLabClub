import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Daily snapshots of a user's matching readiness so the product can show
 * momentum over time (a trend line, "up 12 points this week") instead of a
 * single point-in-time number. Readiness itself is still computed on demand
 * from the underlying signal tables; this table only records the result once
 * per day (upsert on userId+day) when the user loads their matching state.
 *
 * `breakdown` stores the per-source map at snapshot time for richer history
 * views later. No foreign key on user_id, same rationale as the other
 * matching tables; the GDPR delete handler wipes these rows explicitly.
 */
export const matchingReadinessSnapshotsTable = pgTable(
  "matching_readiness_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** Calendar day of the snapshot (UTC). One row per user per day. */
    day: date("day").notNull(),
    score: integer("score").notNull(),
    breakdown: jsonb("breakdown"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("matching_readiness_snapshots_user_day_idx").on(
      t.userId,
      t.day,
    ),
  ],
);

export type MatchingReadinessSnapshot =
  typeof matchingReadinessSnapshotsTable.$inferSelect;
