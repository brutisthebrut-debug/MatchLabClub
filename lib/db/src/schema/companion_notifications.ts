import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Echo's in-app notification feed: the proactive things it surfaces without
 * being asked (readiness moved, a match is waiting, you went quiet, a
 * commitment is due). Each row optionally carries a CTA into the real tool.
 * `source` distinguishes proactive nudges from commitment follow-ups and
 * system notes. `readAt` powers the unread bell count.
 *
 * No foreign key on user_id; the GDPR delete handler wipes these rows.
 */
export const companionNotificationsTable = pgTable(
  "companion_notifications",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    source: varchar("source").notNull().default("proactive"),
    kind: varchar("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ctaHref: varchar("cta_href"),
    ctaLabel: varchar("cta_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("companion_notifications_user_idx").on(t.userId, t.createdAt)],
);

export type CompanionNotification =
  typeof companionNotificationsTable.$inferSelect;
