import { test, expect } from "@playwright/test";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

let pool: pg.Pool;
let testSid: string;
const TEST_USER_ID = `e2e-handoff-${crypto.randomBytes(6).toString("hex")}`;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  testSid = crypto.randomBytes(32).toString("hex");

  // Insert a minimal session row so the auth middleware authenticates the
  // POST request below. auth.ts reads the user object from the sess JSON,
  // not via a JOIN, so no matching users row is required.
  const sessJson = JSON.stringify({
    user: {
      id: TEST_USER_ID,
      email: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    },
    access_token: "e2e-test-access-token",
  });
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, NOW() + INTERVAL '1 hour', $3)`,
    [testSid, sessJson, TEST_USER_ID],
  );
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM sessions WHERE sid = $1`, [testSid]);
  await pool.end();
});

test(
  "handoff expired-token page: Link expired badge, handoff heading, and CTA render correctly in browser",
  async ({ page, request }) => {
    // POST as an authenticated browser with Accept: text/html and a garbage
    // handoff token. The server verifies the token, finds it invalid, and
    // returns a 410 HTML expired-link page.
    const response = await request.post(
      "/api/claim-anonymous/handoff/redeem",
      {
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*",
          Cookie: `sid=${testSid}`,
        },
        data: { handoff: "not-a-real-token" },
      },
    );

    expect(response.status()).toBe(410);
    expect(response.headers()["content-type"]).toMatch(/text\/html/);

    const html = await response.text();

    // Load the server-returned HTML into a real Chromium browser so the
    // assertions verify actual rendered content, not just raw text matching.
    await page.setContent(html, { waitUntil: "load" });

    // Badge
    const badge = page.locator(".badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Link expired");

    // Handoff-specific heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("hand-off link");

    // CTA button
    const cta = page.locator("a.cta");
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Back to Next Level Dating Club");
  },
);

test(
  "handoff expired-token page: Sec-Fetch-Mode navigate header also triggers browser HTML page",
  async ({ page, request }) => {
    // Browsers set Sec-Fetch-Mode: navigate on direct URL navigations even
    // when they don't include a specific Accept header. Verify the same
    // expired-link page is returned in that case.
    const response = await request.post(
      "/api/claim-anonymous/handoff/redeem",
      {
        headers: {
          "Sec-Fetch-Mode": "navigate",
          Cookie: `sid=${testSid}`,
        },
        data: { handoff: "garbage-token" },
      },
    );

    expect(response.status()).toBe(410);
    const html = await response.text();

    await page.setContent(html, { waitUntil: "load" });

    await expect(page.locator(".badge")).toContainText("Link expired");
    await expect(page.locator("h1")).toContainText("hand-off link");
    await expect(page.locator("a.cta")).toContainText(
      "Back to Next Level Dating Club",
    );
  },
);
