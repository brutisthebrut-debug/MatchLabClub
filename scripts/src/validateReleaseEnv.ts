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

  // The runtime currently consumes this compatibility name as its OIDC client
  // id. Keep the deployment honest until the auth migration renames it.
  requireValue(env, "REPL_ID", errors);
  warnings.push(
    "REPL_ID is currently the OIDC client-id compatibility name; migrate runtime usage to OIDC_CLIENT_ID before removing it.",
  );

  const domains = requireValue(env, "REPLIT_DOMAINS", errors);
  if (domains) {
    for (const domain of domains.split(",").map((item) => item.trim())) {
      if (
        !domain ||
        domain.includes("://") ||
        domain.includes("/") ||
        /\s/.test(domain)
      ) {
        errors.push(
          "REPLIT_DOMAINS must be a comma-separated hostname list without schemes or paths.",
        );
        break;
      }
      if (/(^|\.)replit\.(app|dev|com)$/i.test(domain)) {
        errors.push(
          "REPLIT_DOMAINS must not include a retired Replit application hostname.",
        );
        break;
      }
    }
  }
  warnings.push(
    "REPLIT_DOMAINS is currently the trusted-origin compatibility name; migrate runtime usage to ALLOWED_ORIGINS before removing it.",
  );

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
