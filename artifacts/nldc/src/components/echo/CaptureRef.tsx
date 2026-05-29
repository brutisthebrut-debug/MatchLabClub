import { useEffect } from "react";

/**
 * Echo referral-capture mount. Reads `?ref=...` from the URL on first paint,
 * drops it in a long-lived `mlc_ref` cookie + localStorage so it survives
 * navigation, page reloads, and the OIDC round-trip. On signup, the server
 * reads `mlc_ref` and writes `users.invited_by_user_id` + a `referrals` row.
 *
 * Idempotent: if the cookie already has a value, an empty/different `?ref`
 * doesn't clobber it (first-touch attribution wins, which matches Echo's
 * "the share that brought them here" model).
 */
const COOKIE_NAME = "mlc_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const STORAGE_KEY = "mlc_ref";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function CaptureRef(): null {
  useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;
  const existing = readCookie(COOKIE_NAME);
  if (existing) return; // First-touch wins.
  writeCookie(COOKIE_NAME, ref);
  try {
  window.localStorage.setItem(STORAGE_KEY, ref);
  } catch {
  // private mode / quota / disabled, cookie still wins.
  }
  }, []);
  return null;
}
