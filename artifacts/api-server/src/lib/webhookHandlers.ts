import { constructStripeEvent } from "./stripeClient";
import { processStripeBillingEvent } from "./stripeBilling";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: payload must be a Buffer. Register the webhook before express.json().",
      );
    }

    const event = await constructStripeEvent(payload, signature);
    if (!event) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    }
    await processStripeBillingEvent(event);
  }
}
