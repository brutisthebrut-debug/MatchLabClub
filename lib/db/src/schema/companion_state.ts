import {
  pgTable,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * One accumulating row per user for the Echo companion. This is Echo's evolving
 * memory of a person plus their persona/candor settings. It is mutated only via
 * the userId primary key (onConflictDoUpdate), a single lookup path, so no
 * advisory lock is needed to keep concurrent writes safe.
 *
 * `persona` is the relationship register (warm best friend by default).
 * `candor` is the bluntness dial, 1 (gentle) to 3 (tough love); default 2 means
 * honest, challenges by default, never a yes person. `evolvingSummary` is a
 * short derived read of the person that Echo refreshes as signals accumulate;
 * it holds only derived language, never raw content or PII.
 *
 * No foreign key on user_id, same rationale as the other companion/matching
 * tables; the GDPR delete handler wipes these rows explicitly.
 */
export const companionStateTable = pgTable("companion_state", {
  userId: varchar("user_id").primaryKey(),
  persona: varchar("persona").notNull().default("best_friend"),
  candor: integer("candor").notNull().default(2),
  evolvingSummary: text("evolving_summary"),
  lastMood: varchar("last_mood"),
  lastSeenScore: integer("last_seen_score"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastProactiveAt: timestamp("last_proactive_at", { withTimezone: true }),
  // Baseline for the in-the-moment readiness reaction. Distinct from
  // last_seen_* (which drives ambient observations): the pulse endpoint advances
  // these only when it actually reacts, so a single climb is never double-counted
  // and the "what I can now see" attribution stays grounded in the prior
  // per-lane coverage. Coverage holds only derived 0-100 lane scores, never raw
  // content or PII.
  lastReactedScore: integer("last_reacted_score"),
  lastReactedCoverage: jsonb("last_reacted_coverage").$type<
    Record<string, number>
  >(),
  lastReactedAt: timestamp("last_reacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CompanionState = typeof companionStateTable.$inferSelect;
