import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import { notifySignInIfNew, extractClientIp } from "../lib/loginNotifications";
import { getOidcClientId } from "../lib/runtimeConfig";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

// Server-side bootstrap only. Once a user is promoted, the database role is
// authoritative and is not downgraded if this configuration later changes.
const FOUNDER_EMAILS = new Set(
  (process.env.FOUNDER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const router: IRouter = Router();

function authRole(role: string): "member" | "founder" | "admin" {
  return role === "founder" || role === "admin" ? role : "member";
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

async function upsertUser(
  claims: Record<string, unknown>,
  refCookie?: string | null,
) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };
  const isBootstrapFounder = Boolean(
    userData.email && FOUNDER_EMAILS.has(userData.email.trim().toLowerCase()),
  );

  // Parse Echo referral cookie (`mlc_ref=user-<inviterId>` or just `<inviterId>`).
  // First-touch attribution, only set on row INSERT, never overwritten.
  let inviterId: string | null = null;
  if (refCookie) {
    const stripped = refCookie.startsWith("user-")
      ? refCookie.slice(5)
      : refCookie;
    if (stripped && stripped.length <= 64 && stripped !== userData.id) {
      inviterId = stripped;
    }
  }

  const insertValues = inviterId
    ? {
        ...userData,
        role: isBootstrapFounder ? "founder" : "member",
        invitedByUserId: inviterId,
        invitedAt: new Date(),
      }
    : {
        ...userData,
        role: isBootstrapFounder ? "founder" : "member",
      };

  const [user] = await db
    .insert(usersTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: usersTable.id,
      // Intentionally do NOT touch invited_by_user_id / invited_at on conflict
      //, first-touch attribution wins, returning users keep their original.
      set: {
        ...userData,
        ...(isBootstrapFounder ? { role: "founder" } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  // Record the attributed signup in the referrals table so both the founder
  // analytics views and the inviter's own "who you pulled in" reflection have
  // real data. We key off the persisted `invitedByUserId` (first-touch, never
  // overwritten) rather than the raw cookie. The unique index on
  // `invitee_user_id` plus `onConflictDoNothing` guarantees exactly one row per
  // invitee even if two sign-in upserts race, so a returning user logging in
  // again (or a concurrent double sign-in) never duplicates attribution.
  if (user?.invitedByUserId && user.invitedByUserId !== user.id) {
    try {
      await db
        .insert(referralsTable)
        .values({
          inviterUserId: user.invitedByUserId,
          inviteeUserId: user.id,
          refCode: `user-${user.invitedByUserId}`,
          signedUpAt: user.invitedAt ?? new Date(),
        })
        .onConflictDoNothing({ target: referralsTable.inviteeUserId });
    } catch {
      // Attribution is best-effort. A failure here must never block sign-in;
      // `users.invitedByUserId` remains the authoritative attribution record.
    }
  }

  return user;
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }

  // The session carries a role for fast UI boot, but role changes must take
  // effect without waiting for the session to expire. The database is the
  // authority for both promotions and demotions.
  const [currentUser] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  res.json(
    GetCurrentAuthUserResponse.parse({
      user: currentUser
        ? { ...req.user, role: authRole(currentUser.role) }
        : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const stateNonce = oidc.randomState();
  // Embed returnTo inside the OIDC state parameter so it survives as a URL
  // query param on the callback. The return_to cookie (Secure/SameSite=Lax)
  // can be silently dropped by Chromium in the test runner's HTTP context or
  // after a cross-origin redirect; the state param is not subject to that
  // restriction and is always echoed back verbatim by every OIDC provider
  // (including the Replit testing fake issuer). Format: "<nonce>:<returnTo>".
  //
  // IMPORTANT: returnTo is embedded RAW (not encodeURIComponent'd). Using
  // encodeURIComponent causes a double-encoding problem: the OIDC provider
  // echoes the state back without re-encoding it, so Express URL-decodes
  // "%2F" to "/" when parsing req.query.state. This makes the CSRF state
  // check fail (cookie stores "%2F" but the URL has "/"), breaking the flow.
  // The raw path is safe because getSafeReturnTo guarantees it starts with "/"
  // and contains no colons, so the separator ":" is unambiguous.
  const state = `${stateNonce}:${returnTo}`;
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  // return_to cookie kept as a secondary fallback for cases where the state
  // param is unavailable (e.g. provider strips unknown state characters).
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  // Primary: extract returnTo from the echoed state URL param, resilient to
  // Secure-cookie drops in the Playwright test environment (see /login above).
  // Secondary fallback: return_to cookie (works in production browsers).
  // The state format is "<nonce>:<returnTo>" with the raw path (no extra
  // URI-encoding) so we read it directly without decodeURIComponent.
  let returnTo = getSafeReturnTo(req.cookies?.return_to);
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";
  const colonIdx = stateParam.indexOf(":");
  if (colonIdx >= 0) {
    const embedded = getSafeReturnTo(stateParam.slice(colonIdx + 1));
    if (embedded !== "/") returnTo = embedded;
  }

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
    (req.cookies?.mlc_ref as string | undefined) ?? null,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      role: authRole(dbUser.role),
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const userAgent = (req.headers["user-agent"] as string) || "";
  const ip = extractClientIp(req.headers as Record<string, unknown>, req.ip);
  const sid = await createSession(sessionData, {
    userAgent,
    ip,
    channel: "web",
  });
  setSessionCookie(res, sid);

  try {
    await notifySignInIfNew({
      userId: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      ip,
      userAgent,
      channel: "web",
    });
  } catch (err) {
    req.log.error({ err, userId: dbUser.id }, "Sign-in notification failed");
  }

  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: getOidcClientId(),
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce, push_token } =
      parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
        (req.cookies?.mlc_ref as string | undefined) ?? null,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
          role: authRole(dbUser.role),
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const userAgent = (req.headers["user-agent"] as string) || "";
      const ip = extractClientIp(
        req.headers as Record<string, unknown>,
        req.ip,
      );
      const sid = await createSession(sessionData, {
        userAgent,
        ip,
        channel: "mobile",
      });

      try {
        await notifySignInIfNew({
          userId: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          ip,
          userAgent,
          channel: "mobile",
          excludePushToken: push_token ?? null,
        });
      } catch (err) {
        req.log.error(
          { err, userId: dbUser.id },
          "Sign-in notification failed",
        );
      }

      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
