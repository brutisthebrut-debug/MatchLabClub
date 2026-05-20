import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  podcastSource: text("podcast_source"),
  interestedIn: text("interested_in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({ id: true, createdAt: true, userId: true });
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type WaitlistEntry = typeof waitlistTable.$inferSelect;
