import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, coachFollowUpsTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import { GetCoachFollowUpTimelineResponse } from "@workspace/api-zod";
import coachFollowUpsRouter from "./coachFollowUps";
import { ANON_CLAIM_COOKIE } from "../lib/anonClaimToken";

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

  app.use("/api", coachFollowUpsRouter);

  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;

beforeAll(() => {
  testApp = makeTestApp();
});

afterAll(async () => {
  await pool.end();
});

const TEST_USER_ID = `test-fu-timeline-${crypto.randomBytes(6).toString("hex")}`;
const OTHER_USER_ID = `other-fu-timeline-${crypto.randomBytes(6).toString("hex")}`;

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const insertedIds: number[] = [];

async function seedRow(
  userId: string | null,
  token: string | null,
  answer: "sent" | "not_sent" | "snoozed" | "dismissed",
  createdAt?: Date,
): Promise<void> {
  const [row] = await db
    .insert(coachFollowUpsTable)
    .values({
      userId,
      anonymousClaimToken: token,
      answer,
      ...(createdAt ? { createdAt } : {}),
    })
    .returning({ id: coachFollowUpsTable.id });
  insertedIds.push(row.id);
}

beforeEach(() => {
  insertedIds.length = 0;
});

async function cleanup(): Promise<void> {
  if (insertedIds.length > 0) {
    await db
      .delete(coachFollowUpsTable)
      .where(inArray(coachFollowUpsTable.id, insertedIds));
  }
  await db
    .delete(coachFollowUpsTable)
    .where(eq(coachFollowUpsTable.userId, TEST_USER_ID));
  await db
    .delete(coachFollowUpsTable)
    .where(eq(coachFollowUpsTable.userId, OTHER_USER_ID));
}

describe("GET /api/coach/follow-ups/timeline — snooze and dismiss buckets (signed-in)", () => {
  it("returns a contract-shaped response with 8 buckets for a signed-in user", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);
      expect(() => GetCoachFollowUpTimelineResponse.parse(res.body)).not.toThrow();
      expect(res.body.buckets).toHaveLength(8);
    } finally {
      await cleanup();
    }
  });

  it("each bucket includes snoozeCount and dismissCount defaulting to 0", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);
      for (const bucket of res.body.buckets) {
        expect(typeof bucket.snoozeCount).toBe("number");
        expect(typeof bucket.dismissCount).toBe("number");
        expect(bucket.snoozeCount).toBe(0);
        expect(bucket.dismissCount).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });

  it("counts snoozed and dismissed events in the current week's bucket", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const now = new Date();
      await seedRow(TEST_USER_ID, null, "snoozed", now);
      await seedRow(TEST_USER_ID, null, "snoozed", now);
      await seedRow(TEST_USER_ID, null, "dismissed", now);
      await seedRow(TEST_USER_ID, null, "sent", now);
      await seedRow(TEST_USER_ID, null, "not_sent", now);

      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);
      expect(() => GetCoachFollowUpTimelineResponse.parse(res.body)).not.toThrow();

      const last = res.body.buckets[res.body.buckets.length - 1] as {
        snoozeCount: number;
        dismissCount: number;
        sentCount: number;
        notSentCount: number;
        total: number;
      };
      expect(last.snoozeCount).toBe(2);
      expect(last.dismissCount).toBe(1);
      expect(last.sentCount).toBe(1);
      expect(last.notSentCount).toBe(1);
      expect(last.total).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it("snooze/dismiss do not affect total or sendThroughRate", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const now = new Date();
      await seedRow(TEST_USER_ID, null, "snoozed", now);
      await seedRow(TEST_USER_ID, null, "dismissed", now);
      await seedRow(TEST_USER_ID, null, "sent", now);

      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);

      const last = res.body.buckets[res.body.buckets.length - 1] as {
        total: number;
        sendThroughRate: number | null;
        sentCount: number;
        snoozeCount: number;
        dismissCount: number;
      };
      expect(last.total).toBe(1);
      expect(last.sendThroughRate).toBe(1);
      expect(last.sentCount).toBe(1);
      expect(last.snoozeCount).toBe(1);
      expect(last.dismissCount).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("does not leak another user's snooze/dismiss into timeline", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const now = new Date();
      await seedRow(OTHER_USER_ID, null, "snoozed", now);
      await seedRow(OTHER_USER_ID, null, "dismissed", now);

      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);

      for (const bucket of res.body.buckets as { snoozeCount: number; dismissCount: number }[]) {
        expect(bucket.snoozeCount).toBe(0);
        expect(bucket.dismissCount).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });
});

describe("GET /api/coach/follow-ups/timeline — snooze and dismiss buckets (anonymous)", () => {
  it("returns a contract-shaped response with 8 buckets for an anonymous caller with a cookie", async () => {
    testApp.setUser(null);
    const token = makeToken();
    try {
      const res = await request(testApp.app)
        .get("/api/coach/follow-ups/timeline")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`]);
      expect(res.status).toBe(200);
      expect(() => GetCoachFollowUpTimelineResponse.parse(res.body)).not.toThrow();
      expect(res.body.buckets).toHaveLength(8);
      for (const bucket of res.body.buckets as { snoozeCount: number; dismissCount: number }[]) {
        expect(bucket.snoozeCount).toBe(0);
        expect(bucket.dismissCount).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });

  it("counts snoozed and dismissed for an anonymous token in the current week bucket", async () => {
    testApp.setUser(null);
    const token = makeToken();
    try {
      const now = new Date();
      await seedRow(null, token, "snoozed", now);
      await seedRow(null, token, "dismissed", now);
      await seedRow(null, token, "dismissed", now);
      await seedRow(null, token, "sent", now);

      const res = await request(testApp.app)
        .get("/api/coach/follow-ups/timeline")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`]);
      expect(res.status).toBe(200);
      expect(() => GetCoachFollowUpTimelineResponse.parse(res.body)).not.toThrow();

      const last = res.body.buckets[res.body.buckets.length - 1] as {
        snoozeCount: number;
        dismissCount: number;
        sentCount: number;
        total: number;
      };
      expect(last.snoozeCount).toBe(1);
      expect(last.dismissCount).toBe(2);
      expect(last.sentCount).toBe(1);
      expect(last.total).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("does not leak one anonymous token's snooze/dismiss counts to another token", async () => {
    testApp.setUser(null);
    const tokenA = makeToken();
    const tokenB = makeToken();
    try {
      const now = new Date();
      await seedRow(null, tokenA, "snoozed", now);
      await seedRow(null, tokenA, "dismissed", now);

      const res = await request(testApp.app)
        .get("/api/coach/follow-ups/timeline")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenB}`]);
      expect(res.status).toBe(200);

      for (const bucket of res.body.buckets as { snoozeCount: number; dismissCount: number }[]) {
        expect(bucket.snoozeCount).toBe(0);
        expect(bucket.dismissCount).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });

  it("returns all-zero buckets for an anonymous caller with no cookie", async () => {
    testApp.setUser(null);
    try {
      const res = await request(testApp.app).get("/api/coach/follow-ups/timeline");
      expect(res.status).toBe(200);
      expect(() => GetCoachFollowUpTimelineResponse.parse(res.body)).not.toThrow();
      for (const bucket of res.body.buckets as {
        snoozeCount: number;
        dismissCount: number;
        sentCount: number;
        notSentCount: number;
        total: number;
      }[]) {
        expect(bucket.snoozeCount).toBe(0);
        expect(bucket.dismissCount).toBe(0);
        expect(bucket.sentCount).toBe(0);
        expect(bucket.notSentCount).toBe(0);
        expect(bucket.total).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });
});
