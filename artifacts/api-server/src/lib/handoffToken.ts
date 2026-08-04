import crypto from "crypto";
import { deriveAppSecret } from "./appSecrets";

/**
 * Cross-device handoff for anonymous claim tokens.
 *
 * The default claim flow ties an anonymous audit to the browser that created
 * it via the `anon_claim` cookie. That breaks when the user switches devices
 * (started on phone, signs up on laptop) or clears cookies before signing in.
 *
 * A handoff token is a short-lived, HMAC-signed envelope around the
 * anonymous-browser token. The original browser can mint one while still
 * anonymous, hand the link to themselves on another device, and the receiving
 * browser can redeem it after signing in, without ever needing the original
 * `anon_claim` cookie.
 *
 * Security properties:
 *  - Signed with HMAC-SHA256 using a server-side secret. Forgery requires the
 *    secret, so a redeemer cannot guess another anonymous user's token.
 *  - Time-limited (default 15 minutes).
 *  - Carries no DB ids, only the anonymous claim token; redemption still goes
 *    through the same token-scoped UPDATE used by the cookie path, so it can
 *    only touch rows tagged with the same anonymous token.
 *  - Single-use server-side: every issued token carries a random `jti` and
 *    the redeem route records seen `jti`s in `handoff_token_redemptions`, so
 *    a leaked token literally cannot be redeemed twice, even if the original
 *    browser kept creating new anonymous rows under the same anon token.
 */

export const HANDOFF_DEFAULT_TTL_MS = 15 * 60 * 1000;

function getSigningSecret(): string {
  return deriveAppSecret("anonymous-handoff");
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

interface HandoffPayload {
  t: string;
  exp: number;
  jti: string;
}

export interface IssuedHandoff {
  token: string;
  expiresAt: string;
  jti: string;
}

export interface VerifiedHandoff {
  anonToken: string;
  jti: string;
  expiresAt: Date;
}

export function signHandoffToken(
  anonToken: string,
  ttlMs: number = HANDOFF_DEFAULT_TTL_MS,
): IssuedHandoff {
  if (!/^[a-f0-9]{32,128}$/.test(anonToken)) {
    throw new Error("Invalid anonymous claim token");
  }
  const exp = Date.now() + ttlMs;
  const jti = crypto.randomBytes(16).toString("hex");
  const payload: HandoffPayload = { t: anonToken, exp, jti };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
    jti,
  };
}

export function verifyHandoffToken(token: unknown): VerifiedHandoff | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return null;
  }
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as HandoffPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.t !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string"
  ) {
    return null;
  }
  if (!/^[a-f0-9]{32,128}$/.test(payload.t)) return null;
  if (!/^[a-f0-9]{16,128}$/.test(payload.jti)) return null;
  if (payload.exp < Date.now()) return null;
  return {
    anonToken: payload.t,
    jti: payload.jti,
    expiresAt: new Date(payload.exp),
  };
}
