import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseInterestTable = pgTable("purchase_interest", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  email: text("email").notNull(),
  product: text("product").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  source: text("source"),
  promoCode: text("promo_code"),
  stripeSessionId: text("stripe_session_id"),
  status: text("status").notNull().default("interest"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPurchaseInterestSchema = createInsertSchema(purchaseInterestTable).omit({
  id: true, createdAt: true, status: true, stripeSessionId: true,
});
export type InsertPurchaseInterest = z.infer<typeof insertPurchaseInterestSchema>;
export type PurchaseInterest = typeof purchaseInterestTable.$inferSelect;
