import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Things the user told Echo they would do ("I'll message her back tonight").
 * Echo tracks these so it can follow up and hold the person to their word,
 * which is core to being a real friend rather than a yes machine. `status` is
 * "open", "done", or "missed". Echo derives "missed" when a dueAt passes with
 * no completion.
 *
 * No foreign key on user_id; the GDPR delete handler wipes these rows.
 */
export const companionCommitmentsTable = pgTable(
  "companion_commitments",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    body: text("body").notNull(),
    status: varchar("status").notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("companion_commitments_user_idx").on(t.userId, t.status)],
);

export type CompanionCommitment = typeof companionCommitmentsTable.$inferSelect;
