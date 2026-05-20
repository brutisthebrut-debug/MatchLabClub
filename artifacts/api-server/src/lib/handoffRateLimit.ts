/**
 * In-memory sliding-window rate limiter for POST /claim-anonymous/handoff/issue.
 *
 * Each anonymous browser can mint at most MAX_REQUESTS tokens within any
 * WINDOW_MS window. The key is the request IP address; when that is not
 * available (e.g. behind a proxy that strips headers) we fall back to the
 * anon_claim token itself, which is still scoped tightly enough to protect
 * against a single misbehaving client.
 *
 * The state is kept entirely in-process. For a multi-process deployment a
 * shared store (Redis, etc.) would be needed, but for the current single-
 * process Express setup this is sufficient.
 */

export const HANDOFF_RATE_LIMIT_MAX = 5;
export const HANDOFF_RATE_LIMIT_WINDOW_MS = 60_000;

interface BucketEntry {
  /** Timestamps (ms) of individual requests within the current window. */
  hits: number[];
}

const buckets = new Map<string, BucketEntry>();

/**
 * Exposed for tests only — resets all in-memory state.
 */
export function _resetRateLimitState(): void {
  buckets.clear();
}

/**
 * Check whether `key` is within the rate limit.
 *
 * @returns `true` if the request should be allowed, `false` if it exceeds the
 *          limit and should receive a 429 response.
 */
export function checkHandoffRateLimit(
  key: string,
  nowMs: number = Date.now(),
  maxRequests: number = HANDOFF_RATE_LIMIT_MAX,
  windowMs: number = HANDOFF_RATE_LIMIT_WINDOW_MS,
): boolean {
  const windowStart = nowMs - windowMs;
  let entry = buckets.get(key);
  if (!entry) {
    entry = { hits: [] };
    buckets.set(key, entry);
  }

  // Drop hits that have aged out of the window.
  entry.hits = entry.hits.filter((t) => t > windowStart);

  if (entry.hits.length >= maxRequests) {
    return false;
  }

  entry.hits.push(nowMs);
  return true;
}

/**
 * Derive a rate-limit key from an Express request.
 * Prefers the client IP; falls back to the anon token when IP is absent.
 */
export function handoffRateLimitKey(
  ip: string | undefined,
  anonToken: string | undefined,
): string {
  if (ip && ip.length > 0) return `ip:${ip}`;
  if (anonToken && anonToken.length > 0) return `tok:${anonToken}`;
  return "unknown";
}
