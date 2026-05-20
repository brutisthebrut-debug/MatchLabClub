import crypto from "crypto";

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
 * browser can redeem it after signing in — without ever needing the original
 * `anon_claim` cookie.
 *
 * Security properties:
 *  - Signed with HMAC-SHA256 using a server-side secret. Forgery requires the
 *    secret, so a redeemer cannot guess another anonymous user's token.
 *  - Time-limited (default 15 minutes).
 *  - Carries no DB ids, only the anonymous claim token; redemption still goes
 *    through the same token-scoped UPDATE used by the cookie path, so it can
 *    only touch rows tagged with the same anonymous token.
 *  - Single-use in practice: a successful claim nulls out the anonymous token
 *    on the affected rows, so replaying the handoff after redemption finds
 *    nothing to claim.
 */

export const HANDOFF_DEFAULT_TTL_MS = 15 * 60 * 1000;

function getSigningSecret(): string {
  const explicit = process.env.ANON_CLAIM_HANDOFF_SECRET?.trim();
  if (explicit) return explicit;
  const replId = process.env.REPL_ID?.trim();
  if (replId) return `nldc-handoff:${replId}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ANON_CLAIM_HANDOFF_SECRET (or REPL_ID) must be set to sign handoff tokens",
    );
  }
  return "nldc-handoff-dev-insecure";
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
}

export interface IssuedHandoff {
  token: string;
  expiresAt: string;
}

export function signHandoffToken(
  anonToken: string,
  ttlMs: number = HANDOFF_DEFAULT_TTL_MS,
): IssuedHandoff {
  if (!/^[a-f0-9]{32,128}$/.test(anonToken)) {
    throw new Error("Invalid anonymous claim token");
  }
  const exp = Date.now() + ttlMs;
  const payload: HandoffPayload = { t: anonToken, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyHandoffToken(token: unknown): string | null {
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
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (!/^[a-f0-9]{32,128}$/.test(payload.t)) return null;
  if (payload.exp < Date.now()) return null;
  return payload.t;
}
