import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  createSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import {
  DEV_TEST_USERS,
  isDevEnvironment,
  seedTestUser,
  type TestUserState,
} from "../lib/devSeed";

/**
 * Development-only test-user preview.
 *
 * Lets the founder sign in as a seeded test account and walk the genuinely
 * populated product (not demo fallback), and flip between a brand-new-user
 * state and a power-user state for walkthroughs.
 *
 * SECURITY: this is an auth bypass and must never be reachable in production.
 * Two independent guards enforce that:
 *   1. The router is only mounted when `isDevEnvironment()` is true (see
 *      routes/index.ts).
 *   2. Every handler re-checks `isDevEnvironment()` and 404s otherwise, so even
 *      a misconfigured mount cannot expose it in production.
 */

const router: IRouter = Router();

/** Block the whole router in production, regardless of how it was mounted. */
router.use((_req: Request, res: Response, next): void => {
  if (!isDevEnvironment()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
});

function parseState(value: unknown): TestUserState {
  return value === "power" ? "power" : value === "new" ? "new" : "power";
}

function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function renderIndexPage(): string {
  const rows = (Object.keys(DEV_TEST_USERS) as TestUserState[])
    .map((state) => {
      const u = DEV_TEST_USERS[state];
      const title =
        state === "power"
          ? "Power user (fully populated)"
          : "Brand-new user (no signals)";
      const desc =
        state === "power"
          ? "Realistic signal across every readiness lane. The machine has plenty to work with."
          : "A clean account with zero signals, exactly what a first-time user sees.";
      return `
        <li class="card">
          <h2>${title}</h2>
          <p class="who">${u.firstName} ${u.lastName} &middot; ${u.email}</p>
          <p class="desc">${desc}</p>
          <a class="btn" href="/api/dev/login?state=${state}&returnTo=/">Sign in as this user</a>
        </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Test user preview (dev only)</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 2.5rem 1.5rem; background: #0f1115; color: #e7e9ee; }
    .wrap { max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
    .lede { color: #9aa3b2; margin: 0 0 2rem; line-height: 1.5; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
    .card { background: #171a21; border: 1px solid #262b36; border-radius: 14px; padding: 1.25rem 1.25rem 1.4rem; }
    .card h2 { font-size: 1.1rem; margin: 0 0 .4rem; }
    .who { font-size: .85rem; color: #7f8a9c; margin: 0 0 .6rem; }
    .desc { color: #c2c8d3; margin: 0 0 1rem; line-height: 1.45; }
    .btn { display: inline-block; background: #5b8cff; color: #0b0d12; text-decoration: none; font-weight: 600; padding: .6rem 1rem; border-radius: 10px; }
    .btn:hover { background: #769dff; }
    .foot { margin-top: 2rem; font-size: .8rem; color: #6b7484; line-height: 1.5; }
    .foot a { color: #9aa3b2; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Test user preview</h1>
    <p class="lede">Development only. Sign in as a seeded account to walk the real, populated product instead of demo fallback data. Each sign-in rebuilds that account's signals from scratch, so you always land on a known state.</p>
    <ul>${rows}</ul>
    <p class="foot">Signed in already? <a href="/api/dev/logout">Sign out</a>. This page is never reachable in production.</p>
  </div>
</body>
</html>`;
}

router.get("/dev", (_req: Request, res: Response): void => {
  res.type("html").send(renderIndexPage());
});

router.get("/dev/login", async (req: Request, res: Response): Promise<void> => {
  const state = parseState(req.query.state);
  const returnTo = safeReturnTo(req.query.returnTo);

  let profile;
  try {
    profile = await seedTestUser(state);
  } catch (err) {
    req.log.error({ err, state }, "Dev test-user seed failed");
    res.status(500).json({ error: "Seeding the test user failed." });
    return;
  }

  const [persistedUser] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, profile.id))
    .limit(1);

  // Replace any existing session so switching states is clean.
  const existing = getSessionId(req);
  if (existing) await clearSession(res, existing);

  const sessionData: SessionData = {
    user: {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImageUrl: null,
      role:
        persistedUser?.role === "founder" || persistedUser?.role === "admin"
          ? persistedUser.role
          : "member",
    },
    // Dev sessions carry no real OIDC tokens. No expires_at means the auth
    // middleware never tries to refresh them; the session simply lives for the
    // normal SESSION_TTL like any other.
    access_token: "dev-test-login",
  };

  const sid = await createSession(sessionData, {
    userAgent: (req.headers["user-agent"] as string) || "dev-test-login",
    ip: req.ip ?? null,
    channel: "web",
  });
  setSessionCookie(res, sid);

  res.redirect(returnTo);
});

router.get("/dev/logout", async (req: Request, res: Response): Promise<void> => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/api/dev");
});

export default router;
