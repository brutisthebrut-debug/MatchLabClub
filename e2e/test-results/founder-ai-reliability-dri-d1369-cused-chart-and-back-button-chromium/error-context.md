# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: founder-ai-reliability-drilldown.spec.ts >> AI Reliability drill-in: selector, summary tiles, focused chart, and back button
- Location: tests/founder-ai-reliability-drilldown.spec.ts:50:1

# Error details

```
error: constraint "ai_request_metrics_daily_day_tool_idx" for table "ai_request_metrics_daily" does not exist
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import pg from "pg";
  3   | 
  4   | const { Pool } = pg;
  5   | 
  6   | const FOUNDER_KEY = process.env.VITE_FOUNDER_KEY ?? "nldc2024";
  7   | 
  8   | // Primary tool: seeded 35 days ago — visible in 90d/180d windows but NOT in 30d.
  9   | const TOOL_NAME = "E2E-ReliabilityDrillTest";
  10  | // Secondary tool: seeded yesterday — always visible; ensures the 30d chart
  11  | // isn't empty so the window-switch path is exercised cleanly.
  12  | const SECONDARY_TOOL_NAME = "E2E-ReliabilitySecondary";
  13  | 
  14  | let pool: pg.Pool;
  15  | let seededIds: number[] = [];
  16  | 
  17  | test.beforeAll(async () => {
  18  |   pool = new Pool({ connectionString: process.env.DATABASE_URL });
  19  | 
> 20  |   const result = await pool.query<{ id: number }>(`
      |                  ^ error: constraint "ai_request_metrics_daily_day_tool_idx" for table "ai_request_metrics_daily" does not exist
  21  |     INSERT INTO ai_request_metrics_daily
  22  |       (day, tool_name, total, first_try_ok, retried_ok, fallbacks,
  23  |        validation_failures, avg_attempts, avg_duration_ms)
  24  |     VALUES
  25  |       (
  26  |         (CURRENT_DATE - INTERVAL '35 days')::date,
  27  |         $1, 50, 40, 5, 5, 2, 1.2, 320.0
  28  |       ),
  29  |       (
  30  |         (CURRENT_DATE - INTERVAL '1 day')::date,
  31  |         $2, 30, 28, 1, 1, 0, 1.1, 210.0
  32  |       )
  33  |     ON CONFLICT ON CONSTRAINT ai_request_metrics_daily_day_tool_idx DO NOTHING
  34  |     RETURNING id
  35  |   `, [TOOL_NAME, SECONDARY_TOOL_NAME]);
  36  | 
  37  |   seededIds = result.rows.map((r) => r.id);
  38  | });
  39  | 
  40  | test.afterAll(async () => {
  41  |   if (seededIds.length > 0) {
  42  |     await pool.query(
  43  |       `DELETE FROM ai_request_metrics_daily WHERE id = ANY($1)`,
  44  |       [seededIds],
  45  |     );
  46  |   }
  47  |   await pool.end();
  48  | });
  49  | 
  50  | test("AI Reliability drill-in: selector, summary tiles, focused chart, and back button", async ({ page }) => {
  51  |   // ── 1. Navigate and sign in ──────────────────────────────────────────────
  52  |   await page.goto("/founder");
  53  | 
  54  |   const keyInput = page.locator('input[type="password"]');
  55  |   await expect(keyInput).toBeVisible();
  56  |   await keyInput.fill(FOUNDER_KEY);
  57  |   await page.locator('button:has-text("Unlock Dashboard")').click();
  58  | 
  59  |   // ── 2. Locate the AI Reliability Trends panel ────────────────────────────
  60  |   // It lives in the default "overview" tab — no tab click needed.
  61  |   const focusSelect = page.locator('[data-testid="select-trend-focus-tool"]');
  62  |   await expect(focusSelect).toBeVisible({ timeout: 20_000 });
  63  |   await focusSelect.scrollIntoViewIfNeeded();
  64  | 
  65  |   // ── 3. Wait for the seeded tool to appear in the 90d window (default) ───
  66  |   await expect(focusSelect.locator(`option[value="${TOOL_NAME}"]`)).toBeAttached({ timeout: 20_000 });
  67  | 
  68  |   // ── 4. Focus on the seeded tool via the selector ─────────────────────────
  69  |   await focusSelect.selectOption(TOOL_NAME);
  70  | 
  71  |   // ── 5. Assert the four summary tiles appear ──────────────────────────────
  72  |   const summaryTiles = page.locator('[data-testid="trend-focus-summary"]');
  73  |   await expect(summaryTiles).toBeVisible({ timeout: 10_000 });
  74  |   await expect(summaryTiles.locator('p:has-text("First-try %")')).toBeVisible();
  75  |   await expect(summaryTiles.locator('p:has-text("Fallback %")')).toBeVisible();
  76  |   await expect(summaryTiles.locator('p:has-text("Requests")')).toBeVisible();
  77  |   await expect(summaryTiles.locator('p:has-text("Validation fails")')).toBeVisible();
  78  | 
  79  |   // ── 6. Assert the focused composed chart renders ─────────────────────────
  80  |   const focusChart = page.locator('[data-testid="trend-focus-chart"]');
  81  |   await expect(focusChart).toBeVisible();
  82  | 
  83  |   // ── 7. Click "Back to all tools" and assert multi-line view returns ───────
  84  |   const backButton = page.locator('[data-testid="button-trend-clear-focus"]');
  85  |   await expect(backButton).toBeVisible();
  86  |   await backButton.click();
  87  | 
  88  |   await expect(summaryTiles).not.toBeVisible();
  89  |   await expect(focusChart).not.toBeVisible();
  90  |   await expect(focusSelect).toHaveValue("");
  91  | });
  92  | 
  93  | test("AI Reliability drill-in: focus clears automatically when tool has no data in the active window", async ({ page }) => {
  94  |   // ── 1. Sign in ───────────────────────────────────────────────────────────
  95  |   await page.goto("/founder");
  96  | 
  97  |   const keyInput = page.locator('input[type="password"]');
  98  |   await expect(keyInput).toBeVisible();
  99  |   await keyInput.fill(FOUNDER_KEY);
  100 |   await page.locator('button:has-text("Unlock Dashboard")').click();
  101 | 
  102 |   // ── 2. Confirm the panel is in the 90d window (default) ─────────────────
  103 |   const focusSelect = page.locator('[data-testid="select-trend-focus-tool"]');
  104 |   await expect(focusSelect).toBeVisible({ timeout: 20_000 });
  105 |   await focusSelect.scrollIntoViewIfNeeded();
  106 | 
  107 |   // The primary tool (35 days old) should be visible in the 90d window
  108 |   await expect(focusSelect.locator(`option[value="${TOOL_NAME}"]`)).toBeAttached({ timeout: 20_000 });
  109 | 
  110 |   // ── 3. Focus on the primary tool ─────────────────────────────────────────
  111 |   await focusSelect.selectOption(TOOL_NAME);
  112 |   await expect(page.locator('[data-testid="trend-focus-summary"]')).toBeVisible({ timeout: 10_000 });
  113 | 
  114 |   // ── 4. Switch to 30d — primary tool drops out of the window ─────────────
  115 |   await page.locator('button', { hasText: "30d" }).click();
  116 | 
  117 |   // ── 5. Focus should clear automatically ──────────────────────────────────
  118 |   await expect(focusSelect).toHaveValue("", { timeout: 10_000 });
  119 |   await expect(page.locator('[data-testid="trend-focus-summary"]')).not.toBeVisible();
  120 |   await expect(page.locator('[data-testid="trend-focus-chart"]')).not.toBeVisible();
```