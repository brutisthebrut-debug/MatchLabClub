export type RuntimeEnvironment = Record<string, string | undefined>;

function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getOidcIssuerUrl(
  env: RuntimeEnvironment = process.env,
): string {
  const configured = env.ISSUER_URL?.trim();
  if (!configured) {
    throw new Error("ISSUER_URL environment variable is required.");
  }

  try {
    const parsed = new URL(configured);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new Error("ISSUER_URL must be a valid HTTPS URL.");
  }
}

export function getOidcClientId(
  env: RuntimeEnvironment = process.env,
): string {
  const clientId = env.OIDC_CLIENT_ID?.trim() || env.REPL_ID?.trim();
  if (!clientId) {
    throw new Error("OIDC_CLIENT_ID environment variable is required.");
  }
  return clientId;
}

export function buildAllowedOrigins(
  env: RuntimeEnvironment = process.env,
): Set<string> {
  const origins = new Set<string>();

  for (const configured of splitList(env.ALLOWED_ORIGINS)) {
    try {
      const parsed = new URL(configured);
      if (
        parsed.protocol === "https:" &&
        parsed.origin === configured.replace(/\/$/, "")
      ) {
        origins.add(parsed.origin);
      }
    } catch {
      // Release validation reports malformed configuration before deployment.
    }
  }

  // Temporary rollout compatibility. These names can be removed after every
  // deployed environment uses ALLOWED_ORIGINS.
  for (const domain of splitList(env.REPLIT_DOMAINS)) {
    origins.add(`https://${domain}`);
  }
  for (const domain of splitList(env.REPLIT_EXPO_DEV_DOMAIN)) {
    origins.add(`https://${domain}`);
  }

  return origins;
}
