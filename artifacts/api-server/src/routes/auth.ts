import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable, referralsTable } from "@workspace/db";
import {
  clearSession,
  getOidcClientId,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import {
  normalizeHttpOrigin,
  resolvePublicApiOrigin,
  resolvePublicWebOrigin,
  useSecureSessionCookies,
} from "../lib/runtimeConfig";
import { notifySignInIfNew, extractClientIp } from "../lib/loginNotifications";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function requestOrigin(req: Request): string {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(
    ",",
  )[0];
  const host = String(
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost",
  ).split(",")[0];
  return normalizeHttpOrigin(`${proto}://${host}`) ?? "http://localhost";
}

function apiOrigin(req: Request): string {
  return resolvePublicApiOrigin() ?? requestOrigin(req);
}

function webOrigin(req: Request): string {
  return resolvePublicWebOrigin() ?? apiOrigin(req);
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: useSecureSessionCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: useSecureSessionCookies(),
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
    firstName:
      (claims.first_name as string) || (claims.given_name as string) || null,
    lastName:
      (claims.last_name as string) || (claims.family_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

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
    ? { ...userData, invitedByUserId: inviterId, invitedAt: new Date() }
    : userData;

  const [user] = await db
    .insert(usersTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();

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
      // Attribution is best-effort and never blocks sign-in.
    }
  }

  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${apiOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);

  const stateNonce = oidc.randomState();
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
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${apiOrigin(req)}/api/callback`;

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

  res.redirect(`${webOrigin(req)}${returnTo}`);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const returnOrigin = webOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  try {
    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: getOidcClientId(),
      post_logout_redirect_uri: returnOrigin,
    });
    res.redirect(endSessionUrl.href);
  } catch {
    // Providers without an end-session endpoint still get a complete local
    // logout rather than failing the request.
    res.redirect(returnOrigin);
  }
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
