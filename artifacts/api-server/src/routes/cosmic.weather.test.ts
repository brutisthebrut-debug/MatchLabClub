import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, cosmicChartsTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import cosmicRouter from "./cosmic";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  let currentUser: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      const user: AuthUser = {
        id: currentUser.id,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
      req.user = user;
    }
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", cosmicRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `cosmic-weather-${suffix}`;

const FULL = {
  birthDate: "1990-07-15",
  birthTime: "14:30",
  birthPlace: "New York, NY",
  birthLat: 40.7128,
  birthLng: -74.006,
};

async function cleanup(): Promise<void> {
  await db.delete(cosmicChartsTable).where(eq(cosmicChartsTable.userId, USER_A));
}

beforeAll(() => {
  testApp = makeTestApp();
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("GET /api/me/cosmic/weather (real readiness graph)", () => {
  it("wraps the user's real top readiness nudge in star language", async () => {
    testApp.setUser({ id: USER_A });
    const saved = await request(testApp.app).post("/api/me/cosmic").send(FULL);
    expect(saved.status).toBe(201);

    const res = await request(testApp.app).get("/api/me/cosmic/weather");
    expect(res.status).toBe(200);
    expect(typeof res.body.headline).toBe("string");
    expect(res.body.headline.length).toBeGreaterThan(0);
    expect(typeof res.body.reframe).toBe("string");
    expect(res.body.reframe.length).toBeGreaterThan(0);

    // A brand-new user is not yet eligible, so a real action rides underneath
    // the star wrapper, with the honest detail echoed in the reframe.
    expect(res.body.action).not.toBeNull();
    expect(typeof res.body.action.label).toBe("string");
    expect(typeof res.body.action.detail).toBe("string");
    expect(typeof res.body.action.href).toBe("string");
    expect(res.body.reframe).toContain(res.body.action.detail);
  });
});
