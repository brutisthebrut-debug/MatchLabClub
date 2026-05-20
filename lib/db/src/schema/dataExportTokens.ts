import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const dataExportTokensTable = pgTable(
  "data_export_tokens",
  {
    token: varchar("token").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [index("IDX_data_export_tokens_user").on(table.userId)],
);

export type DataExportToken = typeof dataExportTokensTable.$inferSelect;
