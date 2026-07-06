import crypto from "crypto";

/**
 * Symmetric sealing for per-user OAuth credentials.
 *
 * Consumer connectors (Strava, Fitbit, Exist) authorize each end user
 * individually, so unlike the Replit-managed Google connection we hold their
 * access/refresh tokens ourselves. They are NEVER stored in the clear: every
 * token is sealed here with AES-256-GCM before it touches `oauth_tokens` and
 * unsealed only in-process at sync time.
 *
 * The 32-byte key is derived from `OAUTH_TOKEN_KEY` when set, otherwise from
 * `REPL_ID` (the same fallback shape the handoff token uses), so the feature
 * works in dev without configuration but demands an explicit key in production.
 *
 * Sealed format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url. The version
 * prefix lets the scheme rotate later without ambiguity.
 */

const SEAL_VERSION = "v1";

function getEncryptionKey(): Buffer {
  const explicit = process.env.OAUTH_TOKEN_KEY?.trim();
  if (explicit) return crypto.createHash("sha256").update(explicit).digest();
  const replId = process.env.REPL_ID?.trim();
  if (replId) {
    return crypto.createHash("sha256").update(`nldc-oauth:${replId}`).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_TOKEN_KEY (or REPL_ID) must be set to seal OAuth tokens",
    );
  }
  return crypto.createHash("sha256").update("nldc-oauth-dev-insecure").digest();
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

/** Seal a plaintext token. Returns an opaque, self-describing string. */
export function sealToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Cannot seal an empty token");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${SEAL_VERSION}.${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

/**
 * Unseal a token sealed by `sealToken`. Returns null for any malformed,
 * wrong-version, or tampered input (GCM auth failure), so callers can treat a
 * corrupt or key-rotated credential as "no token" rather than crashing.
 */
export function openToken(sealed: unknown): string | null {
  if (typeof sealed !== "string" || sealed.length === 0) return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== SEAL_VERSION) return null;
  try {
    const iv = b64urlDecode(parts[1]);
    const tag = b64urlDecode(parts[2]);
    const ciphertext = b64urlDecode(parts[3]);
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
