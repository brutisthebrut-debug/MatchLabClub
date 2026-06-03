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
import { eq } from "drizzle-orm";
import {
  db,
  pool,
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
const USER = `delta-${suffix}`;

function dayString(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function cleanup(): Promise<void> {
  await db
    .delete(matchingReadinessSnapshotsTable)
    .where(eq(matchingReadinessSnapshotsTable.userId, USER));
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

describe("GET /me/matching/state readinessDelta", () => {
  it("is null for an account with no prior snapshot", async () => {
    testApp.setUser({ id: USER });
    const res = await request(testApp.app).get("/api/me/matching/state");
    expect(res.status).toBe(200);
    // With only today's freshly-upserted snapshot, there is nothing to compare
    // against, so the delta must be null rather than a misleading zero.
    expect(res.body.readinessDelta).toBeNull();
  });

  it("derives score and per-lane deltas against the most recent prior snapshot", async () => {
    // Seed a prior day with a deliberately low score and a known breakdown so
    // we can assert the delta is computed against it (the endpoint upserts
    // today's real snapshot before reading the delta).
    await db.insert(matchingReadinessSnapshotsTable).values({
      userId: USER,
      day: dayString(-1),
      score: 3,
      breakdown: { selfStory: 5, photos: 40 },
    });

    testApp.setUser({ id: USER });
    const res = await request(testApp.app).get("/api/me/matching/state");
    expect(res.status).toBe(200);

    const delta = res.body.readinessDelta;
    expect(delta).not.toBeNull();
    expect(delta.toDay).toBe(dayString(0));
    expect(delta.fromDay).toBe(dayString(-1));

    // The headline score delta must reconcile with the reported readiness score
    // and the seeded prior score, so the card never narrates a number that
    // contradicts the meter.
    expect(delta.scoreDelta).toBe(res.body.readiness.score - 3);

    // Lanes only include sources whose coverage actually moved, biggest first,
    // and each is the signed coverage change versus the prior breakdown.
    expect(Array.isArray(delta.lanes)).toBe(true);
    for (const lane of delta.lanes) {
      expect(typeof lane.key).toBe("string");
      expect(typeof lane.delta).toBe("number");
      expect(lane.delta).not.toBe(0);
    }
    for (let i = 1; i < delta.lanes.length; i++) {
      expect(Math.abs(delta.lanes[i - 1].delta)).toBeGreaterThanOrEqual(
        Math.abs(delta.lanes[i].delta),
      );
    }
  });
});
