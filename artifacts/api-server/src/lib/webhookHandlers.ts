import { getStripeSync, constructStripeEvent } from "./stripeClient";
import { processCommercialPlanStripeEvent } from "./subscriptionLifecycle";

/**
 * StripeSync verifies and persists the event first. Commercial entitlement is
 * then recalculated from Stripe's current customer state, so retries, duplicate
 * delivery, and out-of-order events converge on the same result.
 */
export class WebhookHandlers {
  static async processWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: payload must be a Buffer. This usually means " +
          "express.json() parsed the body before this handler. Ensure the " +
          "webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const event = await constructStripeEvent(payload, signature);
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    if (event) await processCommercialPlanStripeEvent(event);
  }
}
