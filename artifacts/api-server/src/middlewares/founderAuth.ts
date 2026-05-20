import type { Request, Response, NextFunction } from "express";

const FOUNDER_KEY = process.env.FOUNDER_KEY?.trim() || "nldc2024";

export function requireFounder(req: Request, res: Response, next: NextFunction): void {
  const headerKey = (req.header("x-founder-key") ?? "").trim();
  const queryKey = typeof req.query.key === "string" ? req.query.key.trim() : "";
  if (headerKey === FOUNDER_KEY || queryKey === FOUNDER_KEY) {
    next();
    return;
  }
  res.status(401).json({ error: "Founder key required." });
}

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-memory IP rate limiter. Not for serious abuse defense, but
 * enough to prevent runaway cost from a leaked endpoint.
 */
export function rateLimit(opts: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.header("x-forwarded-for")?.split(",")[0]?.trim()) ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown";
    const now = Date.now();
    const key = `${ip}:${req.path}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    if (bucket.count >= opts.max) {
      res
        .status(429)
        .json({ error: "Too many requests. Please wait a moment and try again." });
      return;
    }
    bucket.count += 1;
    next();
  };
}
