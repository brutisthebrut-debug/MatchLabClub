import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  coachFollowUpsTable,
  lifePulsesTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import { GetMirrorTrendsResponse } from "@workspace/api-zod";
import mirrorRouter from "./mirror";

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
  app.use("/api", mirrorRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const TEST_USER_ID = `test-mirror-${crypto.randomBytes(6).toString("hex")}`;
const insertedAuditIds: number[] = [];
const insertedFollowUpIds: number[] = [];
const insertedPulseIds: number[] = [];

beforeAll(() => {
  testApp = makeTestApp();
});

beforeEach(() => {
  insertedAuditIds.length = 0;
  insertedFollowUpIds.length = 0;
  insertedPulseIds.length = 0;
});

afterAll(async () => {
  await pool.end();
});

async function cleanup(): Promise<void> {
  if (insertedAuditIds.length)
    await db.delete(auditsTable).where(inArray(auditsTable.id, insertedAuditIds));
  if (insertedFollowUpIds.length)
    await db
      .delete(coachFollowUpsTable)
      .where(inArray(coachFollowUpsTable.id, insertedFollowUpIds));
  if (insertedPulseIds.length)
    await db
      .delete(lifePulsesTable)
      .where(inArray(lifePulsesTable.id, insertedPulseIds));
  await db.delete(auditsTable).where(eq(auditsTable.userId, TEST_USER_ID));
  await db.delete(coachFollowUpsTable).where(eq(coachFollowUpsTable.userId, TEST_USER_ID));
  await db.delete(lifePulsesTable).where(eq(lifePulsesTable.userId, TEST_USER_ID));
}

async function seedAudit(score: number, daysAgo: number, report: object): Promise<void> {
  const [row] = await db
    .insert(auditsTable)
    .values({
      userId: TEST_USER_ID,
      firstName: "Test",
      age: 30,
      gender: "other",
      datingGoal: "find a relationship",
      currentApps: ["Hinge"],
      bio: "test bio",
      status: "complete",
      readinessScore: score,
      report,
      reportGeneratedAt: new Date(Date.now() - daysAgo * 86_400_000),
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    })
    .returning({ id: auditsTable.id });
  insertedAuditIds.push(row.id);
}

describe("GET /api/mirror/trends", () => {
  it("returns an empty-shaped report when the user has no audits", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app).get("/api/mirror/trends");
      expect(res.status).toBe(200);
      expect(() => GetMirrorTrendsResponse.parse(res.body)).not.toThrow();
      expect(res.body.totalAudits).toBe(0);
      expect(res.body.hasEnoughData).toBe(false);
      expect(res.body.headlineInsight).toMatch(/first audit/i);
    } finally {
      await cleanup();
    }
  });

  it("aggregates a real signed-in user's audits into a trend report", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      await seedAudit(58, 20, {
        strengths: ["Genuine warmth"],
        risks: ["Generic phrases dilute the profile"],
      });
      await seedAudit(76, 2, {
        strengths: ["Specific, vivid bio detail"],
        risks: ["Photos need work"],
      });

      const res = await request(testApp.app).get("/api/mirror/trends");
      expect(res.status).toBe(200);
      expect(() => GetMirrorTrendsResponse.parse(res.body)).not.toThrow();
      expect(res.body.totalAudits).toBe(2);
      expect(res.body.hasEnoughData).toBe(true);
      expect(res.body.scoreDelta.direction).toBe("up");
      expect(res.body.scoreDelta.delta).toBe(18);
      expect(res.body.engineVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
    } finally {
      await cleanup();
    }
  });

  it("returns an empty report (no leakage) for an anonymous request with no cookie", async () => {
    testApp.setUser(null);
    try {
      // Seed an audit owned by TEST_USER_ID — anon request must NOT see it.
      await seedAudit(80, 1, { strengths: ["Warmth"], risks: ["Generic"] });
      const res = await request(testApp.app).get("/api/mirror/trends");
      expect(res.status).toBe(200);
      expect(res.body.totalAudits).toBe(0);
    } finally {
      await cleanup();
    }
  });
});
