import { describe, it, expect, beforeEach } from "vitest";
import {
  checkHandoffRateLimit,
  handoffRateLimitKey,
  HANDOFF_RATE_LIMIT_MAX,
  HANDOFF_RATE_LIMIT_WINDOW_MS,
  _resetRateLimitState,
} from "./handoffRateLimit";

beforeEach(() => {
  _resetRateLimitState();
});

describe("checkHandoffRateLimit", () => {
  it("allows requests up to the max within a window", () => {
    const now = 1_000_000;
    for (let i = 0; i < HANDOFF_RATE_LIMIT_MAX; i++) {
      expect(checkHandoffRateLimit("test-key", now + i)).toBe(true);
    }
  });

  it("blocks the request that exceeds the max", () => {
    const now = 1_000_000;
    for (let i = 0; i < HANDOFF_RATE_LIMIT_MAX; i++) {
      checkHandoffRateLimit("test-key", now + i);
    }
    expect(checkHandoffRateLimit("test-key", now + HANDOFF_RATE_LIMIT_MAX)).toBe(false);
  });

  it("does not count blocked requests against the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < HANDOFF_RATE_LIMIT_MAX; i++) {
      checkHandoffRateLimit("test-key", now + i);
    }
    // Blocked call
    expect(checkHandoffRateLimit("test-key", now + HANDOFF_RATE_LIMIT_MAX)).toBe(false);
    // Still blocked on a follow-up
    expect(checkHandoffRateLimit("test-key", now + HANDOFF_RATE_LIMIT_MAX + 1)).toBe(false);
  });

  it("allows requests again after the window expires", () => {
    const now = 1_000_000;
    for (let i = 0; i < HANDOFF_RATE_LIMIT_MAX; i++) {
      checkHandoffRateLimit("test-key", now + i);
    }
    // Fully outside the window
    const later = now + HANDOFF_RATE_LIMIT_WINDOW_MS + 1;
    expect(checkHandoffRateLimit("test-key", later)).toBe(true);
  });

  it("tracks different keys independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < HANDOFF_RATE_LIMIT_MAX; i++) {
      checkHandoffRateLimit("key-A", now + i);
    }
    // key-A is exhausted
    expect(checkHandoffRateLimit("key-A", now + HANDOFF_RATE_LIMIT_MAX)).toBe(false);
    // key-B is fresh
    expect(checkHandoffRateLimit("key-B", now + HANDOFF_RATE_LIMIT_MAX)).toBe(true);
  });

  it("supports a custom max and window for testing", () => {
    const now = 2_000_000;
    expect(checkHandoffRateLimit("custom", now, 2, 5_000)).toBe(true);
    expect(checkHandoffRateLimit("custom", now + 1, 2, 5_000)).toBe(true);
    expect(checkHandoffRateLimit("custom", now + 2, 2, 5_000)).toBe(false);
  });

  it("slides the window: old hits age out as time advances", () => {
    const now = 3_000_000;
    const window = 10_000;
    // Fill the bucket (max=3) at t=now
    checkHandoffRateLimit("slide", now, 3, window);
    checkHandoffRateLimit("slide", now + 1, 3, window);
    checkHandoffRateLimit("slide", now + 2, 3, window);
    // Bucket full
    expect(checkHandoffRateLimit("slide", now + 3, 3, window)).toBe(false);
    // Advance past the window so all three original hits are evicted
    const later = now + window + 1;
    expect(checkHandoffRateLimit("slide", later, 3, window)).toBe(true);
  });
});

describe("handoffRateLimitKey", () => {
  it("prefers the IP address when present", () => {
    expect(handoffRateLimitKey("1.2.3.4", "abc123")).toBe("ip:1.2.3.4");
  });

  it("falls back to the anon token when IP is absent", () => {
    expect(handoffRateLimitKey(undefined, "abc123")).toBe("tok:abc123");
    expect(handoffRateLimitKey("", "abc123")).toBe("tok:abc123");
  });

  it("returns 'unknown' when both are absent", () => {
    expect(handoffRateLimitKey(undefined, undefined)).toBe("unknown");
    expect(handoffRateLimitKey("", "")).toBe("unknown");
  });
});
