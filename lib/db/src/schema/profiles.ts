import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("dating_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  platform: text("platform").notNull(),
  bio: text("bio").notNull(),
  prompts: text("prompts"),
  photoCount: integer("photo_count"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, userId: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type DatingProfile = typeof profilesTable.$inferSelect;
