import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const jobHeartbeatsTable = pgTable("job_heartbeats", {
  jobName: text("job_name").primaryKey(),
  lastSuccessAt: timestamp("last_success_at").notNull().defaultNow(),
});

export type JobHeartbeat = typeof jobHeartbeatsTable.$inferSelect;
export type InsertJobHeartbeat = typeof jobHeartbeatsTable.$inferInsert;

export const AI_METRICS_ROLLUP_JOB = "ai_metrics_rollup";
export const AI_RELIABILITY_ALERTS_JOB = "ai_reliability_alerts";
export const AUDIT_TRASH_PURGE_JOB = "audit_trash_purge";
export const EXPORT_TOKEN_CLEANUP_JOB = "export_token_cleanup";
export const HANDOFF_REDEMPTION_CLEANUP_JOB = "handoff_redemption_cleanup";
export const OCR_LEARNING_JOB = "ocr_learning";
