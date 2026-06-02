import { describe, it, expect } from "vitest";
import {
  isRetryableGenerateResult,
  nextEnrichRetryCount,
} from "./importEnrichment";
import type { GenerateResult } from "./aiService";

function result(over: Partial<GenerateResult<string>>): GenerateResult<string> {
  return {
    text: "",
    isFallback: true,
    attempts: 1,
    ...over,
  } as GenerateResult<string>;
}

describe("isRetryableGenerateResult", () => {
  it("does not retry a successful (non-fallback) result", () => {
    expect(isRetryableGenerateResult(result({ isFallback: false }))).toBe(false);
  });

  it("does not retry short-circuits with attempts 0 (no client / consent / cap)", () => {
    expect(
      isRetryableGenerateResult(
        result({ isFallback: true, attempts: 0, error: "consent_required" }),
      ),
    ).toBe(false);
  });

  it("does not retry terminal error classes even when a call was made", () => {
    for (const error of [
      "consent_required",
      "daily_cap_exceeded",
      "Structured output failed schema validation after retry",
    ]) {
      expect(
        isRetryableGenerateResult(result({ attempts: 1, error })),
      ).toBe(false);
    }
  });

  it("retries a transient fallback after at least one attempt", () => {
    expect(
      isRetryableGenerateResult(
        result({ isFallback: true, attempts: 1, error: "network_error" }),
      ),
    ).toBe(true);
  });

  it("retries a transient fallback with no specific error message", () => {
    expect(
      isRetryableGenerateResult(result({ isFallback: true, attempts: 2 })),
    ).toBe(true);
  });
});

describe("nextEnrichRetryCount", () => {
  it("increments the budget for consuming failures", () => {
    expect(nextEnrichRetryCount("network_error", 0)).toBe(1);
    expect(nextEnrichRetryCount("no_output", 2)).toBe(3);
    expect(nextEnrichRetryCount("unknown_error", 1)).toBe(2);
  });

  it("does NOT consume budget for a daily cap (time-window, not a defect)", () => {
    expect(nextEnrichRetryCount("daily_cap_exceeded", 0)).toBe(0);
    expect(nextEnrichRetryCount("daily_cap_exceeded", 2)).toBe(2);
  });
});
