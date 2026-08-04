type OriginEnv = Pick<
  NodeJS.ProcessEnv,
  "APP_ORIGINS" | "REPLIT_DOMAINS" | "REPLIT_EXPO_DEV_DOMAIN"
>;

function addOrigin(origins: Set<string>, raw: string): void {
  const candidate = raw.trim();
  if (!candidate) return;

  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || url.protocol === "http:") {
      origins.add(url.origin);
    }
  } catch {
    // Invalid entries are ignored rather than weakening CORS to a wildcard.
  }
}

/**
 * Build the exact origins trusted for credentialed browser requests.
 *
 * APP_ORIGINS is the environment-neutral production and beta setting. Existing
 * Replit domains remain supported so this migration can happen without breaking
 * the current development environment.
 */
export function buildAllowedOrigins(env: OriginEnv = process.env): Set<string> {
  const origins = new Set<string>();

  for (const origin of (env.APP_ORIGINS ?? "").split(",")) {
    addOrigin(origins, origin);
  }

  for (const domain of (env.REPLIT_DOMAINS ?? "").split(",")) {
    const trimmed = domain.trim();
    if (trimmed) addOrigin(origins, `https://${trimmed}`);
  }

  const expoDomain = env.REPLIT_EXPO_DEV_DOMAIN?.trim();
  if (expoDomain) addOrigin(origins, `https://${expoDomain}`);

  return origins;
}
