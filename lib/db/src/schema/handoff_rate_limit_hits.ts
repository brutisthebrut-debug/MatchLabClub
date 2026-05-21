import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const handoffRateLimitHitsTable = pgTable(
  "handoff_rate_limit_hits",
  {
    id: varchar("id").primaryKey(),
    key: varchar("key").notNull(),
    hitAt: timestamp("hit_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("IDX_handoff_rate_limit_hits_key").on(table.key),
    index("IDX_handoff_rate_limit_hits_expires_at").on(table.expiresAt),
  ],
);

export type HandoffRateLimitHit =
  typeof handoffRateLimitHitsTable.$inferSelect;
