import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

interface StripeCredentials {
  secretKey: string;
  webhookSecret?: string;
}

/**
 * Resolve the Replit connector token from the environment. Returns null when
 * the process is not running inside a Repl with connector access, which lets
 * callers treat Stripe as an optional, opt-in integration instead of crashing.
 */
function getReplitConnectorToken(): { hostname: string; token: string } | null {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const replIdentity = process.env["REPL_IDENTITY"];
  const webRenewal = process.env["WEB_REPL_RENEWAL"];

  const token = replIdentity
    ? "repl " + replIdentity
    : webRenewal
      ? "depl " + webRenewal
      : null;

  if (!hostname || !token) {
    return null;
  }
  return { hostname, token };
}

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached: tokens can rotate, so we fetch fresh each time.
 * Throws when the integration is not connected.
 */
async function getStripeCredentials(): Promise<StripeCredentials> {
  const connector = getReplitConnectorToken();
  if (!connector) {
    throw new Error(
      "Missing Replit connector environment. Connect Stripe via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${connector.hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: connector.token },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{ settings?: { secret_key?: string; webhook_secret?: string } }>;
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret_key) {
    throw new Error(
      "Stripe integration not connected or missing secret key. Connect Stripe via the Integrations tab first.",
    );
  }

  return {
    secretKey: settings.secret_key,
    webhookSecret: settings.webhook_secret,
  };
}

/**
 * Returns true when the Stripe integration appears to be connected. Used to
 * guard startup so the server boots cleanly when Stripe is not configured.
 */
export async function isStripeConnected(): Promise<boolean> {
  const connector = getReplitConnectorToken();
  if (!connector) return false;
  try {
    await getStripeCredentials();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached: fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached: fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
