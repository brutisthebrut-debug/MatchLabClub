import { isStripeConnected } from "./stripeClient";
import { logger } from "./logger";

/**
 * Stripe webhooks are registered explicitly in the Stripe dashboard. Startup
 * only reports whether the direct SDK is configured; it never mutates remote
 * webhook configuration or creates a sidecar-owned database schema.
 */
export async function initStripe(): Promise<void> {
  if (!(await isStripeConnected())) {
    logger.info("Stripe init skipped: STRIPE_SECRET_KEY not set");
    return;
  }
  if (!process.env["STRIPE_WEBHOOK_SECRET"]?.trim()) {
    logger.warn("Stripe client configured without STRIPE_WEBHOOK_SECRET");
    return;
  }
  logger.info("Direct Stripe client and signed webhook endpoint configured");
}
