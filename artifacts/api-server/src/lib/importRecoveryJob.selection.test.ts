import { describe, it, expect } from "vitest";
import { shouldRecoverRow } from "./importRecoveryJob";
import { MAX_ENRICH_RETRIES } from "./importEnrichment";

const NOW = Date.UTC(2026, 5, 2, 12, 0, 0);
const MINUTE = 60 * 1000;
const opts = {
  now: NOW,
  stuckPendingMs: 5 * MINUTE,
  fallbackCooldownMs: 60 * MINUTE,
};

function row(over: Partial<Parameters<typeof shouldRecoverRow>[0]> = {}) {
  return {
    status: "pending",
    source: "hinge",
    uploadedAt: new Date(NOW - 10 * MINUTE),
    processedAt: null,
    parsedSummary: null,
    userId: "user-1",
    ...over,
  };
}

describe("shouldRecoverRow", () => {
  it("skips anonymous rows", () => {
    expect(shouldRecoverRow(row({ userId: null }), opts)).toBe(false);
  });

  it("skips sources that do not support AI enrichment", () => {
    expect(shouldRecoverRow(row({ source: "calendar-ics" }), opts)).toBe(false);
  });

  it("recovers a pending row older than the stuck threshold", () => {
    expect(
      shouldRecoverRow(
        row({ status: "pending", uploadedAt: new Date(NOW - 6 * MINUTE) }),
        opts,
      ),
    ).toBe(true);
  });

  it("leaves a fresh pending row alone (no race with the first attempt)", () => {
    expect(
      shouldRecoverRow(
        row({ status: "pending", uploadedAt: new Date(NOW - 1 * MINUTE) }),
        opts,
      ),
    ).toBe(false);
  });

  it("recovers a transient Hinge fallback past the cooldown", () => {
    expect(
      shouldRecoverRow(
        row({
          status: "fallback",
          processedAt: new Date(NOW - 90 * MINUTE),
          parsedSummary: { aiError: "network_error", aiRetryCount: 1 },
        }),
        opts,
      ),
    ).toBe(true);
  });

  it("skips a fallback still inside the cooldown window", () => {
    expect(
      shouldRecoverRow(
        row({
          status: "fallback",
          processedAt: new Date(NOW - 10 * MINUTE),
          parsedSummary: { aiError: "network_error", aiRetryCount: 1 },
        }),
        opts,
      ),
    ).toBe(false);
  });

  it("skips terminal fallback reasons", () => {
    for (const aiError of [
      "consent_not_granted",
      "schema_validation_failed",
      "json_parse_failed",
    ]) {
      expect(
        shouldRecoverRow(
          row({
            status: "fallback",
            processedAt: new Date(NOW - 90 * MINUTE),
            parsedSummary: { aiError, aiRetryCount: 0 },
          }),
          opts,
        ),
      ).toBe(false);
    }
  });

  it("stops retrying once the per-row ceiling is reached", () => {
    expect(
      shouldRecoverRow(
        row({
          status: "fallback",
          processedAt: new Date(NOW - 90 * MINUTE),
          parsedSummary: {
            aiError: "network_error",
            aiRetryCount: MAX_ENRICH_RETRIES,
          },
        }),
        opts,
      ),
    ).toBe(false);
  });

  it("does not treat Instagram rows as fallback-recoverable", () => {
    expect(
      shouldRecoverRow(
        row({
          source: "instagram-paste",
          status: "fallback",
          processedAt: new Date(NOW - 90 * MINUTE),
          parsedSummary: { aiError: "network_error", aiRetryCount: 0 },
        }),
        opts,
      ),
    ).toBe(false);
  });

  it("recovers a daily-cap fallback once past cooldown (cap resets over time)", () => {
    expect(
      shouldRecoverRow(
        row({
          status: "fallback",
          processedAt: new Date(NOW - 90 * MINUTE),
          parsedSummary: { aiError: "daily_cap_exceeded", aiRetryCount: 0 },
        }),
        opts,
      ),
    ).toBe(true);
  });

  it("ignores rows in a non-recoverable status", () => {
    expect(shouldRecoverRow(row({ status: "complete" }), opts)).toBe(false);
  });
});
