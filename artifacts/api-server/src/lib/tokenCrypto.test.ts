import { describe, it, expect } from "vitest";
import { sealToken, openToken } from "./tokenCrypto";
import { signOAuthState, verifyOAuthState } from "./oauthState";

describe("tokenCrypto", () => {
  it("round-trips a token through seal and open", () => {
    const secret = "strava-access-token-abc123";
    const sealed = sealToken(secret);
    expect(sealed).not.toContain(secret);
    expect(openToken(sealed)).toBe(secret);
  });

  it("produces a fresh nonce so identical tokens seal differently", () => {
    const a = sealToken("same-token");
    const b = sealToken("same-token");
    expect(a).not.toBe(b);
    expect(openToken(a)).toBe("same-token");
    expect(openToken(b)).toBe("same-token");
  });

  it("returns null for tampered, malformed, or empty ciphertext", () => {
    const sealed = sealToken("token-value");
    const parts = sealed.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}x`;
    expect(openToken(tampered)).toBeNull();
    expect(openToken("not-a-sealed-token")).toBeNull();
    expect(openToken("")).toBeNull();
    expect(openToken(null)).toBeNull();
    expect(openToken(undefined)).toBeNull();
  });

  it("rejects an unknown version prefix", () => {
    const sealed = sealToken("token-value");
    const parts = sealed.split(".");
    expect(openToken(`v2.${parts[1]}.${parts[2]}.${parts[3]}`)).toBeNull();
  });

  it("refuses to seal an empty token", () => {
    expect(() => sealToken("")).toThrow();
  });
});

describe("oauthState", () => {
  it("round-trips userId and provider through sign and verify", () => {
    const state = signOAuthState("user-123", "strava");
    const verified = verifyOAuthState(state);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user-123");
    expect(verified?.provider).toBe("strava");
    expect(verified?.nonce).toMatch(/^[a-f0-9]{24}$/);
  });

  it("issues a fresh nonce per call", () => {
    const a = signOAuthState("user-123", "fitbit");
    const b = signOAuthState("user-123", "fitbit");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered or forged state", () => {
    const state = signOAuthState("user-123", "strava");
    const [body] = state.split(".");
    expect(verifyOAuthState(`${body}.deadbeef`)).toBeNull();
    expect(verifyOAuthState("garbage")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
  });

  it("rejects an expired state", () => {
    const state = signOAuthState("user-123", "exist", -1000);
    expect(verifyOAuthState(state)).toBeNull();
  });

  it("requires a userId and provider to sign", () => {
    expect(() => signOAuthState("", "strava")).toThrow();
    expect(() => signOAuthState("user-123", "")).toThrow();
  });
});
