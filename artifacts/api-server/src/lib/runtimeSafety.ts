export type ConnectedBetaEnvironment = Record<string, string | undefined>;

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function httpsOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function isDevAuthEnabled(
  env: ConnectedBetaEnvironment = process.env,
): boolean {
  return env.NODE_ENV !== "production" && enabled(env.ALLOW_DEV_AUTH);
}

/**
 * Runtime preflight for a connected beta. It is opt-in so local development,
 * migrations, and tests keep their existing behavior. When enabled, the API
 * fails before listening instead of silently accepting an unsafe fallback.
 */
export function getConnectedBetaRuntimeIssues(
  env: ConnectedBetaEnvironment = process.env,
): string[] {
  if (!enabled(env.CONNECTED_BETA)) return [];

  const issues: string[] = [];
  const apiOrigin = httpsOrigin(env.API_PUBLIC_URL);
  const webOrigin = httpsOrigin(env.WEB_PUBLIC_URL);
  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => httpsOrigin(value))
      .filter((value): value is string => value !== null),
  );

  if (env.NODE_ENV !== "production") {
    issues.push("NODE_ENV must be production");
  }
  if (!present(env.PORT) || !/^\d+$/.test(env.PORT!.trim()) || Number(env.PORT) <= 0) {
    issues.push("PORT must be a positive integer");
  }
  if (!present(env.DATABASE_URL)) {
    issues.push("DATABASE_URL is required");
  }
  if (!apiOrigin) {
    issues.push("API_PUBLIC_URL must be an exact HTTPS origin");
  }
  if (!webOrigin) {
    issues.push("WEB_PUBLIC_URL must be an exact HTTPS origin");
  }
  if (!webOrigin || !allowedOrigins.has(webOrigin)) {
    issues.push("ALLOWED_ORIGINS must include WEB_PUBLIC_URL exactly");
  }
  if (!present(env.ISSUER_URL)) {
    issues.push("ISSUER_URL is required");
  } else if (/replit\.com\/oidc/i.test(env.ISSUER_URL!)) {
    issues.push("ISSUER_URL cannot use the retired Replit provider");
  } else if (!httpsOrigin(env.ISSUER_URL)) {
    issues.push("ISSUER_URL must be an exact HTTPS origin");
  }
  if (!present(env.OIDC_CLIENT_ID)) {
    issues.push("OIDC_CLIENT_ID is required without a legacy fallback");
  }
  if (env.COOKIE_SECURE?.trim().toLowerCase() !== "true") {
    issues.push("COOKIE_SECURE must be true");
  }
  if (!present(env.ANON_CLAIM_HANDOFF_SECRET)) {
    issues.push("ANON_CLAIM_HANDOFF_SECRET is required");
  }
  if (enabled(env.ALLOW_DEV_AUTH)) {
    issues.push("ALLOW_DEV_AUTH cannot be enabled");
  }
  if (
    present(env.REPL_ID) ||
    present(env.REPLIT_DOMAINS) ||
    present(env.REPLIT_EXPO_DEV_DOMAIN)
  ) {
    issues.push("legacy Replit runtime fallbacks must be removed");
  }
  if (present(env.BILLING_LIVE_PRODUCTS)) {
    issues.push("BILLING_LIVE_PRODUCTS must remain empty");
  }

  return issues;
}

export function assertConnectedBetaRuntime(
  env: ConnectedBetaEnvironment = process.env,
): void {
  const issues = getConnectedBetaRuntimeIssues(env);
  if (issues.length === 0) return;
  throw new Error(
    `Connected beta runtime preflight failed:\n${issues
      .map((issue) => `- ${issue}`)
      .join("\n")}`,
  );
}
