import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { handleIdentityWebhook } from "./lib/identityVerification";

/**
 * Build the set of origins that are trusted for credentialed CORS requests.
 * Sources:
 *   REPLIT_DOMAINS  , comma-separated list of all domains for this Repl
 *                      (dev previews and published production domains)
 *   REPLIT_EXPO_DEV_DOMAIN, Expo tunnel domain used by the mobile app in dev
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
 * CSRF Origin guard, active defence for write methods.
 *
 * If the browser sends an Origin header on a non-safe method and it is not in
 * the trusted allowlist, the request is rejected before any route handler runs.
 * Requests without an Origin header (native mobile app, curl, server-to-server)
 * are allowed through, they can't be forged via a browser-based CSRF attack.
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

/**
 * Stripe webhook, registered BEFORE express.json() so the handler receives the
 * raw request body Buffer required for signature verification. The CSRF origin
 * guard above lets this through: Stripe is server-to-server and sends no Origin
 * header. Signature verification inside processWebhook is the real auth here.
 */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0]! : signature;
      // Identity events update the verification lane. Every other signed event
      // flows to the direct billing entitlement dispatcher. Both verify against
      // the same dedicated webhook endpoint secret.
      const handledIdentity = await handleIdentityWebhook(
        req.body as Buffer,
        sig,
      );
      if (!handledIdentity) {
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      }
      res.status(200).json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook processing failed");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
