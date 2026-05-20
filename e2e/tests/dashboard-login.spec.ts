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

  await page.route("**/api/audits**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

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
