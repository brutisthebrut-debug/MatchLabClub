import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, isStripeConnected } from "./stripeClient";
import { reconcilePurchaseInterestFromStripe } from "./stripeReconcile";
import { logger } from "./logger";

/**
 * Initialize the Stripe integration on startup. This is a guarded no-op: when
 * the Stripe connection or DATABASE_URL is absent, it logs and returns without
 * throwing, so the server boots normally with Stripe disabled.
 *
 * Order matters (per the stripe-replit-sync contract):
 *   1. runMigrations() creates the `stripe` schema (idempotent)
 *   2. getStripeSync() builds the sync client
 *   3. findOrCreateManagedWebhook() registers the managed webhook
 *   4. syncBackfill() pulls existing Stripe data into the `stripe` schema
 *   5. reconcile our purchase_interest rows against the freshly synced data
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.info("Stripe init skipped: DATABASE_URL not set");
    return;
  }

  if (!(await isStripeConnected())) {
    logger.info("Stripe init skipped: integration not connected");
    return;
  }

  try {
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const primaryDomain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
    if (primaryDomain) {
      const webhook = await stripeSync.findOrCreateManagedWebhook(
        `https://${primaryDomain}/api/stripe/webhook`,
      );
      logger.info(
        { webhookUrl: webhook?.url ?? "configured" },
        "Stripe managed webhook ready",
      );
    } else {
      logger.warn(
        "Stripe webhook registration skipped: REPLIT_DOMAINS not set",
      );
    }

    // Backfill, then reconcile, in the background so startup is not blocked.
    void stripeSync
      .syncBackfill()
      .then(() => reconcilePurchaseInterestFromStripe())
      .then((result) =>
        logger.info(result, "Stripe backfill and reconcile complete"),
      )
      .catch((err) =>
        logger.warn({ err }, "Stripe backfill/reconcile failed"),
      );
  } catch (err) {
    logger.warn({ err }, "Stripe init failed; continuing without Stripe");
  }
}
