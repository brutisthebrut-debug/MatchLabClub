/**
 * Small, dependency-free retry helper with exponential backoff and jitter.
 *
 * Two failure shapes show up across the codebase:
 *  1. A call that throws (network reset, DB blip).
 *  2. A call that resolves with a result object that itself signals a transient
 *     failure (our `generate()` returns `{ isFallback: true, error }` rather
 *     than throwing on a transient model/API error).
 *
 * `retryWhile` handles both: it retries on any thrown error AND on any resolved
 * result that `shouldRetry` flags. The sleep function is injectable so tests can
 * run instantly with no real timers.
 */

export interface RetryOptions<T> {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Base backoff in ms before the second attempt. Default 250. */
  baseDelayMs?: number;
  /** Upper bound on any single backoff. Default 4000. */
  maxDelayMs?: number;
  /** Backoff growth factor per attempt. Default 2. */
  factor?: number;
  /** Add up to +/-20% jitter to each delay. Default true. */
  jitter?: boolean;
  /**
   * Predicate over a resolved result: return true to retry it. When omitted,
   * resolved results are never retried (only thrown errors are).
   */
  shouldRetry?: (result: T) => boolean;
  /** Called before each backoff sleep. Useful for logging/metrics. */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error?: unknown;
    result?: T;
  }) => void;
  /** Injectable sleep, defaults to setTimeout. Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === "function") t.unref();
  });

export function backoffDelay(
  attempt: number,
  opts: {
    baseDelayMs: number;
    maxDelayMs: number;
    factor: number;
    jitter: boolean;
  },
): number {
  const raw = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
  const capped = Math.min(opts.maxDelayMs, raw);
  if (!opts.jitter) return Math.round(capped);
  const delta = capped * 0.2;
  const jittered = capped - delta + Math.random() * (2 * delta);
  return Math.round(Math.max(0, jittered));
}

/**
 * Run `fn`, retrying on thrown errors and on resolved results that
 * `shouldRetry` flags, with exponential backoff between attempts. Returns the
 * last result (even if still flagged) once attempts are exhausted, or rethrows
 * the last error if every attempt threw.
 */
export async function retryWhile<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions<T> = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 4000;
  const factor = opts.factor ?? 2;
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown;
  let sawError = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await fn(attempt);
      const hasNext = attempt < attempts;
      if (hasNext && shouldRetry && shouldRetry(result)) {
        const delayMs = backoffDelay(attempt, {
          baseDelayMs,
          maxDelayMs,
          factor,
          jitter,
        });
        opts.onRetry?.({ attempt, delayMs, result });
        await sleep(delayMs);
        continue;
      }
      return result;
    } catch (err) {
      lastError = err;
      sawError = true;
      const hasNext = attempt < attempts;
      if (!hasNext) break;
      const delayMs = backoffDelay(attempt, {
        baseDelayMs,
        maxDelayMs,
        factor,
        jitter,
      });
      opts.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }

  if (sawError) throw lastError;
  // Unreachable: the loop returns on the final non-throwing attempt.
  throw new Error("retryWhile: exhausted attempts without a result");
}
