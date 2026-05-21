import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const GEOIP_ALERT_STATE_SINGLETON_ID = "geoip_key_missing";

export const geoipAlertStateTable = pgTable("geoip_alert_state", {
  id: text("id").primaryKey(),
  breached: boolean("breached").notNull().default(false),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  lastClearedAt: timestamp("last_cleared_at", { withTimezone: true }),
  lastDaysSinceUpdate: text("last_days_since_update"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GeoipAlertState = typeof geoipAlertStateTable.$inferSelect;
export type InsertGeoipAlertState = typeof geoipAlertStateTable.$inferInsert;
