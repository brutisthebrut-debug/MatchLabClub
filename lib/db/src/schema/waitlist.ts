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
  activatedAt: timestamp("activated_at"),
  activationEmailSentAt: timestamp("activation_email_sent_at"),
});
