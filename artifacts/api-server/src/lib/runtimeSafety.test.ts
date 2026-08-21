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
  APP_ORIGINS: "https://beta.matchlab.club",
  API_PUBLIC_URL: "https://api-beta.matchlab.club",
  WEB_PUBLIC_URL: "https://beta.matchlab.club",
  ISSUER_URL: "https://identity.example.com",
  OIDC_CLIENT_ID: "matchlab-beta",
  COOKIE_SECURE: "true",
  ANON_CLAIM_HANDOFF_SECRET: "a-long-random-secret",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_INSIGHT_MONTHLY: "price_insight_monthly",
  STRIPE_PRICE_INSIGHT_ANNUAL: "price_insight_annual",
  STRIPE_PRICE_MATCH_MONTHLY: "price_match_monthly",
  STRIPE_PRICE_MATCH_QUARTERLY: "price_match_quarterly",
} as const;

describe("connected beta runtime safety", () => {
  it("does not change existing development or migration runtimes unless enabled", () => {
    expect(getConnectedBetaRuntimeIssues({})).toEqual([]);
  });

  it("accepts a complete provider-neutral test-mode runtime", () => {
    expect(
      getConnectedBetaRuntimeIssues(validConnectedBetaEnvironment),
    ).toEqual([]);
    expect(() =>
      assertConnectedBetaRuntime(validConnectedBetaEnvironment),
    ).not.toThrow();
  });

  it("fails closed when beta configuration would use implicit or unsafe fallbacks", () => {
    const issues = getConnectedBetaRuntimeIssues({
      CONNECTED_BETA: "true",
      NODE_ENV: "development",
      PORT: "not-a-port",
      ISSUER_URL: "https://replit.com/oidc",
      COOKIE_SECURE: "false",
      ALLOW_DEV_AUTH: "true",
      STRIPE_ENABLE_GUIDED: "true",
    });

    expect(issues).toContain("NODE_ENV must be production");
    expect(issues).toContain("PORT must be a positive integer");
    expect(issues).toContain(
      "ISSUER_URL cannot use the Replit migration fallback",
    );
    expect(issues).toContain("COOKIE_SECURE cannot be false");
    expect(issues).toContain("ALLOW_DEV_AUTH cannot be enabled");
    expect(issues).toContain("STRIPE_ENABLE_GUIDED must remain disabled");
  });

  it("requires both non-production mode and an explicit development-auth flag", () => {
    expect(
      isDevAuthEnabled({ NODE_ENV: "development", ALLOW_DEV_AUTH: "true" }),
    ).toBe(true);
    expect(isDevAuthEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      isDevAuthEnabled({ NODE_ENV: "production", ALLOW_DEV_AUTH: "true" }),
    ).toBe(false);
  });
});
