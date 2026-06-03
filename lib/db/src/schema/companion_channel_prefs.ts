import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-user channel preferences for how Echo is allowed to reach the user
 * off-screen. In-app is always available; email is on by default (it already
 * has delivery infrastructure); SMS is off until the user explicitly opts in
 * and provides a phone number, and we record `smsConsentAt` for compliance.
 * One row per user, keyed by userId (onConflictDoUpdate), a single lookup path.
 *
 * No foreign key on user_id; the GDPR delete handler wipes these rows.
 */
export const companionChannelPrefsTable = pgTable("companion_channel_prefs", {
  userId: varchar("user_id").primaryKey(),
  inApp: boolean("in_app").notNull().default(true),
  email: boolean("email").notNull().default(true),
  sms: boolean("sms").notNull().default(false),
  phone: varchar("phone"),
  smsConsentAt: timestamp("sms_consent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CompanionChannelPrefs =
  typeof companionChannelPrefsTable.$inferSelect;
