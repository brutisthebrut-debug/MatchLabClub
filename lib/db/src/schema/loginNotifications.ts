import { pgTable, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const loginNotificationsTable = pgTable(
  "login_notifications",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_login_notifications_user_fp").on(
      table.userId,
      table.fingerprint,
    ),
  ],
);

export type LoginNotification = typeof loginNotificationsTable.$inferSelect;
