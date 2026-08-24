import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * The durable boundary between what Echo observes and what a member accepts as
 * true. A proposal may be confirmed, corrected back into review, or dismissed.
 * Matching use is an independent, reversible grant and is never inferred from
 * confirmation.
 */
export const mirrorLearningsTable = pgTable(
  "mirror_learnings",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    sourceType: varchar("source_type").notNull(),
    sourceRef: varchar("source_ref").notNull(),
    sourceLabel: varchar("source_label").notNull(),
    observation: text("observation").notNull(),
    proposedLearning: text("proposed_learning").notNull(),
    memberLearning: text("member_learning"),
    // proposed | confirmed | dismissed
    status: varchar("status").notNull().default("proposed"),
    confidence: integer("confidence").notNull(),
    matchingUseApproved: boolean("matching_use_approved")
      .notNull()
      .default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("mirror_learnings_user_source_uidx").on(
      t.userId,
      t.sourceType,
      t.sourceRef,
    ),
    index("mirror_learnings_user_status_idx").on(t.userId, t.status),
  ],
);

export type MirrorLearningRow = typeof mirrorLearningsTable.$inferSelect;

