import { describe, expect, it } from "vitest";
import {
  normalizeHttpOrigin,
  resolveOidcClientId,
  resolveOidcIssuer,
  resolvePublicApiOrigin,
  resolvePublicWebOrigin,
  useSecureSessionCookies,
} from "./runtimeConfig";

describe("portable runtime configuration", () => {
  it("uses explicit beta web and API origins", () => {
    expect(
      resolvePublicWebOrigin({
        WEB_PUBLIC_URL: "https://beta.matchlab.club/path",
      }),
    ).toBe("https://beta.matchlab.club");
    expect(
      resolvePublicApiOrigin({ API_PUBLIC_URL: "https://api.matchlab.club/" }),
    ).toBe("https://api.matchlab.club");
  });

  it("falls back to the first valid allowlisted web origin", () => {
    expect(
      resolvePublicWebOrigin({
        APP_ORIGINS: "javascript:alert(1), https://beta.matchlab.club/",
      }),
    ).toBe("https://beta.matchlab.club");
  });

  it("allows local HTTP but rejects insecure remote and credentialed URLs", () => {
    expect(normalizeHttpOrigin("http://localhost:3000/path")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeHttpOrigin("http://beta.matchlab.club")).toBeNull();
    expect(normalizeHttpOrigin("https://user:pass@example.com")).toBeNull();
  });

  it("prefers portable OIDC settings while preserving the Replit fallback", () => {
    expect(
      resolveOidcClientId({ OIDC_CLIENT_ID: "oidc-beta", REPL_ID: "replit" }),
    ).toBe("oidc-beta");
    expect(resolveOidcClientId({ REPL_ID: "replit" })).toBe("replit");
    expect(resolveOidcIssuer({ ISSUER_URL: "https://id.matchlab.club/" })).toBe(
      "https://id.matchlab.club",
    );
    expect(resolveOidcIssuer({})).toBe("https://replit.com/oidc");
  });

  it("keeps production cookies secure and allows explicit local test mode", () => {
    expect(useSecureSessionCookies({ NODE_ENV: "production" })).toBe(true);
    expect(
      useSecureSessionCookies({
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
      }),
    ).toBe(false);
  });
});
