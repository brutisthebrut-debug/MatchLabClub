import {
  pgTable,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Per-user bookkeeping for the matching nudge job. Tracks the last time we
 * sent a "you're close to matching, here's the next step" push so the job can
 * rate-limit itself and never spam. `lastSeenScore` lets us avoid nudging a
 * user who has not moved since the previous nudge.
 *
 * No foreign key on user_id, same rationale as the other matching tables; the
 * GDPR delete handler wipes these rows explicitly.
 */
export const matchingNudgeStateTable = pgTable("matching_nudge_state", {
  userId: varchar("user_id").primaryKey(),
  lastNudgedAt: timestamp("last_nudged_at", { withTimezone: true }),
  lastSeenScore: integer("last_seen_score"),
});

export type MatchingNudgeState = typeof matchingNudgeStateTable.$inferSelect;
