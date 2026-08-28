import { describe, expect, it } from "vitest";
import {
  assertConnectedBetaRuntime,
  getConnectedBetaRuntimeIssues,
  isDevAuthEnabled,
} from "./runtimeSafety";

const validConnectedBetaEnvironment = {
  CONNECTED_BETA: "true",
  NODE_ENV: "production",
  PORT: "8080",
  DATABASE_URL: "postgres://matchlab:secret@db.example.com/matchlab",
  ALLOWED_ORIGINS: "https://beta.matchlab.club",
  API_PUBLIC_URL: "https://api-beta.matchlab.club",
  WEB_PUBLIC_URL: "https://beta.matchlab.club",
  ISSUER_URL: "https://identity.example.com",
  OIDC_CLIENT_ID: "matchlab-beta",
  COOKIE_SECURE: "true",
  ANON_CLAIM_HANDOFF_SECRET: "a-long-random-secret",
  BILLING_LIVE_PRODUCTS: "",
} as const;

describe("connected beta runtime safety", () => {
  it("does not change development or migration runtimes unless enabled", () => {
    expect(getConnectedBetaRuntimeIssues({})).toEqual([]);
  });

  it("accepts a complete provider-neutral runtime with billing closed", () => {
    expect(
      getConnectedBetaRuntimeIssues(validConnectedBetaEnvironment),
    ).toEqual([]);
    expect(() =>
      assertConnectedBetaRuntime(validConnectedBetaEnvironment),
    ).not.toThrow();
  });

  it("fails closed instead of accepting unsafe fallbacks", () => {
    const issues = getConnectedBetaRuntimeIssues({
      CONNECTED_BETA: "true",
      NODE_ENV: "development",
      PORT: "not-a-port",
      ISSUER_URL: "https://replit.com/oidc",
      COOKIE_SECURE: "false",
      ALLOW_DEV_AUTH: "true",
      REPL_ID: "legacy-client",
      BILLING_LIVE_PRODUCTS: "signal-audit",
    });

    expect(issues).toContain("NODE_ENV must be production");
    expect(issues).toContain("PORT must be a positive integer");
    expect(issues).toContain(
      "ISSUER_URL cannot use the retired Replit provider",
    );
    expect(issues).toContain("COOKIE_SECURE must be true");
    expect(issues).toContain("ALLOW_DEV_AUTH cannot be enabled");
    expect(issues).toContain("legacy Replit runtime fallbacks must be removed");
    expect(issues).toContain("BILLING_LIVE_PRODUCTS must remain empty");
  });

  it("requires the public web origin in the exact allowlist", () => {
    expect(
      getConnectedBetaRuntimeIssues({
        ...validConnectedBetaEnvironment,
        ALLOWED_ORIGINS: "https://other.example.com",
      }),
    ).toContain("ALLOWED_ORIGINS must include WEB_PUBLIC_URL exactly");
  });

  it("requires both non-production mode and explicit dev auth", () => {
    expect(
      isDevAuthEnabled({ NODE_ENV: "development", ALLOW_DEV_AUTH: "true" }),
    ).toBe(true);
    expect(isDevAuthEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      isDevAuthEnabled({ NODE_ENV: "production", ALLOW_DEV_AUTH: "true" }),
    ).toBe(false);
  });

  it("never includes configured values in the thrown error", () => {
    const secret = "super-secret-database-value";
    expect(() =>
      assertConnectedBetaRuntime({
        CONNECTED_BETA: "true",
        DATABASE_URL: secret,
      }),
    ).toThrow();
    try {
      assertConnectedBetaRuntime({
        CONNECTED_BETA: "true",
        DATABASE_URL: secret,
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
