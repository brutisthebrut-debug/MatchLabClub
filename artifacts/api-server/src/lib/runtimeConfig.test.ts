import { describe, expect, it } from "vitest";
import {
  buildAllowedOrigins,
  getOidcClientId,
  getOidcIssuerUrl,
} from "./runtimeConfig";

describe("runtime configuration", () => {
  it("requires an explicit provider-neutral OIDC issuer", () => {
    expect(
      getOidcIssuerUrl({ ISSUER_URL: "https://identity.matchlab.club" }),
    ).toBe("https://identity.matchlab.club/");
    expect(() => getOidcIssuerUrl({})).toThrow(
      "ISSUER_URL environment variable is required.",
    );
  });

  it("rejects insecure or ambiguous OIDC issuer URLs", () => {
    expect(() =>
      getOidcIssuerUrl({ ISSUER_URL: "http://identity.matchlab.club" }),
    ).toThrow("ISSUER_URL must be a valid HTTPS URL.");
    expect(() =>
      getOidcIssuerUrl({
        ISSUER_URL: "https://identity.matchlab.club?tenant=unexpected",
      }),
    ).toThrow("ISSUER_URL must be a valid HTTPS URL.");
  });

  it("prefers the provider-neutral OIDC client id", () => {
    expect(
      getOidcClientId({
        OIDC_CLIENT_ID: "generic-client",
        REPL_ID: "legacy-client",
      }),
    ).toBe("generic-client");
  });

  it("keeps the legacy client id only as a rollout fallback", () => {
    expect(getOidcClientId({ REPL_ID: "legacy-client" })).toBe(
      "legacy-client",
    );
  });

  it("fails clearly when no OIDC client id is configured", () => {
    expect(() => getOidcClientId({})).toThrow(
      "OIDC_CLIENT_ID environment variable is required.",
    );
  });

  it("accepts exact HTTPS origins from ALLOWED_ORIGINS", () => {
    expect(
      [...buildAllowedOrigins({
        ALLOWED_ORIGINS:
          "https://app.matchlab.club, https://preview.matchlab.club/",
      })],
    ).toEqual([
      "https://app.matchlab.club",
      "https://preview.matchlab.club",
    ]);
  });

  it("ignores malformed or insecure generic origins", () => {
    expect(
      [...buildAllowedOrigins({
        ALLOWED_ORIGINS:
          "http://app.matchlab.club,not-a-url,https://app.matchlab.club/path",
      })],
    ).toEqual([]);
  });

  it("preserves legacy domain fallbacks during rollout", () => {
    expect(
      [...buildAllowedOrigins({
        REPLIT_DOMAINS: "legacy.example.com",
        REPLIT_EXPO_DEV_DOMAIN: "mobile.example.com",
      })],
    ).toEqual([
      "https://legacy.example.com",
      "https://mobile.example.com",
    ]);
  });
});
