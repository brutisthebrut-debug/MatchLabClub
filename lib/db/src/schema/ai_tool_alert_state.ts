import { pgTable, text, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";

export const aiToolAlertStateTable = pgTable("ai_tool_alert_state", {
  toolName: text("tool_name").primaryKey(),
  breached: boolean("breached").notNull().default(false),
  firstBreachedAt: timestamp("first_breached_at", { withTimezone: true }),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  lastClearedAt: timestamp("last_cleared_at", { withTimezone: true }),
  lastRecentTotal: integer("last_recent_total").notNull().default(0),
  lastRecentFirstTrySuccessRate: real("last_recent_first_try_success_rate")
    .notNull()
    .default(0),
  consecutiveSendFailures: integer("consecutive_send_failures")
    .notNull()
    .default(0),
  lastSendFailureAt: timestamp("last_send_failure_at", { withTimezone: true }),
  lastSendFailureMessage: text("last_send_failure_message"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AiToolAlertState = typeof aiToolAlertStateTable.$inferSelect;
export type InsertAiToolAlertState = typeof aiToolAlertStateTable.$inferInsert;
