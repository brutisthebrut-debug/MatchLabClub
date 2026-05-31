import { db, purchaseInterestTable } from "@workspace/db";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { logger } from "./logger";

export interface ReconcileResult {
  paidSessionsSeen: number;
  rowsUpdated: number;
}

/**
 * Reconcile our `purchase_interest` rows against paid Stripe checkout sessions.
 *
 * Read-only against the `stripe` schema (managed by stripe-replit-sync): we only
 * SELECT from `stripe.checkout_sessions`, then UPDATE our own
 * `purchase_interest` table. We never INSERT/UPDATE/DELETE inside `stripe.*`.
 *
 * A row is marked `paid` and stamped with the Stripe session id when its email
 * matches the email on a checkout session whose `payment_status = 'paid'`.
 * Matching is case-insensitive. Rows already marked `paid` are left untouched.
 */
export async function reconcilePurchaseInterestFromStripe(): Promise<ReconcileResult> {
  const paid = await db.execute<{ id: string; email: string | null }>(sql`
    SELECT id,
           COALESCE(customer_email, customer_details->>'email') AS email
    FROM stripe.checkout_sessions
    WHERE payment_status = 'paid'
      AND COALESCE(customer_email, customer_details->>'email') IS NOT NULL
  `);

  let rowsUpdated = 0;
  for (const session of paid.rows) {
    const email = session.email?.trim();
    if (!email) continue;

    const updated = await db
      .update(purchaseInterestTable)
      .set({ status: "paid", stripeSessionId: session.id })
      .where(
        and(
          sql`lower(${purchaseInterestTable.email}) = lower(${email})`,
          ne(purchaseInterestTable.status, "paid"),
          or(
            isNull(purchaseInterestTable.stripeSessionId),
            eq(purchaseInterestTable.stripeSessionId, session.id),
          ),
        ),
      )
      .returning({ id: purchaseInterestTable.id });

    rowsUpdated += updated.length;
  }

  const result: ReconcileResult = {
    paidSessionsSeen: paid.rows.length,
    rowsUpdated,
  };

  if (rowsUpdated > 0) {
    logger.info(result, "Reconciled purchase_interest rows from Stripe");
  }

  return result;
}
