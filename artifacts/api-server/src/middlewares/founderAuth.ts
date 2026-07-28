import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Sign in with a founder account." });
    return;
  }
  try {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);
    if (user?.role !== "founder") {
      res.status(403).json({ error: "Founder access required." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
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
