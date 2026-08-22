import type { Request, Response, NextFunction } from "express";
import { db, founderActionLogsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FOUNDER_ROLES = new Set(["founder", "admin"]);

function requestIp(req: Request): string | null {
  return (
    req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    null
  );
}

/**
 * Founder authorization is derived from the authenticated user's persisted
 * role. Client headers and query parameters never grant elevated access.
 * Every authorized request appends an actor/status row after the response.
 */
export async function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Behavior-focused route tests can bypass database role setup explicitly.
  // This branch is compiled into production but is unreachable unless the
  // process itself is running with NODE_ENV=test.
  if (
    process.env.NODE_ENV === "test" &&
    req.header("x-test-founder-role") === "founder"
  ) {
    next();
    return;
  }

  const actorUserId = req.user?.id;
  if (!actorUserId) {
    res.status(401).json({ error: "Sign in with a founder account." });
    return;
  }

  const [actor] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, actorUserId))
    .limit(1);

  if (!actor || !FOUNDER_ROLES.has(actor.role)) {
    res.status(403).json({ error: "Founder access required." });
    return;
  }

  res.once("finish", () => {
    void db
      .insert(founderActionLogsTable)
      .values({
        actorUserId,
        method: req.method,
        path: req.path.slice(0, 512),
        statusCode: res.statusCode,
        ip: requestIp(req),
        userAgent: req.header("user-agent")?.slice(0, 512) ?? null,
      })
      .catch((err: unknown) => {
        // Audit logging must not mutate an already-completed response, but a
        // failed append must remain visible to operations.
        req.log?.error(
          { err, actorUserId, method: req.method, path: req.path },
          "Failed to append founder actor log",
        );
      });
  });

  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-memory IP rate limiter. Not for serious abuse defense, but
 * enough to prevent runaway cost from a leaked endpoint.
 */
export function rateLimit(opts: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
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
        .json({
          error: "Too many requests. Please wait a moment and try again.",
        });
      return;
    }
    bucket.count += 1;
    next();
  };
}
