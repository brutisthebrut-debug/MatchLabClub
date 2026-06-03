import crypto from "crypto";

/**
 * Signed invite links for the Wingman loop.
 *
 * The owner mints a link for a friend; the friend opens it with no account and
 * submits five 1-5 trait scores. The link is an HMAC-signed envelope around the
 * invite's id, mirroring the anonymous-claim handoff token: forgery requires
 * the server secret, so a stranger cannot guess another person's invite, and
 * the token is time-limited. Single-use is enforced by the invite's answeredAt
 * stamp server-side, so a replayed link cannot add a second answer.
 */

export const WINGMAN_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSigningSecret(): string {
  const explicit = process.env.WINGMAN_INVITE_SECRET?.trim();
  if (explicit) return explicit;
  const replId = process.env.REPL_ID?.trim();
  if (replId) return `nldc-wingman:${replId}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "WINGMAN_INVITE_SECRET (or REPL_ID) must be set to sign wingman invite tokens",
    );
  }
  return "nldc-wingman-dev-insecure";
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

interface WingmanPayload {
  i: number;
  exp: number;
}

export interface IssuedWingmanToken {
  token: string;
  expiresAt: string;
}

export interface VerifiedWingmanToken {
  inviteId: number;
  expiresAt: Date;
}

export function signWingmanToken(
  inviteId: number,
  ttlMs: number = WINGMAN_DEFAULT_TTL_MS,
): IssuedWingmanToken {
  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    throw new Error("Invalid invite id");
  }
  const exp = Date.now() + ttlMs;
  const payload: WingmanPayload = { i: inviteId, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    crypto.createHmac("sha256", getSigningSecret()).update(body).digest(),
  );
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyWingmanToken(token: unknown): VerifiedWingmanToken | null {
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

  let payload: WingmanPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as WingmanPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.i !== "number" ||
    !Number.isInteger(payload.i) ||
    payload.i <= 0 ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return { inviteId: payload.i, expiresAt: new Date(payload.exp) };
}
