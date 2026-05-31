import crypto from "crypto";
import type { Request, Response } from "express";

export const ANON_CLAIM_COOKIE = "anon_claim";
const ANON_CLAIM_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Why SameSite=None is intentional, and CSRF mitigations in place
 * -----------------------------------------------------------------
 * The mobile app (React Native / Expo) makes cross-origin requests to the API.
 * Using SameSite=Lax would prevent the cookie from being sent on those
 * requests, breaking the anonymous-to-authenticated claim flow on mobile.
 * SameSite=None (with Secure) lets the cookie travel cross-origin.
 *
 * Three layers of defence ensure SameSite=None does not open CSRF risk:
 *
 * Layer 1, CORS allowlist (app.ts)
 *   The CORS middleware uses an explicit allowlist built from REPLIT_DOMAINS
 *   and REPLIT_EXPO_DEV_DOMAIN. Arbitrary third-party origins are refused.
 *
 * Layer 2, Origin-checking CSRF middleware (app.ts)
 *   For every non-safe method (POST/PUT/PATCH/DELETE), if the browser sends
 *   an Origin header that is not in the allowlist the request is rejected with
 *   403 before any route handler runs. Requests without an Origin header
 *   (native mobile app, server-to-server, curl) are allowed through, they
 *   cannot be triggered by a browser-based CSRF attack.
 *
 * Layer 3, token-scoped anonymous ownership (routes)
 *   All routes that read or mutate anonymous data scope their queries by BOTH
 *   `userId IS NULL` AND `anonymous_claim_token = <token>` (or return
 *   sql`false` when no token is present). This means a CSRF-forced request
 *   can only operate on rows already tagged with the victim's own token; the
 *   attacker gains nothing. Audits use ownerScope(); profiles, messages,
 *   insights, and coachFollowUps all use the same pattern.
 *
 * Route-level notes:
 *   POST /claim-anonymous          , also gated by req.user?.id
 *   POST /claim-anonymous/handoff/issue, no auth required, but response body
 *     is protected from cross-origin reads by CORS + SOP, and the token is
 *     short-lived (15 min); Layer 2 guards against forged POSTs here too.
 *   POST /claim-anonymous/handoff/redeem, requires req.user?.id AND the
 *     handoff token in the JSON request body (not the cookie).
 */
function setCookie(res: Response, value: string): void {
  res.cookie(ANON_CLAIM_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: ANON_CLAIM_TTL,
  });
}

export function getAnonClaimToken(req: Request): string | undefined {
  const raw = req.cookies?.[ANON_CLAIM_COOKIE];
  if (typeof raw !== "string") return undefined;
  return /^[a-f0-9]{32,128}$/.test(raw) ? raw : undefined;
}

export function getOrCreateAnonClaimToken(req: Request, res: Response): string {
  const existing = getAnonClaimToken(req);
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString("hex");
  setCookie(res, token);
  return token;
}

export function clearAnonClaimToken(res: Response): void {
  res.clearCookie(ANON_CLAIM_COOKIE, { path: "/" });
}
