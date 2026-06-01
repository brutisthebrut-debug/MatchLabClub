import { pgTable, bigserial, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * First-party journey instrumentation. One append-only row per meaningful step a
 * person takes through the product, so the founder can see what is actually
 * working across the funnel (not just a derived snapshot of domain tables).
 *
 * Privacy: props is a small, derived bag (a tool name, a path, a score delta).
 * It never carries raw user content or PII. userId attributes authed events;
 * anonId is a stable client-generated id for anonymous visits. Both are optional
 * so an event is still a useful count even when neither is known.
 */
export const JOURNEY_EVENT_TYPES = [
  "visit",
  "signal_fed",
  "readiness_gained",
  "tool_completed",
  "match_step",
  "purchase",
] as const;
export type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number];

/** Event types the public capture endpoint accepts from the browser. */
export const CLIENT_JOURNEY_EVENT_TYPES = ["visit", "tool_completed"] as const;
export type ClientJourneyEventType = (typeof CLIENT_JOURNEY_EVENT_TYPES)[number];

export const journeyEventsTable = pgTable(
  "journey_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    userId: varchar("user_id"),
    anonId: varchar("anon_id", { length: 128 }),
    props: jsonb("props").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("IDX_journey_events_type_created").on(table.eventType, table.createdAt),
    index("IDX_journey_events_created").on(table.createdAt),
  ],
);

export const insertJourneyEventSchema = createInsertSchema(journeyEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJourneyEvent = z.infer<typeof insertJourneyEventSchema>;
export type JourneyEvent = typeof journeyEventsTable.$inferSelect;
