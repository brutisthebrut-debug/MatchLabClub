import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  jsonb,
  varchar,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Founder brain config: a small JSON key-value store for the founder control
 * center. Distinct from `founder_settings` (scalar doubles); this holds the
 * structured control object (signal weight overrides, readiness threshold,
 * matching knobs, AI daily caps, connector toggles, the re-weighting mode).
 * One row per logical config key. The accessor lib merges any row over the
 * built-in defaults, so an empty table reproduces day-one behavior exactly.
 */
export const founderBrainConfigTable = pgTable("founder_brain_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Founder curation: the founder marks a match proposal or a signal lane as
 * good or bad, with an optional note. One verdict per (entityType, entityId),
 * upserted. Feeds the brain map and the re-weighting decision: a signal the
 * founder has flagged bad is a candidate to down-weight.
 */
export const founderCurationTable = pgTable(
  "founder_curation",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // 'match_proposal' | 'signal'
    entityType: varchar("entity_type").notNull(),
    // proposal id (uuid) or signal registry id (e.g. "wellness")
    entityId: varchar("entity_id").notNull(),
    // 'good' | 'bad'
    verdict: varchar("verdict").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("founder_curation_entity_idx").on(t.entityType, t.entityId),
  ],
);

export type FounderBrainConfig = typeof founderBrainConfigTable.$inferSelect;
export type FounderCuration = typeof founderCurationTable.$inferSelect;
