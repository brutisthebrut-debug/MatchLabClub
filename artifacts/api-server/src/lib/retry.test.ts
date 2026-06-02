import { describe, it, expect, vi } from "vitest";
import { retryWhile, backoffDelay } from "./retry";

const noSleep = (): Promise<void> => Promise.resolve();

describe("backoffDelay", () => {
  it("grows exponentially and caps at maxDelayMs with jitter off", () => {
    const opts = { baseDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: false };
    expect(backoffDelay(1, opts)).toBe(100);
    expect(backoffDelay(2, opts)).toBe(200);
    expect(backoffDelay(3, opts)).toBe(400);
    expect(backoffDelay(10, opts)).toBe(1000);
  });

  it("stays within +/-20% when jitter is on", () => {
    const opts = { baseDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true };
    for (let i = 0; i < 50; i += 1) {
      const d = backoffDelay(2, opts);
      expect(d).toBeGreaterThanOrEqual(160);
      expect(d).toBeLessThanOrEqual(240);
    }
  });
});

describe("retryWhile", () => {
  it("returns the first successful result without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWhile(fn, { sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries thrown errors up to the attempt budget then rethrows", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      retryWhile(fn, { attempts: 3, sleep: noSleep }),
    ).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("recovers when a later attempt succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("recovered");
    const result = await retryWhile(fn, { attempts: 3, sleep: noSleep });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries resolved results flagged by shouldRetry", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true });
    const result = await retryWhile(fn, {
      attempts: 5,
      sleep: noSleep,
      shouldRetry: (r: { ok: boolean }) => !r.ok,
    });
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns the last flagged result when attempts are exhausted", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false });
    const result = await retryWhile(fn, {
      attempts: 2,
      sleep: noSleep,
      shouldRetry: (r: { ok: boolean }) => !r.ok,
    });
    expect(result).toEqual({ ok: false });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("fires onRetry before each backoff sleep", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("done");
    await retryWhile(fn, { attempts: 3, sleep: noSleep, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
