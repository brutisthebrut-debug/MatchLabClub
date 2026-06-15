import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One row per user holding their "Care Dialect" profile: an original-terminology
 * love-languages model with two axes, how they GIVE care and how they RECEIVE
 * care, across six dialects (spokenWarmth, helpingHands, thoughtfulTokens,
 * undividedTime, closeContact, steadyPresence).
 *
 * We store ONLY the derived result, never the raw quiz answers: the
 * self-identified top dialect per axis (what the user guessed) plus the
 * server-scored tested distribution per axis and its top key. The distributions
 * are small numeric maps {dialectKey: weight} that sum to ~1; they feed the
 * matching engine's complementarity component and the user's self-vs-tested
 * comparison. One row per user, upserted on retake.
 */
export const careDialectProfilesTable = pgTable(
  "care_dialect_profiles",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** What the user guessed they primarily give / want to receive. */
    selfGive: varchar("self_give", { length: 32 }),
    selfReceive: varchar("self_receive", { length: 32 }),
    /** Server-scored tested distributions {dialectKey: weight}, sum ~1. */
    testedGiveDist: jsonb("tested_give_dist").$type<Record<string, number>>(),
    testedGiveTop: varchar("tested_give_top", { length: 32 }),
    testedReceiveDist: jsonb("tested_receive_dist").$type<Record<string, number>>(),
    testedReceiveTop: varchar("tested_receive_top", { length: 32 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("care_dialect_profiles_user_idx").on(t.userId)],
);
