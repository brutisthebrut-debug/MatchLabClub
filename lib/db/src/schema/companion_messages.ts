import {
  pgTable,
  serial,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * The persistent Echo conversation thread for a user. Echo lives across pages
 * and sessions, so its dialogue is stored rather than held in component state.
 * `role` is "user" or "echo". `grounding` records the real signals an Echo
 * reply leaned on (derived labels only) so the conversation stays auditable.
 *
 * No foreign key on user_id; the GDPR delete handler wipes these rows.
 */
export const companionMessagesTable = pgTable(
  "companion_messages",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    role: varchar("role").notNull(),
    content: text("content").notNull(),
    grounding: jsonb("grounding"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("companion_messages_user_idx").on(t.userId, t.createdAt)],
);

export type CompanionMessage = typeof companionMessagesTable.$inferSelect;
