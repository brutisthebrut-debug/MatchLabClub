import { pgTable, serial, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
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
    // Each invitee has exactly one inviter (first-touch, set once on
    // users.invited_by_user_id), so a referral row is unique per invitee. This
    // unique index is what makes the upsert dedupe authoritative: concurrent
    // sign-in upserts both try to insert, and onConflictDoNothing collapses to
    // a single row instead of duplicating founder-side attribution counts.
    // Postgres treats NULLs as distinct in a unique index, so future
    // anonymous-landing rows with a null invitee are unaffected.
    uniqueIndex("referrals_invitee_unique_idx").on(t.inviteeUserId),
  ],
);

export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;
