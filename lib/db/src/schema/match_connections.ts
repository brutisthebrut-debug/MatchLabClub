import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A connection is the home for a real conversation between two members who both
// said yes. The matching proposal rows (two mirrored A->B / B->A rows) are great
// for discovery but are not a natural place to hang a thread, so a mutual_yes
// upserts exactly one connection here. The pair is stored ordered (lexicographic
// low/high user id) so the unique index makes creation idempotent and race-safe
// regardless of which side flipped to yes last.
//
// As with the other matching tables, user_id columns have NO foreign key to
// users.id; account deletion wipes these rows explicitly in the GDPR delete
// handler (artifacts/api-server/src/routes/account.ts).

export const CONNECTION_STATUSES = ["active", "closed"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

// Why a connection closed. "unmatch" is a member ending it from the thread,
// "block" is the safety block (also a hard symmetric matching gate), "report"
// is set when a report closes the thread alongside filing it.
export const CONNECTION_CLOSED_REASONS = [
  "unmatch",
  "block",
  "report",
] as const;
export type ConnectionClosedReason = (typeof CONNECTION_CLOSED_REASONS)[number];

export const matchConnectionsTable = pgTable(
  "match_connections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // Always the lexicographically smaller / larger of the two member ids, so a
    // pair maps to exactly one row no matter who said yes first.
    userLowId: varchar("user_low_id").notNull(),
    userHighId: varchar("user_high_id").notNull(),
    status: varchar("status").notNull().default("active"),
    closedReason: varchar("closed_reason"),
    closedByUserId: varchar("closed_by_user_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("match_connections_pair_uidx").on(t.userLowId, t.userHighId),
    index("match_connections_low_idx").on(t.userLowId),
    index("match_connections_high_idx").on(t.userHighId),
  ],
);

export const connectionMessagesTable = pgTable(
  "connection_messages",
  {
    id: serial("id").primaryKey(),
    connectionId: uuid("connection_id").notNull(),
    senderUserId: varchar("sender_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set when the recipient (the non-sender side of the 1:1 connection) reads
    // it. Null means unread. Drives the per-connection unread count.
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("connection_messages_conn_idx").on(t.connectionId, t.id)],
);

export const insertConnectionMessageSchema = createInsertSchema(
  connectionMessagesTable,
  {
    body: z.string().trim().min(1).max(4000),
  },
).omit({
  id: true,
  connectionId: true,
  senderUserId: true,
  createdAt: true,
  readAt: true,
});

export type MatchConnection = typeof matchConnectionsTable.$inferSelect;
export type ConnectionMessage = typeof connectionMessagesTable.$inferSelect;
export type InsertConnectionMessage = z.infer<
  typeof insertConnectionMessageSchema
>;

// Order a pair of member ids into the (low, high) form the table stores. Keeps
// every reader and writer agreeing on which id is which without duplicating the
// comparison.
export function orderConnectionPair(
  a: string,
  b: string,
): { userLowId: string; userHighId: string } {
  return a < b
    ? { userLowId: a, userHighId: b }
    : { userLowId: b, userHighId: a };
}
