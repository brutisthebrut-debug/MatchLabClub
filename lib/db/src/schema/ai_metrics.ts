import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  date,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const aiRequestMetricsTable = pgTable("ai_request_metrics", {
  id: serial("id").primaryKey(),
  toolName: text("tool_name").notNull(),
  mode: text("mode").notNull(),
  model: text("model"),
  attempts: integer("attempts").notNull().default(1),
  validated: boolean("validated"),
  isFallback: boolean("is_fallback").notNull().default(false),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiRequestMetric = typeof aiRequestMetricsTable.$inferSelect;
export type InsertAiRequestMetric = typeof aiRequestMetricsTable.$inferInsert;

export const aiRequestMetricsDailyTable = pgTable(
  "ai_request_metrics_daily",
  {
    id: serial("id").primaryKey(),
    day: date("day").notNull(),
    toolName: text("tool_name").notNull(),
    total: integer("total").notNull().default(0),
    firstTryOk: integer("first_try_ok").notNull().default(0),
    retriedOk: integer("retried_ok").notNull().default(0),
    fallbacks: integer("fallbacks").notNull().default(0),
    validationFailures: integer("validation_failures").notNull().default(0),
    avgAttempts: doublePrecision("avg_attempts").notNull().default(0),
    avgDurationMs: doublePrecision("avg_duration_ms").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_request_metrics_daily_day_tool_idx").on(t.day, t.toolName)],
);

export type AiRequestMetricDaily = typeof aiRequestMetricsDailyTable.$inferSelect;
export type InsertAiRequestMetricDaily = typeof aiRequestMetricsDailyTable.$inferInsert;
