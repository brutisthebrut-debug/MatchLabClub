import { pgTable, serial, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lifePulsesTable = pgTable(
  "life_pulses",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    sleep: integer("sleep").notNull(),
    energy: integer("energy").notNull(),
    social: integer("social").notNull(),
    money: integer("money").notNull(),
    headspace: integer("headspace").notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("life_pulses_user_created_idx").on(t.userId, t.createdAt),
    index("life_pulses_anon_created_idx").on(t.anonymousClaimToken, t.createdAt),
  ],
);

const rating = z.number().int().min(1).max(5);

export const insertLifePulseSchema = createInsertSchema(lifePulsesTable, {
  sleep: rating,
  energy: rating,
  social: rating,
  money: rating,
  headspace: rating,
  note: z.string().max(500).nullish(),
}).omit({ id: true, createdAt: true, userId: true, anonymousClaimToken: true });

export type InsertLifePulse = z.infer<typeof insertLifePulseSchema>;
export type LifePulse = typeof lifePulsesTable.$inferSelect;
