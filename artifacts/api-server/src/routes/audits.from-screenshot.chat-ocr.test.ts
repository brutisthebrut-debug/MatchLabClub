import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractChatFromScreenshot } from "../lib/ocr";

/**
 * Opt-in end-to-end OCR test for the chat-screenshot pipeline.
 * The default unit suite mocks the OCR layer so it stays fast and
 * deterministic. This file runs tesseract for real against a committed PNG to
 * catch regressions in the `extractChatFromScreenshot` pipeline (worker setup,
 * image decoding, chat-noise filtering) that mocked tests can't see.
 *
 * Run with:
 *
 *   RUN_OCR_E2E=1 pnpm --filter @workspace/api-server test
 */
const ENABLED = process.env.RUN_OCR_E2E === "1";

describe.skipIf(!ENABLED)("extractChatFromScreenshot (real OCR)", () => {
  it(
    "detects sourceApp and returns conversation text with UI noise stripped",
    async () => {
      const pngPath = resolve(
        __dirname,
        "__fixtures__/screenshots/tinder-chat-sample.png",
      );
      const imageBase64 = readFileSync(pngPath).toString("base64");

      const result = await extractChatFromScreenshot(imageBase64);

      // OCR is not pixel-perfect, so we assert on the signals the parser
      // should reliably pull out, not on exact rawText.
      expect(result.rawText.length).toBeGreaterThan(0);

      // Source app should be detected from the "Tinder" header text.
      expect(result.sourceApp).toBe("Tinder");

      // Core conversation lines must be present.
      const text = result.conversationText.toLowerCase();
      expect(text).toMatch(/how are you|how are you doing/);
      expect(text).toMatch(/coffee|great spot|great/);

      // UI noise must be stripped: timestamps, delivery receipts, send button.
      expect(result.conversationText).not.toMatch(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/i);
      expect(result.conversationText).not.toMatch(/\bdelivered\b/i);
      expect(result.conversationText).not.toMatch(/^Send$/im);
      expect(result.conversationText).not.toMatch(/^Today$/im);
    },
    120_000,
  );
});
