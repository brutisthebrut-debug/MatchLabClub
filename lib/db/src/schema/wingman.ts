import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Wingman loop: outside perspectives on who the user actually is.
 *
 * The user invites a friend with a signed link. The friend, without any
 * account, rates the user on five plain traits (1-5 each). Seeing yourself
 * through people who know you is its own read on a person, so the count of
 * outside perspectives gathered feeds matching readiness as the
 * `externalCalibration` lane, and the gap between how the user rates themselves
 * and how friends rate them is surfaced back honestly.
 *
 * Privacy: friends only ever submit five 1-5 scores, never any free text, so
 * there is nothing to leak. Only aggregated averages and the derived
 * self-vs-others gap are ever shown or reasoned over; an individual friend's
 * answer is never attributed back to them. The optional friendLabel is a
 * nickname the owner types for their own reference and is never shown to the
 * friend or sent to any external model.
 */

/** One invite the owner created for a specific friend. */
export const wingmanInvitesTable = pgTable(
  "wingman_invites",
  {
    id: serial("id").primaryKey(),
    /** The owner who wants outside perspective. */
    userId: varchar("user_id").notNull(),
    /** Owner-facing nickname for the friend. Never shown to the friend. */
    friendLabel: varchar("friend_label", { length: 60 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Set once the friend submits, so a link can only be answered once. */
    answeredAt: timestamp("answered_at"),
  },
  (t) => [index("wingman_invite_user_created_idx").on(t.userId, t.createdAt)],
);

/**
 * One friend's answer to an invite. Exactly one per invite (the unique index),
 * enforced server-side alongside the invite's answeredAt stamp. userId is
 * denormalized from the invite so the owner's aggregate is a single grouped
 * query. Only five 1-5 scores are stored, never any free text.
 */
export const wingmanAnswersTable = pgTable(
  "wingman_answers",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id").notNull(),
    /** The owner this answer is about, denormalized for easy aggregation. */
    userId: varchar("user_id").notNull(),
    warmth: integer("warmth").notNull(),
    humor: integer("humor").notNull(),
    drive: integer("drive").notNull(),
    openness: integer("openness").notNull(),
    steadiness: integer("steadiness").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("wingman_answer_invite_idx").on(t.inviteId),
    index("wingman_answer_user_idx").on(t.userId),
  ],
);

/**
 * The owner's own rating of themselves on the same five traits. One row per
 * user; re-rating overwrites. The self-vs-others gap reads from here against
 * the friend averages.
 */
export const wingmanSelfRatingsTable = pgTable("wingman_self_ratings", {
  userId: varchar("user_id").primaryKey(),
  warmth: integer("warmth").notNull(),
  humor: integer("humor").notNull(),
  drive: integer("drive").notNull(),
  openness: integer("openness").notNull(),
  steadiness: integer("steadiness").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WingmanInviteRow = typeof wingmanInvitesTable.$inferSelect;
export type WingmanAnswerRow = typeof wingmanAnswersTable.$inferSelect;
export type WingmanSelfRatingRow = typeof wingmanSelfRatingsTable.$inferSelect;
