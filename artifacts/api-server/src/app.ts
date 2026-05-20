import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

/**
 * Build the set of origins that are trusted for credentialed CORS requests.
 * Sources:
 *   REPLIT_DOMAINS   — comma-separated list of all domains for this Repl
 *                      (dev previews and published production domains)
 *   REPLIT_EXPO_DEV_DOMAIN — Expo tunnel domain used by the mobile app in dev
 */
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    for (const d of domains.split(",")) {
      const trimmed = d.trim();
      if (trimmed) origins.add(`https://${trimmed}`);
    }
  }
  const expoDomain = process.env["REPLIT_EXPO_DEV_DOMAIN"];
  if (expoDomain) {
    origins.add(`https://${expoDomain}`);
  }
  return origins;
}

const allowedOrigins = buildAllowedOrigins();

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

/**
 * CSRF Origin guard — active defence for write methods.
 *
 * If the browser sends an Origin header on a non-safe method and it is not in
 * the trusted allowlist, the request is rejected before any route handler runs.
 * Requests without an Origin header (native mobile app, curl, server-to-server)
 * are allowed through — they can't be forged via a browser-based CSRF attack.
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  if (!allowedOrigins.has(origin)) {
    res.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
