import { pgTable, serial, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const referralsTable = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    inviterUserId: varchar("inviter_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "set null" }),
    inviteeUserId: varchar("invitee_user_id")
      .references(() => usersTable.id, { onDelete: "cascade" }),
    refCode: varchar("ref_code").notNull(),
    surface: varchar("surface"),
    landedAt: timestamp("landed_at", { withTimezone: true }).notNull().defaultNow(),
    signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  },
  (t) => [
    index("referrals_inviter_idx").on(t.inviterUserId),
    index("referrals_invitee_idx").on(t.inviteeUserId),
  ],
);

export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;
