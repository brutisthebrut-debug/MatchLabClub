import { test, expect } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;

const FOUNDER_KEY = process.env.VITE_FOUNDER_KEY ?? "nldc2024";

let pool: pg.Pool;
let seededAuditIds: number[] = [];

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // The trend series covers the last N days up to (but not including) today,
  // so seed with yesterday's timestamp to ensure the entry falls inside the
  // chart's visible range.
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
      NOW() - INTERVAL '1 day'
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
  await page.goto("/founder");

  const keyInput = page.locator('input[type="password"]');
  await expect(keyInput).toBeVisible();
  await keyInput.fill(FOUNDER_KEY);
  await page.locator('button:has-text("Unlock Dashboard")').click();

  await page.locator('button:has-text("OCR Mismatches")').click();

  await expect(page.locator('[data-testid="ocr-mismatches-panel"]')).toBeVisible();

  await expect(page.locator('[data-testid="ocr-trend-empty"]')).not.toBeVisible({ timeout: 20_000 });

  const chart = page.locator('[data-testid="ocr-trend-chart"]');
  await expect(chart).toBeVisible();

  const totalLegend = chart.locator('.recharts-legend-item-text', { hasText: "Total" });
  await expect(totalLegend).toBeVisible();
});
