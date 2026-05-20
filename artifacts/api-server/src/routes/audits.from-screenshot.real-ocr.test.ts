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
 * This file runs tesseract for real against a committed PNG. It is gated
 * behind RUN_OCR_E2E=1 so the default `pnpm test` stays fast. Run with:
 *
 *   RUN_OCR_E2E=1 pnpm --filter @workspace/api-server test
 */
const ENABLED = process.env.RUN_OCR_E2E === "1";

describe.skipIf(!ENABLED)("extractProfileFromScreenshot (real OCR)", () => {
  it(
    "parses firstName/age/sourceApp/bio from a real PNG",
    async () => {
      const pngPath = resolve(
        __dirname,
        "__fixtures__/screenshots/hinge-sample.png",
      );
      const imageBase64 = readFileSync(pngPath).toString("base64");

      const result = await extractProfileFromScreenshot(imageBase64);

      // OCR is not pixel-perfect, so we assert on the signal we expect the
      // parser to pull out, not on exact rawText. If any of these fail, it
      // means tesseract.js + parser together regressed on a simple screenshot.
      expect(result.rawText.length).toBeGreaterThan(0);
      expect(result.firstName).toBe("Sarah");
      expect(result.age).toBe(28);
      expect(result.sourceApp).toBe("Hinge");
      expect(result.bio.toLowerCase()).toMatch(/hiking|coffee|sunday/);
    },
    120_000,
  );
});
