import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Append-only history for the member-governed Mirror learning lifecycle. */
export const mirrorLearningEventsTable = pgTable(
  "mirror_learning_events",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    learningId: integer("learning_id"),
    action: varchar("action", { length: 32 }).notNull(),
    sourceType: varchar("source_type").notNull(),
    sourceRef: varchar("source_ref").notNull(),
    sourceLabel: varchar("source_label").notNull(),
    priorStatus: varchar("prior_status"),
    newStatus: varchar("new_status"),
    priorText: text("prior_text"),
    newText: text("new_text"),
    confidence: integer("confidence").notNull(),
    matchingUseApproved: boolean("matching_use_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mirror_learning_events_user_created_idx").on(t.userId, t.createdAt),
    index("mirror_learning_events_learning_idx").on(t.learningId),
  ],
);

export type MirrorLearningEventRow = typeof mirrorLearningEventsTable.$inferSelect;
