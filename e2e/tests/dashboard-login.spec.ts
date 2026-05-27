/**
 * Dashboard login e2e tests
 *
 * Root cause & fix (documented here per task requirement):
 *
 * Problem: Navigating to `/dashboard` after OIDC login always renders the
 * landing page instead.  The OIDC callback handler read `returnTo` exclusively
 * from a `return_to` cookie (Secure + SameSite=Lax).  In Playwright's
 * Chromium context the cookie is silently dropped in two scenarios:
 *   1. The base URL is `http://localhost:80` (HTTP) — browsers discard
 *      `Secure`-flagged cookies on non-HTTPS origins (localhost IS a secure
 *      context per spec, but some Chromium builds / proxy configurations still
 *      drop it during cross-origin OIDC redirects).
 *   2. The Replit testing fake OIDC issuer overrides the redirect_uri back to
 *      the callback but does not guarantee the cross-origin cookie jar is
 *      preserved across the issuer ↔ app domain hop.
 *
 * Fix (artifacts/api-server/src/routes/auth.ts):
 *   The `returnTo` value is now **embedded inside the OIDC `state` parameter**
 *   as `"<randomNonce>:<encodedReturnTo>"`.  The state param is echoed verbatim
 *   in the callback URL by every compliant OIDC provider (including the Replit
 *   fake issuer), so the callback can always extract it from `req.query.state`
 *   regardless of cookie availability.  The `return_to` cookie is kept as a
 *   secondary fallback.
 *
 * Dashboard rendering notes:
 *   - Brand-new users (no audits / profiles / messages / insights) see a
 *     WelcomePanel with data-testid="dashboard-empty-state" instead of the
 *     score-ring — the score-ring requires at least one audit.
 *   - The hero landmark + "Your Dating Blueprint" heading are present on the
 *     Dashboard for all authenticated users and are absent from the Landing
 *     page, making them suitable smoke-test assertions.
 */

import { test, expect } from "@playwright/test";

const FAKE_USER = {
  id: "test-dashboard-user-01",
  email: "dashboard-test@example.com",
  firstName: "Dashboard",
  lastName: "Tester",
  profileImageUrl: null,
};

/**
 * Smoke test: /dashboard renders the authenticated welcome state when the
 * auth API reports a logged-in user.
 *
 * This test mocks the auth and data APIs so it does not depend on a live
 * database or OIDC provider — it purely verifies that:
 *   1. The Wouter route /dashboard resolves (not 404 / not Landing page).
 *   2. The Dashboard component mounts and renders its authenticated UI.
 *
 * For a brand-new user (no audits) the dashboard shows the
 * data-testid="dashboard-empty-state" welcome panel rather than the score-ring
 * (which requires at least one completed audit).
 */
test("dashboard renders authenticated UI when user is logged in", async ({
  page,
}) => {
  await page.route("**/api/auth/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: FAKE_USER }),
    }),
  );

  await page.route("**/api/audits/summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalAudits: 0,
        averageScore: 0,
        latestScore: 0,
        scoreHistory: [],
        topStrengths: [],
        topRisks: [],
      }),
    }),
  );

  // The trashed-audits banner endpoint must return the shape
  // { audits, retentionDays } — returning an empty array crashes the
  // dashboard on `expiringTrashedData.audits.length`.
  await page.route("**/api/audits/trash/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audits: [], retentionDays: 30 }),
    }),
  );

  await page.route("**/api/audits**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    // Defer to more specific routes registered above.
    if (url.includes("/audits/trash")) return route.fallback();
    if (url.includes("/audits/summary")) return route.fallback();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/profiles**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  // The "list coaching sessions" hook is generated at /api/messages, not
  // /api/message-coaching. Mocking the wrong path lets the real API server
  // answer (typically with a 401 redirect or empty), which can keep the
  // Dashboard's accountDataLoading gate true and hide the empty-state panel.
  await page.route("**/api/messages**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.route("**/api/insights**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.route("**/api/trash**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audits: [], retentionDays: 30 }),
    }),
  );

  await page.goto("/dashboard");

  // Brand-new users see the welcome/empty-state panel (no audits yet).
  // This element is present ONLY on the Dashboard — it never appears on Landing.
  await expect(page.locator('[data-testid="dashboard-empty-state"]')).toBeVisible({
    timeout: 20_000,
  });

  // The "Your Dating Blueprint" heading is always shown for authenticated
  // users on the Dashboard page.
  await expect(page.locator('h1')).toContainText("Your Dating Blueprint", {
    timeout: 5_000,
  });
});

/**
 * End-to-end coverage of the highest-value flow: complete the 5-step intake
 * wizard, submit an audit, then navigate to /dashboard and verify the real
 * score-ring (with a non-demo score) plus the new audit row are rendered.
 *
 * All network calls are mocked so the test does not depend on a live DB or
 * AI engine. The wizard UI is still driven through the real component —
 * clicks, typing, and step transitions all run as a real user would do them.
 */
test("submit audit through wizard, then /dashboard renders real score-ring and audit row", async ({
  page,
}) => {
  const NEW_AUDIT_ID = 4242;
  const NEW_AUDIT_SCORE = 73; // intentionally NOT the demo score (78)

  const newAudit = {
    id: NEW_AUDIT_ID,
    userId: FAKE_USER.id,
    anonymousClaimToken: null,
    firstName: "Wizard",
    age: 30,
    gender: "Man",
    orientation: "Straight",
    datingGoal: "find a relationship",
    currentApps: ["Hinge"],
    bio: "Software engineer who actually cooks. Looking for someone curious and kind.",
    prompts: null,
    recentMessageSample: null,
    photoCount: null,
    relationshipHistory: null,
    biggestChallenge: null,
    sourceApp: null,
    status: "complete",
    source: "manual",
    readinessScore: NEW_AUDIT_SCORE,
    report: null,
    reportGeneratedAt: null,
    previousReport: null,
    previousReadinessScore: null,
    previousReportGeneratedAt: null,
    rawOcrText: null,
    ocrCorrections: null,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };

  // Auth: logged in throughout the flow.
  await page.route("**/api/auth/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: FAKE_USER }),
    }),
  );

  // ── State that flips after the audit is created ───────────────────────────
  let auditCreated = false;

  // GET /api/audits/summary — empty before, populated after.
  await page.route("**/api/audits/summary", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const body = auditCreated
      ? {
          totalAudits: 1,
          averageScore: NEW_AUDIT_SCORE,
          latestScore: NEW_AUDIT_SCORE,
          scoreHistory: [{ date: "now", score: NEW_AUDIT_SCORE }],
          topStrengths: ["Specific bio"],
          topRisks: ["Add a second photo"],
        }
      : {
          totalAudits: 0,
          averageScore: 0,
          latestScore: 0,
          scoreHistory: [],
          topStrengths: [],
          topRisks: [],
        };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // Trashed-audits banner data — needs the shape { audits, retentionDays }.
  await page.route("**/api/audits/trash/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audits: [], retentionDays: 30 }),
    }),
  );

  // POST /api/audits → create, GET /api/audits → list (paginated or not).
  await page.route("**/api/audits**", (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // Fall back to more specific routes (registered earlier) for deeper
    // paths. NOTE: route.fallback() — not route.continue() — is what dispatches
    // to the next handler. route.continue() sends the request to the network.
    if (/\/audits\/\d+/.test(url)) return route.fallback();
    if (url.includes("/audits/summary")) return route.fallback();
    if (url.includes("/audits/trash")) return route.fallback();

    if (method === "POST") {
      auditCreated = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(newAudit),
      });
    }

    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(auditCreated ? [newAudit] : []),
      });
    }

    return route.continue();
  });

  // POST /api/audits/:id/generate → return the generated report.
  await page.route(`**/api/audits/${NEW_AUDIT_ID}/generate`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        readinessScore: NEW_AUDIT_SCORE,
        overallGrade: "B",
        strengths: ["Specific bio"],
        risks: ["Add a second photo"],
        bioAudit: "Solid.",
        bioRewrite: "Even better bio.",
        rewrittenBio: "Even better bio.",
        promptRewrites: [],
        rewrittenPrompts: [],
        photoGuidance: [],
        photoChecklist: [],
        actionPlan: [],
        messageReplies: [],
      }),
    }),
  );

  // GET /api/audits/:id (in case Report page fetches before we redirect away).
  await page.route(`**/api/audits/${NEW_AUDIT_ID}`, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(newAudit),
    });
  });
  await page.route(`**/api/audits/${NEW_AUDIT_ID}/versions`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ versions: [] }),
    }),
  );
  await page.route("**/api/engine/meta", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ engineVersion: "v1.0.0-e2e" }),
    }),
  );

  // Misc dashboard side-fetches — keep empty so dashboard renders cleanly.
  await page.route("**/api/profiles**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/message-coaching**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/insights**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/trash**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  // ── Step 1: name / age / gender ───────────────────────────────────────────
  await page.goto("/start");
  await page.locator('[data-testid="input-first-name"]').fill("Wizard");
  await page.locator('[data-testid="input-age"]').fill("30");
  await page.locator('[data-testid="button-gender-man"]').click();
  await page.locator('[data-testid="button-next"]').click();

  // ── Step 2: dating goal ───────────────────────────────────────────────────
  await page
    .locator('[data-testid="button-goal-find-a-relationship"]')
    .click();
  await page.locator('[data-testid="button-next"]').click();

  // ── Step 3: bio (must be > 20 chars) ──────────────────────────────────────
  await page
    .locator('[data-testid="textarea-bio"]')
    .fill(
      "Software engineer who actually cooks. Looking for someone curious and kind.",
    );
  await page.locator('[data-testid="button-next"]').click();

  // ── Step 4: optional message sample (which now bakes in the final summary) — submit
  await page.locator('[data-testid="button-generate-audit"]').click();

  // Wizard redirects to /report/:id once the report is generated.
  await page.waitForURL(`**/report/${NEW_AUDIT_ID}`, { timeout: 30_000 });
  expect(auditCreated).toBe(true);

  // ── Navigate to /dashboard and verify real (non-demo) data renders ────────
  await page.goto("/dashboard");

  const ring = page.locator('[data-testid="score-ring"]');
  await expect(ring).toBeVisible({ timeout: 20_000 });

  // The score-number child must show the real audit score, not the demo 78.
  await expect(page.locator('[data-testid="score-number"]')).toHaveText(
    String(NEW_AUDIT_SCORE),
    { timeout: 10_000 },
  );

  // The new audit must appear in the recent audits list.
  await expect(
    page.locator(`[data-testid="row-audit-${NEW_AUDIT_ID}"]`),
  ).toBeVisible({ timeout: 10_000 });

  // And the empty-state welcome panel must NOT be shown anymore.
  await expect(
    page.locator('[data-testid="dashboard-empty-state"]'),
  ).not.toBeVisible();
});

/**
 * Verifies that the /login endpoint embeds returnTo inside the OIDC state
 * parameter (the regression fix).  We inspect the redirect Location header
 * directly so this test does not require a live OIDC provider.
 */
test("GET /api/login?returnTo=/dashboard embeds returnTo in the state param", async ({
  request,
}) => {
  const response = await request.get("/api/login?returnTo=/dashboard", {
    maxRedirects: 0,
  });

  const location = response.headers()["location"] ?? "";
  expect(location).toBeTruthy();

  const url = new URL(location);
  const state = url.searchParams.get("state") ?? "";

  // State format after the fix: "<nonce>:<rawReturnTo>" — no extra encoding
  // so the value survives round-trips through OIDC providers that don't
  // re-encode the state param (avoiding double-decode mismatches).
  const colonIdx = state.indexOf(":");
  expect(colonIdx).toBeGreaterThan(0);

  const embeddedReturnTo = state.slice(colonIdx + 1);
  expect(embeddedReturnTo).toBe("/dashboard");
});
