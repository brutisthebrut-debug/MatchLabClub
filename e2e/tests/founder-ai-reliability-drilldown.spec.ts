import { test, expect } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;

const FOUNDER_KEY = process.env.VITE_FOUNDER_KEY ?? "nldc2024";

// Primary tool: seeded 35 days ago — visible in 90d/180d windows but NOT in 30d.
const TOOL_NAME = "E2E-ReliabilityDrillTest";
// Secondary tool: seeded yesterday — always visible; ensures the 30d chart
// isn't empty so the window-switch path is exercised cleanly.
const SECONDARY_TOOL_NAME = "E2E-ReliabilitySecondary";

let pool: pg.Pool;
let seededIds: number[] = [];

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const result = await pool.query<{ id: number }>(`
    INSERT INTO ai_request_metrics_daily
      (day, tool_name, total, first_try_ok, retried_ok, fallbacks,
       validation_failures, avg_attempts, avg_duration_ms)
    VALUES
      (
        (CURRENT_DATE - INTERVAL '35 days')::date,
        $1, 50, 40, 5, 5, 2, 1.2, 320.0
      ),
      (
        (CURRENT_DATE - INTERVAL '1 day')::date,
        $2, 30, 28, 1, 1, 0, 1.1, 210.0
      )
    ON CONFLICT ON CONSTRAINT ai_request_metrics_daily_day_tool_idx DO NOTHING
    RETURNING id
  `, [TOOL_NAME, SECONDARY_TOOL_NAME]);

  seededIds = result.rows.map((r) => r.id);
});

test.afterAll(async () => {
  if (seededIds.length > 0) {
    await pool.query(
      `DELETE FROM ai_request_metrics_daily WHERE id = ANY($1)`,
      [seededIds],
    );
  }
  await pool.end();
});

test("AI Reliability drill-in: selector, summary tiles, focused chart, and back button", async ({ page }) => {
  // ── 1. Navigate and sign in ──────────────────────────────────────────────
  await page.goto("/founder");

  const keyInput = page.locator('input[type="password"]');
  await expect(keyInput).toBeVisible();
  await keyInput.fill(FOUNDER_KEY);
  await page.locator('button:has-text("Unlock Dashboard")').click();

  // ── 2. Locate the AI Reliability Trends panel ────────────────────────────
  // It lives in the default "overview" tab — no tab click needed.
  const focusSelect = page.locator('[data-testid="select-trend-focus-tool"]');
  await expect(focusSelect).toBeVisible({ timeout: 20_000 });
  await focusSelect.scrollIntoViewIfNeeded();

  // ── 3. Wait for the seeded tool to appear in the 90d window (default) ───
  await expect(focusSelect.locator(`option[value="${TOOL_NAME}"]`)).toBeAttached({ timeout: 20_000 });

  // ── 4. Focus on the seeded tool via the selector ─────────────────────────
  await focusSelect.selectOption(TOOL_NAME);

  // ── 5. Assert the four summary tiles appear ──────────────────────────────
  const summaryTiles = page.locator('[data-testid="trend-focus-summary"]');
  await expect(summaryTiles).toBeVisible({ timeout: 10_000 });
  await expect(summaryTiles.locator('p:has-text("First-try %")')).toBeVisible();
  await expect(summaryTiles.locator('p:has-text("Fallback %")')).toBeVisible();
  await expect(summaryTiles.locator('p:has-text("Requests")')).toBeVisible();
  await expect(summaryTiles.locator('p:has-text("Validation fails")')).toBeVisible();

  // ── 6. Assert the focused composed chart renders ─────────────────────────
  const focusChart = page.locator('[data-testid="trend-focus-chart"]');
  await expect(focusChart).toBeVisible();

  // ── 7. Click "Back to all tools" and assert multi-line view returns ───────
  const backButton = page.locator('[data-testid="button-trend-clear-focus"]');
  await expect(backButton).toBeVisible();
  await backButton.click();

  await expect(summaryTiles).not.toBeVisible();
  await expect(focusChart).not.toBeVisible();
  await expect(focusSelect).toHaveValue("");
});

test("AI Reliability drill-in: focus clears automatically when tool has no data in the active window", async ({ page }) => {
  // ── 1. Sign in ───────────────────────────────────────────────────────────
  await page.goto("/founder");

  const keyInput = page.locator('input[type="password"]');
  await expect(keyInput).toBeVisible();
  await keyInput.fill(FOUNDER_KEY);
  await page.locator('button:has-text("Unlock Dashboard")').click();

  // ── 2. Confirm the panel is in the 90d window (default) ─────────────────
  const focusSelect = page.locator('[data-testid="select-trend-focus-tool"]');
  await expect(focusSelect).toBeVisible({ timeout: 20_000 });
  await focusSelect.scrollIntoViewIfNeeded();

  // The primary tool (35 days old) should be visible in the 90d window
  await expect(focusSelect.locator(`option[value="${TOOL_NAME}"]`)).toBeAttached({ timeout: 20_000 });

  // ── 3. Focus on the primary tool ─────────────────────────────────────────
  await focusSelect.selectOption(TOOL_NAME);
  await expect(page.locator('[data-testid="trend-focus-summary"]')).toBeVisible({ timeout: 10_000 });

  // ── 4. Switch to 30d — primary tool drops out of the window ─────────────
  await page.locator('button', { hasText: "30d" }).click();

  // ── 5. Focus should clear automatically ──────────────────────────────────
  await expect(focusSelect).toHaveValue("", { timeout: 10_000 });
  await expect(page.locator('[data-testid="trend-focus-summary"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="trend-focus-chart"]')).not.toBeVisible();
});
