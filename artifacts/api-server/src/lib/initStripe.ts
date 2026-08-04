import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, isStripeConnected } from "./stripeClient";
import { reconcilePurchaseInterestFromStripe } from "./stripeReconcile";
import { reconcileAllStripeCommercialPlans } from "./subscriptionLifecycle";
import { logger } from "./logger";

type StripeRuntimeEnvironment = Partial<
  Record<"STRIPE_WEBHOOK_URL" | "API_PUBLIC_URL" | "REPLIT_DOMAINS", string>
>;

export function resolveStripeWebhookUrl(
  env: StripeRuntimeEnvironment = process.env,
): string | null {
  const explicit = env.STRIPE_WEBHOOK_URL?.trim();
  const apiOrigin = env.API_PUBLIC_URL?.trim();
  const replitDomain = env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const candidate =
    explicit ||
    (apiOrigin ? `${apiOrigin.replace(/\/$/, "")}/api/stripe/webhook` : null) ||
    (replitDomain ? `https://${replitDomain}/api/stripe/webhook` : null);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Initialize Stripe without making it a server boot dependency. The managed
 * Stripe mirror remains read-only to MatchLab; commercial-plan reconciliation
 * updates only users.tier for non-founder-managed accounts.
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
    const webhookUrl = resolveStripeWebhookUrl();

    if (webhookUrl) {
      const webhook = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info(
        { webhookUrl: webhook?.url ?? "configured" },
        "Stripe managed webhook ready",
      );
    } else {
      logger.warn(
        "Stripe webhook registration skipped: set STRIPE_WEBHOOK_URL or API_PUBLIC_URL",
      );
    }

    void stripeSync
      .syncBackfill()
      .then(async () => {
        const [purchaseInterest, commercialPlans] = await Promise.all([
          reconcilePurchaseInterestFromStripe(),
          reconcileAllStripeCommercialPlans(),
        ]);
        return { purchaseInterest, commercialPlans };
      })
      .then((result) =>
        logger.info(
          result,
          "Stripe backfill and entitlement reconcile complete",
        ),
      )
      .catch((err) => logger.warn({ err }, "Stripe backfill/reconcile failed"));
  } catch (err) {
    logger.warn({ err }, "Stripe init failed; continuing without Stripe");
  }
}
