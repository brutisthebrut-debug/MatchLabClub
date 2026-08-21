type RuntimeEnvironment = Partial<
  Record<
    | "ISSUER_URL"
    | "OIDC_CLIENT_ID"
    | "REPL_ID"
    | "API_PUBLIC_URL"
    | "WEB_PUBLIC_URL"
    | "APP_ORIGINS"
    | "COOKIE_SECURE"
    | "NODE_ENV",
    string
  >
>;

export function normalizeHttpOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const localHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !localHttp) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolvePublicWebOrigin(
  env: RuntimeEnvironment = process.env,
): string | null {
  const explicit = normalizeHttpOrigin(env.WEB_PUBLIC_URL);
  if (explicit) return explicit;
  for (const candidate of env.APP_ORIGINS?.split(",") ?? []) {
    const origin = normalizeHttpOrigin(candidate);
    if (origin) return origin;
  }
  return null;
}

export function resolvePublicApiOrigin(
  env: RuntimeEnvironment = process.env,
): string | null {
  return normalizeHttpOrigin(env.API_PUBLIC_URL);
}

export function resolveOidcIssuer(
  env: RuntimeEnvironment = process.env,
): string {
  const raw = env.ISSUER_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const localHttp =
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      if (
        (url.protocol === "https:" || localHttp) &&
        !url.username &&
        !url.password
      ) {
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      // Fall through to the migration default.
    }
  }
  return "https://replit.com/oidc";
}

export function resolveOidcClientId(
  env: RuntimeEnvironment = process.env,
): string | null {
  return env.OIDC_CLIENT_ID?.trim() || env.REPL_ID?.trim() || null;
}

export function useSecureSessionCookies(
  env: RuntimeEnvironment = process.env,
): boolean {
  const explicit = env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return env.NODE_ENV === "production";
}
