import crypto from "crypto";

/**
 * Signed OAuth `state` for per-user consumer connectors.
 *
 * The OAuth authorization-code flow round-trips a `state` value through the
 * provider back to our callback. We use it for two things at once:
 *  - CSRF protection: the callback rejects any state we did not sign.
 *  - Identity binding: the state carries the id of the user who started the
 *    flow, and the callback requires that `req.user.id` matches it, so a
 *    provider redirect can only ever attach an account to the same signed-in
 *    user who initiated it (never graft one person's Strava onto another).
 *
 * The envelope is HMAC-SHA256 signed (same secret shape as the handoff token)
 * and short-lived, so a stale or forged state cannot complete a connection.
 */

export const OAUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

function getSigningSecret(): string {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit) return explicit;
  const replId = process.env.REPL_ID?.trim();
  if (replId) return `nldc-oauth-state:${replId}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_STATE_SECRET (or REPL_ID) must be set to sign OAuth state",
    );
  }
  return "nldc-oauth-state-dev-insecure";
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

interface StatePayload {
  u: string;
  p: string;
  exp: number;
  nonce: string;
}

export interface VerifiedOAuthState {
  userId: string;
  provider: string;
  nonce: string;
  expiresAt: Date;
}

export function signOAuthState(
  userId: string,
  provider: string,
  ttlMs: number = OAUTH_STATE_DEFAULT_TTL_MS,
): string {
  if (!userId || !provider) {
    throw new Error("signOAuthState requires a userId and provider");
  }
  const payload: StatePayload = {
    u: userId,
    p: provider,
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: unknown): VerifiedOAuthState | null {
  if (typeof state !== "string" || state.length === 0 || state.length > 4096) {
    return null;
  }
  const dot = state.indexOf(".");
  if (dot <= 0 || dot === state.length - 1) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  const expected = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as StatePayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.u !== "string" ||
    typeof payload.p !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string"
  ) {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return {
    userId: payload.u,
    provider: payload.p,
    nonce: payload.nonce,
    expiresAt: new Date(payload.exp),
  };
}
