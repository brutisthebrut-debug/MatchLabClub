/**
 * Sliding-window rate limiter for POST /claim-anonymous/handoff/issue.
 *
 * Each anonymous browser can mint at most MAX_REQUESTS tokens within any
 * WINDOW_MS window. The key is the request IP address; when that is not
 * available (e.g. behind a proxy that strips headers) we fall back to the
 * anon_claim token itself, which is still scoped tightly enough to protect
 * against a single misbehaving client.
 *
 * State is held behind a `RateLimitStore` abstraction with two implementations:
 *
 * - {@link InMemoryRateLimitStore} keeps the sliding-window buckets in a Map
 *   inside the process. This is fast and dependency-free, but the state is
 *   lost on restart, so a client could bypass the limit by triggering a
 *   restart or, in a multi-process deployment, by hopping between instances.
 *   Used by default in test and development environments.
 *
 * - {@link DbRateLimitStore} persists hits to a small Postgres table
 *   (`handoff_rate_limit_hits`) with a TTL matching the window. This survives
 *   restarts and is shared across processes. Used by default in production.
 *
 * Tests can swap the active store via {@link setHandoffRateLimitStore} or by
 * calling {@link _resetRateLimitState} to clear the in-memory implementation.
 */

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, handoffRateLimitHitsTable } from "@workspace/db";

export const HANDOFF_RATE_LIMIT_MAX = 5;
export const HANDOFF_RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitStore {
  /**
   * Record a hit for `key` and report whether it is within the limit.
   *
   * @returns `true` if the request should be allowed, `false` if it exceeds
   *          the limit and should receive a 429 response.
   */
  check(
    key: string,
    nowMs: number,
    maxRequests: number,
    windowMs: number,
  ): Promise<boolean>;
  /** Clear all state. Primarily used by tests. */
  reset(): Promise<void>;
}

interface BucketEntry {
  /** Timestamps (ms) of individual requests within the current window. */
  hits: number[];
}

/**
 * In-process sliding-window store. Suitable for tests and single-process dev
 * setups; not durable across restarts.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, BucketEntry>();

  async check(
    key: string,
    nowMs: number,
    maxRequests: number,
    windowMs: number,
  ): Promise<boolean> {
    const windowStart = nowMs - windowMs;
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { hits: [] };
      this.buckets.set(key, entry);
    }

    entry.hits = entry.hits.filter((t) => t > windowStart);

    if (entry.hits.length >= maxRequests) {
      return false;
    }

    entry.hits.push(nowMs);
    return true;
  }

  async reset(): Promise<void> {
    this.buckets.clear();
  }
}

/**
 * Postgres-backed sliding-window store. Each request inserts a row with an
 * `expires_at` of `now + windowMs`; expired rows are deleted on every check.
 * Survives server restarts and works across multiple processes that share
 * the same database.
 */
export class DbRateLimitStore implements RateLimitStore {
  async check(
    key: string,
    nowMs: number,
    maxRequests: number,
    windowMs: number,
  ): Promise<boolean> {
    const now = new Date(nowMs);

    // Drop rows that have aged out of any active window. Cheap because the
    // table is tiny (only live hits) and `expires_at` is indexed.
    await db
      .delete(handoffRateLimitHitsTable)
      .where(lt(handoffRateLimitHitsTable.expiresAt, now));

    const live = await db
      .select({ id: handoffRateLimitHitsTable.id })
      .from(handoffRateLimitHitsTable)
      .where(
        and(
          eq(handoffRateLimitHitsTable.key, key),
          gt(handoffRateLimitHitsTable.expiresAt, now),
        ),
      );

    if (live.length >= maxRequests) {
      return false;
    }

    await db.insert(handoffRateLimitHitsTable).values({
      id: randomUUID(),
      key,
      hitAt: now,
      expiresAt: new Date(nowMs + windowMs),
    });
    return true;
  }

  async reset(): Promise<void> {
    await db.delete(handoffRateLimitHitsTable);
  }
}

function pickDefaultStore(): RateLimitStore {
  // Production deployments need durability across restarts and instances; the
  // DB-backed store provides that. Tests and local dev keep using the
  // in-memory store to avoid extra DB churn and to keep unit tests hermetic.
  if (process.env.NODE_ENV === "production") {
    return new DbRateLimitStore();
  }
  return new InMemoryRateLimitStore();
}

let currentStore: RateLimitStore = pickDefaultStore();

/** Replace the active store. Returns the previous store so callers can restore it. */
export function setHandoffRateLimitStore(store: RateLimitStore): RateLimitStore {
  const previous = currentStore;
  currentStore = store;
  return previous;
}

/** Read the active store. Exposed primarily for tests. */
export function getHandoffRateLimitStore(): RateLimitStore {
  return currentStore;
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
): Promise<boolean> {
  return currentStore.check(key, nowMs, maxRequests, windowMs);
}

/**
 * Exposed for tests, clears state in the active store.
 */
export function _resetRateLimitState(): Promise<void> {
  return currentStore.reset();
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
