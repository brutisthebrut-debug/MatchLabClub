import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Allowed values for `outcome`. Stored as text (varchar) so we can extend
 * later without an enum-type migration; the Zod schema enforces the
 * bounded set at the API edge.
 */
export const POST_DATE_OUTCOMES = [
  "another_date",
  "no_more",
  "unsure",
  "ghosted",
] as const;
export type PostDateOutcome = (typeof POST_DATE_OUTCOMES)[number];

/**
 * Persisted post-date debriefs. Replaces the ephemeral state in
 * DebriefWhatHappened so reflections survive a refresh and feed the
 * Mirror's outcome-streak + recent-dates signals.
 *
 * `personLabel` is intentionally a free text field and nullable: the
 * product copy steers users away from storing full names unless they
 * want to, but we don't enforce it server-side.
 */
export const postDateNotesTable = pgTable(
  "post_date_notes",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Optional MatchLab connection this member-private debrief belongs to. */
    connectionId: uuid("connection_id"),
    /** When the date itself happened (nullable; UI may default to "today"). */
    dateAt: timestamp("date_at"),
    personLabel: varchar("person_label", { length: 120 }),
    platform: varchar("platform", { length: 40 }),
    summary: text("summary").notNull(),
    whatWentWell: text("what_went_well").notNull().default(""),
    whatDidnt: text("what_didnt").notNull().default(""),
    followUpPlanned: boolean("follow_up_planned").notNull().default(false),
    /** One of POST_DATE_OUTCOMES, or null if the user hasn't picked yet. */
    outcome: varchar("outcome", { length: 32 }),
    linkedAuditId: integer("linked_audit_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("post_date_notes_user_created_idx").on(t.userId, t.createdAt),
    index("post_date_notes_anon_created_idx").on(
      t.anonymousClaimToken,
      t.createdAt,
    ),
    index("post_date_notes_user_date_idx").on(t.userId, t.dateAt),
    index("post_date_notes_connection_user_idx").on(t.connectionId, t.userId),
  ],
);

export const insertPostDateNoteSchema = createInsertSchema(postDateNotesTable, {
  personLabel: z.string().trim().max(120).nullish(),
  platform: z.string().trim().max(40).nullish(),
  summary: z.string().trim().min(1).max(20000),
  whatWentWell: z.string().trim().max(20000).default(""),
  whatDidnt: z.string().trim().max(20000).default(""),
  followUpPlanned: z.boolean().default(false),
  outcome: z.enum(POST_DATE_OUTCOMES).nullish(),
  linkedAuditId: z.number().int().positive().nullish(),
  connectionId: z.string().uuid().nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertPostDateNote = z.infer<typeof insertPostDateNoteSchema>;
export type PostDateNote = typeof postDateNotesTable.$inferSelect;
