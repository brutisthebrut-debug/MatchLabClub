import { pgTable, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const FOUNDER_SETTINGS_REBREACH_COOLDOWN = "rebreach_cooldown_minutes";

export const founderSettingsTable = pgTable("founder_settings", {
  key: text("key").primaryKey(),
  value: doublePrecision("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FounderSetting = typeof founderSettingsTable.$inferSelect;
