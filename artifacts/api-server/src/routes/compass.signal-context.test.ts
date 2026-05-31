import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, compatibilityReadsTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import { GetCompassSignalContextResponse } from "@workspace/api-zod";
import compassRouter from "./compass";

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
  app.use("/api", compassRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const TEST_USER_ID = `test-compass-${crypto.randomBytes(6).toString("hex")}`;

beforeAll(() => {
  testApp = makeTestApp();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup(): Promise<void> {
  await db
    .delete(compatibilityReadsTable)
    .where(eq(compatibilityReadsTable.userId, TEST_USER_ID));
}

async function seedRead(
  snapshot: { readinessScore: number; activeLanes: string[]; capturedAt: string },
  createdAt: Date,
): Promise<void> {
  await db.insert(compatibilityReadsTable).values({
    userId: TEST_USER_ID,
    anonymousClaimToken: null,
    sourceKind: "paste",
    rawText: "Slow Burn",
    parsedProfile: { connectionStyle: "Slow Burn", patterns: [], notes: null },
    resultJson: {
      deterministicResult: {},
      aiResult: null,
      signalSnapshot: snapshot,
    },
    mode: "fallback",
    createdAt,
  });
}

describe("GET /api/compass/signal-context", () => {
  it("returns available:false for an anonymous caller with no leakage", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/compass/signal-context");
    expect(res.status).toBe(200);
    expect(() => GetCompassSignalContextResponse.parse(res.body)).not.toThrow();
    expect(res.body.available).toBe(false);
    expect(res.body.movement).toBeUndefined();
  });

  it("returns a valid context for a signed-in user", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app).get("/api/compass/signal-context");
      expect(res.status).toBe(200);
      expect(() => GetCompassSignalContextResponse.parse(res.body)).not.toThrow();
      expect(res.body.available).toBe(true);
      expect(res.body.signalLayer.lines.length).toBeGreaterThan(0);
      expect(res.body.mirror.href).toBe("/your-mirror");
      // Voice rule: no em dashes anywhere in user-facing copy.
      expect(res.body.signalLayer.lines.join(" ")).not.toContain("\u2014");
    } finally {
      await cleanup();
    }
  });

  it("surfaces movement between the two most recent stored snapshots", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const older = new Date(Date.now() - 2 * 86_400_000);
      const newer = new Date(Date.now() - 1 * 86_400_000);
      await seedRead(
        { readinessScore: 10, activeLanes: ["compass"], capturedAt: older.toISOString() },
        older,
      );
      await seedRead(
        {
          readinessScore: 25,
          activeLanes: ["compass", "calendar"],
          capturedAt: newer.toISOString(),
        },
        newer,
      );

      const res = await request(testApp.app).get("/api/compass/signal-context");
      expect(res.status).toBe(200);
      expect(() => GetCompassSignalContextResponse.parse(res.body)).not.toThrow();
      expect(res.body.movement).not.toBeNull();
      expect(res.body.movement.previousScore).toBe(10);
      expect(res.body.movement.currentScore).toBe(25);
      expect(res.body.movement.delta).toBe(15);
      expect(res.body.movement.newSignals.length).toBe(1);
      expect(res.body.movement.note).not.toContain("\u2014");
    } finally {
      await cleanup();
    }
  });
});
