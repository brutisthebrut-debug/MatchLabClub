import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseEnvironment } from "./validateReleaseEnv";

const validEnvironment = {
  DATABASE_URL: "postgres://release-user:secret@db.internal:5432/matchlab",
  PORT: "8080",
  NODE_ENV: "production",
  ISSUER_URL: "https://identity.matchlab.club",
  OIDC_CLIENT_ID: "matchlab-web-client",
  ALLOWED_ORIGINS: "https://app.matchlab.club,https://preview.matchlab.club",
  BILLING_LIVE_PRODUCTS: "",
};

test("accepts a production-shaped environment with paid products closed", () => {
  const result = validateReleaseEnvironment(validEnvironment);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("fails closed when any paid product is enabled", () => {
  const result = validateReleaseEnvironment({
    ...validEnvironment,
    BILLING_LIVE_PRODUCTS: "signal-audit",
  });
  assert.deepEqual(result.errors, [
    "BILLING_LIVE_PRODUCTS must remain empty for the pre-production release gate.",
  ]);
});

test("rejects missing, placeholder, and retired Replit configuration", () => {
  const result = validateReleaseEnvironment({
    DATABASE_URL: "",
    PORT: "not-a-port",
    NODE_ENV: "development",
    ISSUER_URL: "https://replit.com/oidc",
    OIDC_CLIENT_ID: "placeholder",
    ALLOWED_ORIGINS: "https://matchlab.replit.app",
  });

  assert.ok(result.errors.includes("DATABASE_URL is required."));
  assert.ok(result.errors.includes("PORT must be an integer between 1 and 65535."));
  assert.ok(result.errors.includes("NODE_ENV must be production."));
  assert.ok(
    result.errors.includes(
      "ISSUER_URL must not use the retired Replit identity provider.",
    ),
  );
  assert.ok(result.errors.includes("OIDC_CLIENT_ID still contains a placeholder value."));
  assert.ok(
    result.errors.includes(
      "ALLOWED_ORIGINS must not include a retired Replit application hostname.",
    ),
  );
});

test("never includes environment values in errors", () => {
  const secret = "postgres://release-user:super-secret@db.internal/matchlab";
  const result = validateReleaseEnvironment({
    ...validEnvironment,
    DATABASE_URL: secret.replace("postgres://", "mysql://"),
  });
  assert.ok(result.errors.length > 0);
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("warns without exposing values when legacy rollout names remain", () => {
  const result = validateReleaseEnvironment({
    ...validEnvironment,
    REPL_ID: "legacy-client-value",
    REPLIT_DOMAINS: "legacy.example.com",
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.equal(JSON.stringify(result).includes("legacy-client-value"), false);
});
