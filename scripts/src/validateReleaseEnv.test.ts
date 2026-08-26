import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseEnvironment } from "./validateReleaseEnv";

const validEnvironment = {
  DATABASE_URL: "postgres://release-user:secret@db.internal:5432/matchlab",
  PORT: "8080",
  NODE_ENV: "production",
  ISSUER_URL: "https://identity.matchlab.club",
  REPL_ID: "matchlab-web-client",
  REPLIT_DOMAINS: "app.matchlab.club,preview.matchlab.club",
  BILLING_LIVE_PRODUCTS: "",
};

test("accepts a production-shaped environment with paid products closed", () => {
  const result = validateReleaseEnvironment(validEnvironment);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 2);
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
    REPL_ID: "placeholder",
    REPLIT_DOMAINS: "matchlab.replit.app",
  });

  assert.ok(result.errors.includes("DATABASE_URL is required."));
  assert.ok(result.errors.includes("PORT must be an integer between 1 and 65535."));
  assert.ok(result.errors.includes("NODE_ENV must be production."));
  assert.ok(
    result.errors.includes(
      "ISSUER_URL must not use the retired Replit identity provider.",
    ),
  );
  assert.ok(result.errors.includes("REPL_ID still contains a placeholder value."));
  assert.ok(
    result.errors.includes(
      "REPLIT_DOMAINS must not include a retired Replit application hostname.",
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
