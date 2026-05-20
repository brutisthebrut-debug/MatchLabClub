import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const jobHeartbeatsTable = pgTable("job_heartbeats", {
  jobName: text("job_name").primaryKey(),
  lastSuccessAt: timestamp("last_success_at").notNull().defaultNow(),
});

export type JobHeartbeat = typeof jobHeartbeatsTable.$inferSelect;
export type InsertJobHeartbeat = typeof jobHeartbeatsTable.$inferInsert;

export const AI_METRICS_ROLLUP_JOB = "ai_metrics_rollup";
