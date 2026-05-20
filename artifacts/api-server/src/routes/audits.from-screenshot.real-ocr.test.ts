import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractProfileFromScreenshot } from "../lib/ocr";

/**
 * Opt-in end-to-end OCR test. The default unit suite mocks the OCR layer with
 * pre-OCRed text fixtures so it stays fast and deterministic. That keeps the
 * HTTP contract honest but never exercises tesseract.js itself, so a
 * regression in the real OCR pipeline (worker setup, image decoding, language
 * data) wouldn't be caught here.
 *
 * This file runs tesseract for real against committed PNGs (one per supported
 * app layout). It is gated behind RUN_OCR_E2E=1 so the default `pnpm test`
 * stays fast. Run with:
 *
 *   RUN_OCR_E2E=1 pnpm --filter @workspace/api-server test
 */
const ENABLED = process.env.RUN_OCR_E2E === "1";

function loadFixture(filename: string): string {
  const pngPath = resolve(
    __dirname,
    "__fixtures__/screenshots",
    filename,
  );
  return readFileSync(pngPath).toString("base64");
}

describe.skipIf(!ENABLED)("extractProfileFromScreenshot (real OCR)", () => {
  it(
    "parses firstName/age/sourceApp/bio from a Hinge screenshot",
    async () => {
      const imageBase64 = loadFixture("hinge-sample.png");
      const result = await extractProfileFromScreenshot(imageBase64);

      expect(result.rawText.length).toBeGreaterThan(0);
      expect(result.firstName).toBe("Sarah");
      expect(result.age).toBe(28);
      expect(result.sourceApp).toBe("Hinge");
      expect(result.bio.toLowerCase()).toMatch(/hiking|coffee|sunday/);
    },
    120_000,
  );

  it(
    "parses firstName/age/sourceApp/bio from a Bumble screenshot",
    async () => {
      const imageBase64 = loadFixture("bumble-sample.png");
      const result = await extractProfileFromScreenshot(imageBase64);

      expect(result.rawText.length).toBeGreaterThan(0);
      expect(result.firstName).toBe("Emma");
      expect(result.age).toBe(25);
      expect(result.sourceApp).toBe("Bumble");
      expect(result.bio.toLowerCase()).toMatch(/yoga|brunch|hike/);
    },
    120_000,
  );

  it(
    "parses firstName/age/sourceApp/bio from a Tinder screenshot",
    async () => {
      const imageBase64 = loadFixture("tinder-sample.png");
      const result = await extractProfileFromScreenshot(imageBase64);

      expect(result.rawText.length).toBeGreaterThan(0);
      expect(result.firstName).toBe("Jake");
      expect(result.age).toBe(30);
      expect(result.sourceApp).toBe("Tinder");
      expect(result.bio.toLowerCase()).toMatch(/foodie|traveler|adventure/);
    },
    120_000,
  );
});
