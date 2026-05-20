import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const handoffTokenRedemptionsTable = pgTable(
  "handoff_token_redemptions",
  {
    jti: varchar("jti").primaryKey(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("IDX_handoff_token_redemptions_expires_at").on(table.expiresAt),
  ],
);

export type HandoffTokenRedemption =
  typeof handoffTokenRedemptionsTable.$inferSelect;
