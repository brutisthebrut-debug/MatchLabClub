import {
  pgTable,
  serial,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Trust & Safety records. Neither table is a readiness signal: reporting or
// blocking someone must never move Match Readiness, so these are intentionally
// NOT in SIGNAL_REGISTRY and have no trust-ledger purge handler. They are still
// user-scoped first-party data, so account deletion wipes them explicitly (see
// the GDPR delete handler in artifacts/api-server/src/routes/account.ts). As
// with the matching tables, user_id has NO foreign key to users.id.

// The shared, closed set of reasons a member can pick when reporting or
// blocking someone. Kept deliberately short and plain so the picker is fast and
// the founder review list reads clearly.
export const SAFETY_REASONS = [
  "fake_profile",
  "harassment",
  "inappropriate",
  "scam",
  "underage",
  "safety",
  "other",
] as const;

export type SafetyReason = (typeof SAFETY_REASONS)[number];

// Where in the product the action was taken, so the founder can see context.
export const SAFETY_CONTEXTS = ["match", "conversation", "profile"] as const;

export const REPORT_STATUSES = ["open", "reviewed", "dismissed"] as const;

export const userReportsTable = pgTable(
  "user_reports",
  {
    id: serial("id").primaryKey(),
    reporterUserId: varchar("reporter_user_id").notNull(),
    reportedUserId: varchar("reported_user_id").notNull(),
    reason: varchar("reason").notNull(),
    context: varchar("context"),
    note: varchar("note", { length: 1000 }),
    status: varchar("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    index("user_reports_reported_idx").on(t.reportedUserId),
    index("user_reports_reporter_idx").on(t.reporterUserId),
    index("user_reports_status_created_idx").on(t.status, t.createdAt.desc()),
  ],
);

export const userBlocksTable = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerUserId: varchar("blocker_user_id").notNull(),
    blockedUserId: varchar("blocked_user_id").notNull(),
    reason: varchar("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One block row per ordered (blocker -> blocked) pair so re-blocking is
    // idempotent (ON CONFLICT DO NOTHING). Enforcement is symmetric in the
    // matching engine regardless of which direction the row was created.
    uniqueIndex("user_blocks_pair_uidx").on(t.blockerUserId, t.blockedUserId),
    index("user_blocks_blocked_idx").on(t.blockedUserId),
  ],
);

export const insertUserReportSchema = createInsertSchema(userReportsTable, {
  reason: z.enum(SAFETY_REASONS),
  context: z.enum(SAFETY_CONTEXTS).nullish(),
  note: z.string().trim().max(1000).nullish(),
}).omit({
  id: true,
  reporterUserId: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertUserBlockSchema = createInsertSchema(userBlocksTable, {
  reason: z.enum(SAFETY_REASONS).nullish(),
}).omit({
  id: true,
  blockerUserId: true,
  createdAt: true,
});

export type UserReport = typeof userReportsTable.$inferSelect;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;
export type UserBlock = typeof userBlocksTable.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
