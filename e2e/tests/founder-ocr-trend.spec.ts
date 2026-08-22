import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool;
let seededAuditIds: number[] = [];

async function signInFounder(page: Page): Promise<void> {
  await page.goto("/api/dev/login?state=power&returnTo=/");
  await pool.query("UPDATE users SET role = 'founder' WHERE id = 'dev-test-power'");
  await page.goto("/api/dev/login?state=power&returnTo=/");
  await page.goto("/founder");
}

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // The trend series now includes today (loop is d <= days), so seeding with
  // NOW() is sufficient to ensure the entry falls inside the chart's visible range.
  const result = await pool.query<{ id: number }>(`
    INSERT INTO audits (
      first_name, age, gender, dating_goal, bio, source,
      raw_ocr_text, ocr_corrections, created_at
    ) VALUES (
      'TestOcrTotal',
      28,
      'unspecified',
      'find a relationship',
      'E2E test bio for OCR trend chart Total line.',
      'screenshot',
      'TestOcrTotl\n28\nE2E test bio for OCR trend.',
      '{"firstName": {"raw": "TestOcrTotl", "corrected": "TestOcrTotal"}, "bio": {"raw": "E2E test bio for OCR trend.", "corrected": "E2E test bio for OCR trend chart Total line."}}',
      NOW()
    )
    RETURNING id
  `);

  seededAuditIds = result.rows.map((r) => r.id);
});

test.afterAll(async () => {
  if (seededAuditIds.length > 0) {
    await pool.query(
      `DELETE FROM audits WHERE id = ANY($1)`,
      [seededAuditIds],
    );
  }
  await pool.end();
});

test("OCR trend chart shows Total legend label", async ({ page }) => {
  await signInFounder(page);

  await page.locator('button:has-text("OCR Mismatches")').click();

  await expect(page.locator('[data-testid="ocr-mismatches-panel"]')).toBeVisible();

  await expect(page.locator('[data-testid="ocr-trend-empty"]')).not.toBeVisible({ timeout: 20_000 });

  const chart = page.locator('[data-testid="ocr-trend-chart"]');
  await expect(chart).toBeVisible();

  const totalLegend = chart.locator('.recharts-legend-item-text', { hasText: "Total" });
  await expect(totalLegend).toBeVisible();
});
