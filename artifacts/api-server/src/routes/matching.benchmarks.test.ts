import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  matchingReadinessSnapshotsTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import matchingRouter from "./matching";

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
  app.use("/api", matchingRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const CALLER = `bm-caller-${suffix}`;
// A goal cohort comfortably above the default min (8): the caller plus enough
// peers sharing the same normalized goal.
const COHORT = Array.from({ length: 10 }, (_, i) => `bm-peer-${i}-${suffix}`);
const OTHER_GOAL_USER = `bm-other-${suffix}`;
const ALL_USERS = [CALLER, ...COHORT, OTHER_GOAL_USER];

async function seedAuditGoal(userId: string, goal: string): Promise<void> {
  await db.insert(auditsTable).values({
    userId,
    firstName: "Test",
    age: 30,
    gender: "woman",
    datingGoal: goal,
    bio: "A real, thoughtful bio used for the benchmarks route test fixture.",
    status: "complete",
    readinessScore: 70,
    reportGeneratedAt: new Date(),
  });
}

async function seedSnapshot(
  userId: string,
  breakdown: Record<string, number>,
): Promise<void> {
  await db.insert(matchingReadinessSnapshotsTable).values({
    userId,
    day: new Date().toISOString().slice(0, 10),
    score: 50,
    breakdown,
  });
}

async function cleanup(): Promise<void> {
  await db.delete(auditsTable).where(inArray(auditsTable.userId, ALL_USERS));
  await db
    .delete(matchingReadinessSnapshotsTable)
    .where(inArray(matchingReadinessSnapshotsTable.userId, ALL_USERS));
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

describe("GET /me/matching/benchmarks", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/matching/benchmarks");
    expect(res.status).toBe(401);
  });

  it("guards below the minimum cohort size", async () => {
    // Caller has a goal but only two peers share it, well under the floor.
    await seedAuditGoal(CALLER, "long-term relationship");
    await seedAuditGoal(COHORT[0], "looking for something long-term");
    await seedAuditGoal(COHORT[1], "serious relationship");
    await seedSnapshot(COHORT[0], { compass: 40 });
    await seedSnapshot(COHORT[1], { compass: 60 });

    testApp.setUser({ id: CALLER });
    const res = await request(testApp.app).get("/api/me/matching/benchmarks");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.goal).toBe("long-term");
    expect(res.body.lanes).toEqual([]);
    expect(res.body.cohortSize).toBeLessThan(res.body.minCohort);
  });

  it("returns per-lane percentiles once the cohort clears the floor", async () => {
    await seedAuditGoal(CALLER, "long-term relationship");
    // A peer in a different goal bucket must be excluded from the cohort.
    await seedAuditGoal(OTHER_GOAL_USER, "just casual fun");
    await seedSnapshot(OTHER_GOAL_USER, { compass: 100 });

    // Ten peers in the caller's goal bucket, each with a known compass coverage
    // so the percentile is deterministic.
    for (let i = 0; i < COHORT.length; i++) {
      await seedAuditGoal(COHORT[i], "long-term relationship");
      await seedSnapshot(COHORT[i], { compass: i * 10 });
    }

    testApp.setUser({ id: CALLER });
    const res = await request(testApp.app).get("/api/me/matching/benchmarks");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.goal).toBe("long-term");
    // Only the same-goal peers count; the casual user is excluded.
    expect(res.body.cohortSize).toBe(COHORT.length);
    expect(Array.isArray(res.body.lanes)).toBe(true);
    expect(res.body.lanes.length).toBeGreaterThan(0);
    for (const lane of res.body.lanes) {
      expect(typeof lane.key).toBe("string");
      expect(lane.coverage).toBeGreaterThanOrEqual(0);
      expect(lane.coverage).toBeLessThanOrEqual(100);
      expect(lane.percentile).toBeGreaterThanOrEqual(0);
      expect(lane.percentile).toBeLessThanOrEqual(100);
      expect(lane.cohortMedian).toBeGreaterThanOrEqual(0);
      expect(lane.cohortMedian).toBeLessThanOrEqual(100);
    }
  });
});
