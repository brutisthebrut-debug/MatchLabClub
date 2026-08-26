import { pathToFileURL } from "node:url";

export type ReleaseEnvironment = Record<string, string | undefined>;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const PLACEHOLDER_PATTERN = /^(change-me|replace-me|example|placeholder|todo|unset)([-_].*)?$/i;

function value(env: ReleaseEnvironment, key: string): string {
  return env[key]?.trim() ?? "";
}

function requireValue(
  env: ReleaseEnvironment,
  key: string,
  errors: string[],
): string {
  const current = value(env, key);
  if (!current) {
    errors.push(`${key} is required.`);
  } else if (PLACEHOLDER_PATTERN.test(current)) {
    errors.push(`${key} still contains a placeholder value.`);
  }
  return current;
}

function validateHttpsUrl(
  raw: string,
  key: string,
  errors: string[],
): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") {
      errors.push(`${key} must use https.`);
      return null;
    }
    return parsed;
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return null;
  }
}

export function validateReleaseEnvironment(
  env: ReleaseEnvironment,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const databaseUrl = requireValue(env, "DATABASE_URL", errors);
  if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    errors.push("DATABASE_URL must be a PostgreSQL connection URL.");
  }

  const rawPort = requireValue(env, "PORT", errors);
  const port = Number(rawPort);
  if (rawPort && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }

  if (value(env, "NODE_ENV") !== "production") {
    errors.push("NODE_ENV must be production.");
  }

  const issuer = validateHttpsUrl(
    requireValue(env, "ISSUER_URL", errors),
    "ISSUER_URL",
    errors,
  );
  if (issuer && /(^|\.)replit\.com$/i.test(issuer.hostname)) {
    errors.push("ISSUER_URL must not use the retired Replit identity provider.");
  }

  requireValue(env, "OIDC_CLIENT_ID", errors);

  const allowedOrigins = requireValue(env, "ALLOWED_ORIGINS", errors);
  if (allowedOrigins) {
    for (const origin of allowedOrigins.split(",").map((item) => item.trim())) {
      const parsed = validateHttpsUrl(origin, "ALLOWED_ORIGINS", errors);
      if (!parsed) break;
      if (parsed.origin !== origin.replace(/\/$/, "")) {
        errors.push(
          "ALLOWED_ORIGINS entries must be exact origins without paths.",
        );
        break;
      }
      if (/(^|\.)replit\.(app|dev|com)$/i.test(parsed.hostname)) {
        errors.push(
          "ALLOWED_ORIGINS must not include a retired Replit application hostname.",
        );
        break;
      }
    }
  }

  if (value(env, "REPL_ID")) {
    warnings.push(
      "REPL_ID is deprecated; remove it after every environment uses OIDC_CLIENT_ID.",
    );
  }
  if (value(env, "REPLIT_DOMAINS") || value(env, "REPLIT_EXPO_DEV_DOMAIN")) {
    warnings.push(
      "REPLIT_DOMAINS and REPLIT_EXPO_DEV_DOMAIN are deprecated; remove them after every environment uses ALLOWED_ORIGINS.",
    );
  }

  if (value(env, "BILLING_LIVE_PRODUCTS")) {
    errors.push(
      "BILLING_LIVE_PRODUCTS must remain empty for the pre-production release gate.",
    );
  }

  return { errors, warnings };
}

function runCli(): void {
  const result = validateReleaseEnvironment(process.env);
  for (const warning of result.warnings) {
    console.warn(`release-env warning: ${warning}`);
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`release-env error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    "Release environment contract passed. Paid products remain closed.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli();
}
