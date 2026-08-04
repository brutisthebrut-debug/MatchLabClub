import { describe, expect, it } from "vitest";
import { buildAllowedOrigins } from "./allowedOrigins";

describe("buildAllowedOrigins", () => {
  it("accepts explicit beta and local web origins", () => {
    const origins = buildAllowedOrigins({
      APP_ORIGINS:
        "https://beta.matchlab.club, http://localhost:3000/,not-a-url",
      REPLIT_DOMAINS: undefined,
      REPLIT_EXPO_DEV_DOMAIN: undefined,
    });

    expect([...origins]).toEqual([
      "https://beta.matchlab.club",
      "http://localhost:3000",
    ]);
  });

  it("preserves existing Replit web and Expo origins", () => {
    const origins = buildAllowedOrigins({
      APP_ORIGINS: undefined,
      REPLIT_DOMAINS: "matchlab.replit.app, preview.replit.dev",
      REPLIT_EXPO_DEV_DOMAIN: "expo.replit.dev",
    });

    expect(origins).toEqual(
      new Set([
        "https://matchlab.replit.app",
        "https://preview.replit.dev",
        "https://expo.replit.dev",
      ]),
    );
  });

  it("never turns invalid or non-http entries into trusted origins", () => {
    const origins = buildAllowedOrigins({
      APP_ORIGINS: "*,javascript:alert(1),file:///tmp/matchlab",
      REPLIT_DOMAINS: undefined,
      REPLIT_EXPO_DEV_DOMAIN: undefined,
    });

    expect(origins.size).toBe(0);
  });
});
