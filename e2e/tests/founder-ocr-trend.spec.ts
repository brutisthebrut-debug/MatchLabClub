import { test, expect } from "@playwright/test";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

let pool: pg.Pool;
let seededAuditIds: number[] = [];
let founderSid: string;
const FOUNDER_USER_ID = `e2e-founder-ocr-${crypto.randomBytes(6).toString("hex")}`;
const FOUNDER_EMAIL = `${FOUNDER_USER_ID}@example.com`;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  founderSid = crypto.randomBytes(32).toString("hex");
  const sessJson = JSON.stringify({
    user: {
      id: FOUNDER_USER_ID,
      email: FOUNDER_EMAIL,
      firstName: "Founder",
      lastName: "OCR",
      profileImageUrl: null,
      role: "founder",
    },
    access_token: "e2e-founder-ocr-token",
  });
  await pool.query(
    `INSERT INTO users (id, email, role)
     VALUES ($1, $2, 'founder')`,
    [FOUNDER_USER_ID, FOUNDER_EMAIL],
  );
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, NOW() + INTERVAL '1 hour', $3)`,
    [founderSid, sessJson, FOUNDER_USER_ID],
  );

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
  await pool.query(`DELETE FROM sessions WHERE sid = $1`, [founderSid]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [FOUNDER_USER_ID]);
  await pool.end();
});

test("OCR trend chart shows Total legend label", async ({ page }) => {
  await page.setExtraHTTPHeaders({ Cookie: `sid=${founderSid}` });
  await page.goto("/founder");

  await page.locator('button:has-text("OCR Mismatches")').click();

  await expect(page.locator('[data-testid="ocr-mismatches-panel"]')).toBeVisible();

  await expect(page.locator('[data-testid="ocr-trend-empty"]')).not.toBeVisible({ timeout: 20_000 });

  const chart = page.locator('[data-testid="ocr-trend-chart"]');
  await expect(chart).toBeVisible();

  const totalLegend = chart.locator('.recharts-legend-item-text', { hasText: "Total" });
  await expect(totalLegend).toBeVisible();
});
