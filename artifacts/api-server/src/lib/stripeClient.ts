import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

interface StripeCredentials {
  secretKey: string;
  webhookSecret?: string;
}

type StripeEnvironment = Partial<
  Record<
    | "STRIPE_SECRET_KEY"
    | "STRIPE_WEBHOOK_SECRET"
    | "REPLIT_CONNECTORS_HOSTNAME"
    | "REPL_IDENTITY"
    | "WEB_REPL_RENEWAL",
    string
  >
>;

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

/**
 * Direct credentials are the connected-beta and production path. Keeping this
 * resolver pure makes it possible to verify that a non-Replit runtime can boot
 * without ever logging or persisting the secret values.
 */
export function getDirectStripeCredentials(
  env: StripeEnvironment = process.env,
): StripeCredentials | null {
  const secretKey = trimmed(env.STRIPE_SECRET_KEY);
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: trimmed(env.STRIPE_WEBHOOK_SECRET),
  };
}

/**
 * Resolve the legacy Replit connector token. This remains a compatibility path
 * while the controlled beta moves to explicit deployment credentials.
 */
function getReplitConnectorToken(
  env: StripeEnvironment = process.env,
): { hostname: string; token: string } | null {
  const hostname = trimmed(env.REPLIT_CONNECTORS_HOSTNAME);
  const replIdentity = trimmed(env.REPL_IDENTITY);
  const webRenewal = trimmed(env.WEB_REPL_RENEWAL);

  const token = replIdentity
    ? "repl " + replIdentity
    : webRenewal
      ? "depl " + webRenewal
      : null;

  if (!hostname || !token) return null;
  return { hostname, token };
}

/**
 * Resolve Stripe credentials without coupling beta deployment to Replit.
 * Explicit runtime secrets win; the connector is retained only as a migration
 * fallback. Credentials are fetched fresh so rotations take effect.
 */
async function getStripeCredentials(): Promise<StripeCredentials> {
  const direct = getDirectStripeCredentials();
  if (direct) return direct;

  const connector = getReplitConnectorToken();
  if (!connector) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
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
    items?: Array<{
      settings?: { secret_key?: string; webhook_secret?: string };
    }>;
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret_key) {
    throw new Error("Stripe connector is missing its secret key.");
  }

  return {
    secretKey: settings.secret_key,
    webhookSecret: settings.webhook_secret,
  };
}

export async function isStripeConnected(): Promise<boolean> {
  if (getDirectStripeCredentials()) return true;
  if (!getReplitConnectorToken()) return false;
  try {
    await getStripeCredentials();
    return true;
  } catch {
    return false;
  }
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function constructStripeEvent(
  payload: Buffer,
  signature: string,
): Promise<Stripe.Event | null> {
  const { secretKey, webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) return null;
  const stripe = new Stripe(secretKey);
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

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
