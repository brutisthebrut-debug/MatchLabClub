import { pgTable, varchar, integer, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

// NOTE: user_id intentionally has NO foreign key to users.id. This lets us
// bucket anonymous traffic under a sentinel value ("__anon__") without
// hitting a FK violation. The trade-off is that user deletions do not
// auto-cascade to this table; the GDPR delete handler in
// artifacts/api-server/src/routes/account.ts explicitly deletes these
// rows in its transaction.
export const aiUsageCountersTable = pgTable(
  "ai_usage_counters",
  {
    userId: varchar("user_id").notNull(),
    date: varchar("date").notNull(),
    provider: varchar("provider").notNull(),
    callCount: integer("call_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.date, table.provider] }),
    index("IDX_ai_usage_counters_user_date").on(table.userId, table.date),
  ],
);

export type AiUsageCounter = typeof aiUsageCountersTable.$inferSelect;
export type NewAiUsageCounter = typeof aiUsageCountersTable.$inferInsert;
