import { getStripeSync } from "./stripeClient";

/**
 * Thin wrapper around stripe-replit-sync webhook processing. Keep this minimal:
 * the only job is to hand the raw payload and signature to StripeSync, which
 * verifies the signature and syncs the event into the `stripe` schema.
 */
export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: payload must be a Buffer. This usually means " +
          "express.json() parsed the body before this handler. Ensure the " +
          "webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
