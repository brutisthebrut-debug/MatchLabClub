import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  email: text("email").notNull(),
  source: text("source").notNull(),
  interest: text("interest"),
  metadata: jsonb("metadata"),
  // Founder-side triage state. Persisted server-side (not browser-local) so the
  // pipeline survives refreshes and is shared across devices/teammates.
  status: text("status").notNull().default("New"),
  statusUpdatedAt: timestamp("status_updated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
