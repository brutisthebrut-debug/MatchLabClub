import { normalizeHttpOrigin } from "./runtimeConfig";

type RuntimeEnvironment = Partial<
  Record<
    | "NODE_ENV"
    | "PORT"
    | "DATABASE_URL"
    | "CONNECTED_BETA"
    | "ALLOW_DEV_AUTH"
    | "APP_ORIGINS"
    | "API_PUBLIC_URL"
    | "WEB_PUBLIC_URL"
    | "ISSUER_URL"
    | "OIDC_CLIENT_ID"
    | "COOKIE_SECURE"
    | "ANON_CLAIM_HANDOFF_SECRET"
    | "STRIPE_SECRET_KEY"
    | "STRIPE_WEBHOOK_SECRET"
    | "STRIPE_PRICE_INSIGHT_MONTHLY"
    | "STRIPE_PRICE_INSIGHT_ANNUAL"
    | "STRIPE_PRICE_MATCH_MONTHLY"
    | "STRIPE_PRICE_MATCH_QUARTERLY"
    | "STRIPE_ENABLE_GUIDED",
    string
  >
>;

const REQUIRED_PRICE_KEYS = [
  "STRIPE_PRICE_INSIGHT_MONTHLY",
  "STRIPE_PRICE_INSIGHT_ANNUAL",
  "STRIPE_PRICE_MATCH_MONTHLY",
  "STRIPE_PRICE_MATCH_QUARTERLY",
] as const;

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isDevAuthEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env.NODE_ENV !== "production" && enabled(env.ALLOW_DEV_AUTH);
}

export function getConnectedBetaRuntimeIssues(
  env: RuntimeEnvironment = process.env,
): string[] {
  if (!enabled(env.CONNECTED_BETA)) return [];

  const issues: string[] = [];
  const apiOrigin = normalizeHttpOrigin(env.API_PUBLIC_URL);
  const webOrigin = normalizeHttpOrigin(env.WEB_PUBLIC_URL);
  const allowedOrigins = new Set(
    (env.APP_ORIGINS ?? "")
      .split(",")
      .map((value) => normalizeHttpOrigin(value))
      .filter((value): value is string => value !== null),
  );

  if (env.NODE_ENV !== "production") {
    issues.push("NODE_ENV must be production");
  }
  if (!present(env.PORT) || !/^\d+$/.test(env.PORT!.trim())) {
    issues.push("PORT must be a positive integer");
  } else if (Number(env.PORT) <= 0) {
    issues.push("PORT must be a positive integer");
  }
  if (!present(env.DATABASE_URL)) {
    issues.push("DATABASE_URL is required");
  }
  if (!apiOrigin) {
    issues.push("API_PUBLIC_URL must be a valid HTTPS origin");
  }
  if (!webOrigin) {
    issues.push("WEB_PUBLIC_URL must be a valid HTTPS origin");
  }
  if (!webOrigin || !allowedOrigins.has(webOrigin)) {
    issues.push("APP_ORIGINS must include WEB_PUBLIC_URL exactly");
  }
  if (!present(env.ISSUER_URL)) {
    issues.push("ISSUER_URL is required");
  } else if (env.ISSUER_URL!.includes("replit.com/oidc")) {
    issues.push("ISSUER_URL cannot use the Replit migration fallback");
  } else if (!normalizeHttpOrigin(env.ISSUER_URL)) {
    issues.push("ISSUER_URL must be a valid HTTPS origin");
  }
  if (!present(env.OIDC_CLIENT_ID)) {
    issues.push("OIDC_CLIENT_ID is required without a Replit fallback");
  }
  if (env.COOKIE_SECURE?.trim().toLowerCase() === "false") {
    issues.push("COOKIE_SECURE cannot be false");
  }
  if (!present(env.ANON_CLAIM_HANDOFF_SECRET)) {
    issues.push("ANON_CLAIM_HANDOFF_SECRET is required");
  }
  if (enabled(env.ALLOW_DEV_AUTH)) {
    issues.push("ALLOW_DEV_AUTH cannot be enabled");
  }
  if (!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY?.trim() ?? "")) {
    issues.push("STRIPE_SECRET_KEY must be a Stripe test-mode key");
  }
  if (!env.STRIPE_WEBHOOK_SECRET?.trim().startsWith("whsec_")) {
    issues.push("STRIPE_WEBHOOK_SECRET must be a webhook signing secret");
  }
  for (const key of REQUIRED_PRICE_KEYS) {
    if (!env[key]?.trim().startsWith("price_")) {
      issues.push(`${key} must be a Stripe Price ID`);
    }
  }
  if (enabled(env.STRIPE_ENABLE_GUIDED)) {
    issues.push("STRIPE_ENABLE_GUIDED must remain disabled");
  }

  return issues;
}

export function assertConnectedBetaRuntime(
  env: RuntimeEnvironment = process.env,
): void {
  const issues = getConnectedBetaRuntimeIssues(env);
  if (issues.length === 0) return;
  throw new Error(
    `Connected beta runtime preflight failed:\n${issues
      .map((issue) => `- ${issue}`)
      .join("\n")}`,
  );
}
