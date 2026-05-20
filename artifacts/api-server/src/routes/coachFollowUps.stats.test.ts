import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, coachFollowUpsTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
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

const TEST_USER_ID = `test-fu-stats-${crypto.randomBytes(6).toString("hex")}`;
const OTHER_USER_ID = `other-fu-stats-${crypto.randomBytes(6).toString("hex")}`;

function makeToken(): string {
  // Must match the anon-cookie validation regex: /^[a-f0-9]{32,128}$/
  return crypto.randomBytes(32).toString("hex");
}

const insertedIds: number[] = [];

async function recordSignedIn(
  userId: string,
  answer: "sent" | "not_sent" | "snoozed" | "dismissed",
): Promise<void> {
  const [row] = await db
    .insert(coachFollowUpsTable)
    .values({ userId, anonymousClaimToken: null, answer })
    .returning({ id: coachFollowUpsTable.id });
  insertedIds.push(row.id);
}

async function recordAnon(
  token: string,
  answer: "sent" | "not_sent" | "snoozed" | "dismissed",
): Promise<void> {
  const [row] = await db
    .insert(coachFollowUpsTable)
    .values({ userId: null, anonymousClaimToken: token, answer })
    .returning({ id: coachFollowUpsTable.id });
  insertedIds.push(row.id);
}

beforeEach(() => {
  // Clear ids tracked from the previous test — cleanup happens in finally blocks.
  insertedIds.length = 0;
});

async function cleanup(): Promise<void> {
  if (insertedIds.length > 0) {
    await db
      .delete(coachFollowUpsTable)
      .where(inArray(coachFollowUpsTable.id, insertedIds));
  }
  // Also defensively wipe any rows posted by the route handler under this
  // user (e.g. from supertest POSTs) so a previous failing test can't leak
  // counts into the next.
  await db
    .delete(coachFollowUpsTable)
    .where(eq(coachFollowUpsTable.userId, TEST_USER_ID));
  await db
    .delete(coachFollowUpsTable)
    .where(eq(coachFollowUpsTable.userId, OTHER_USER_ID));
}

describe("POST /api/coach/follow-ups — snooze and dismiss counters (signed-in)", () => {
  it("increments snoozeCount when the user posts answer=snoozed", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/coach/follow-ups")
        .send({ answer: "snoozed", sessionId: 7 });

      expect(res.status).toBe(200);
      expect(res.body.snoozeCount).toBe(1);
      expect(res.body.dismissCount).toBe(0);
      expect(res.body.sentCount).toBe(0);
      expect(res.body.notSentCount).toBe(0);
      expect(res.body.totalPrompts).toBe(0);
      expect(res.body.lastAnswer).toBeNull();
      expect(res.body.lastAnsweredAt).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("increments dismissCount when the user posts answer=dismissed", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/coach/follow-ups")
        .send({ answer: "dismissed" });

      expect(res.status).toBe(200);
      expect(res.body.dismissCount).toBe(1);
      expect(res.body.snoozeCount).toBe(0);
      expect(res.body.totalPrompts).toBe(0);
      expect(res.body.lastAnswer).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("keeps snoozeCount and dismissCount independent as events accumulate", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      for (const answer of [
        "snoozed",
        "snoozed",
        "dismissed",
        "snoozed",
        "dismissed",
      ] as const) {
        const r = await request(testApp.app)
          .post("/api/coach/follow-ups")
          .send({ answer });
        expect(r.status).toBe(200);
      }

      const stats = await request(testApp.app).get(
        "/api/coach/follow-ups/stats",
      );
      expect(stats.status).toBe(200);
      expect(stats.body.snoozeCount).toBe(3);
      expect(stats.body.dismissCount).toBe(2);
      expect(stats.body.sentCount).toBe(0);
      expect(stats.body.notSentCount).toBe(0);
      expect(stats.body.totalPrompts).toBe(0);
      expect(stats.body.lastAnswer).toBeNull();
      expect(stats.body.lastAnsweredAt).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("excludes snoozed/dismissed from totalPrompts and lastAnswer", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      // Seed older sent/not_sent rows directly so we control createdAt ordering:
      // these are the "older" real answers, and "sent" is the most recent real
      // answer below.
      const past = new Date(Date.now() - 60_000);
      const [a] = await db
        .insert(coachFollowUpsTable)
        .values({
          userId: TEST_USER_ID,
          anonymousClaimToken: null,
          answer: "not_sent",
          createdAt: past,
        })
        .returning({ id: coachFollowUpsTable.id });
      insertedIds.push(a.id);
      const [b] = await db
        .insert(coachFollowUpsTable)
        .values({
          userId: TEST_USER_ID,
          anonymousClaimToken: null,
          answer: "sent",
          createdAt: new Date(past.getTime() + 1000),
        })
        .returning({ id: coachFollowUpsTable.id });
      insertedIds.push(b.id);

      // Now post snooze + dismiss as the most-recent events.
      for (const answer of ["snoozed", "dismissed"] as const) {
        const r = await request(testApp.app)
          .post("/api/coach/follow-ups")
          .send({ answer });
        expect(r.status).toBe(200);
      }

      const stats = await request(testApp.app).get(
        "/api/coach/follow-ups/stats",
      );
      expect(stats.status).toBe(200);

      // totalPrompts only counts sent + not_sent
      expect(stats.body.totalPrompts).toBe(2);
      expect(stats.body.sentCount).toBe(1);
      expect(stats.body.notSentCount).toBe(1);
      expect(stats.body.snoozeCount).toBe(1);
      expect(stats.body.dismissCount).toBe(1);

      // lastAnswer reflects the most recent sent/not_sent — NOT the snooze or
      // dismiss that came afterwards.
      expect(stats.body.lastAnswer).toBe("sent");
      expect(stats.body.lastAnsweredAt).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("keeps lastAnswer null and totalPrompts at 0 when the caller has only ever snoozed/dismissed", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      for (const answer of ["snoozed", "dismissed", "snoozed"] as const) {
        const r = await request(testApp.app)
          .post("/api/coach/follow-ups")
          .send({ answer });
        expect(r.status).toBe(200);
      }

      const stats = await request(testApp.app).get(
        "/api/coach/follow-ups/stats",
      );
      expect(stats.status).toBe(200);
      expect(stats.body.totalPrompts).toBe(0);
      expect(stats.body.lastAnswer).toBeNull();
      expect(stats.body.lastAnsweredAt).toBeNull();
      expect(stats.body.snoozeCount).toBe(2);
      expect(stats.body.dismissCount).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("does not leak one user's snooze/dismiss counts to another signed-in user", async () => {
    try {
      await recordSignedIn(OTHER_USER_ID, "snoozed");
      await recordSignedIn(OTHER_USER_ID, "dismissed");
      await recordSignedIn(OTHER_USER_ID, "sent");

      testApp.setUser({ id: TEST_USER_ID });
      const stats = await request(testApp.app).get(
        "/api/coach/follow-ups/stats",
      );
      expect(stats.status).toBe(200);
      expect(stats.body.snoozeCount).toBe(0);
      expect(stats.body.dismissCount).toBe(0);
      expect(stats.body.sentCount).toBe(0);
      expect(stats.body.totalPrompts).toBe(0);
      expect(stats.body.lastAnswer).toBeNull();
    } finally {
      await cleanup();
    }
  });
});

describe("POST /api/coach/follow-ups — snooze and dismiss counters (anonymous)", () => {
  it("scopes snooze/dismiss counts by anonymous token across browsers", async () => {
    testApp.setUser(null);
    const tokenA = makeToken();
    const tokenB = makeToken();
    try {
      // Browser A: 2 snoozes + 1 dismiss + 1 sent.
      await recordAnon(tokenA, "snoozed");
      await recordAnon(tokenA, "snoozed");
      await recordAnon(tokenA, "dismissed");
      await recordAnon(tokenA, "sent");

      // Browser B: 1 dismiss only.
      await recordAnon(tokenB, "dismissed");

      const statsA = await request(testApp.app)
        .get("/api/coach/follow-ups/stats")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenA}`]);
      expect(statsA.status).toBe(200);
      expect(statsA.body.snoozeCount).toBe(2);
      expect(statsA.body.dismissCount).toBe(1);
      expect(statsA.body.sentCount).toBe(1);
      expect(statsA.body.notSentCount).toBe(0);
      expect(statsA.body.totalPrompts).toBe(1);
      expect(statsA.body.lastAnswer).toBe("sent");

      const statsB = await request(testApp.app)
        .get("/api/coach/follow-ups/stats")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenB}`]);
      expect(statsB.status).toBe(200);
      expect(statsB.body.snoozeCount).toBe(0);
      expect(statsB.body.dismissCount).toBe(1);
      expect(statsB.body.totalPrompts).toBe(0);
      expect(statsB.body.lastAnswer).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("posting snoozed/dismissed via the route under an anonymous cookie updates that scope only", async () => {
    testApp.setUser(null);
    const tokenA = makeToken();
    const tokenB = makeToken();
    try {
      // Pre-seed an unrelated dismissed under token B so we can prove isolation.
      await recordAnon(tokenB, "dismissed");

      const r1 = await request(testApp.app)
        .post("/api/coach/follow-ups")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenA}`])
        .send({ answer: "snoozed" });
      expect(r1.status).toBe(200);
      expect(r1.body.snoozeCount).toBe(1);
      expect(r1.body.dismissCount).toBe(0);

      const r2 = await request(testApp.app)
        .post("/api/coach/follow-ups")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenA}`])
        .send({ answer: "dismissed" });
      expect(r2.status).toBe(200);
      expect(r2.body.snoozeCount).toBe(1);
      expect(r2.body.dismissCount).toBe(1);

      // Token B is unchanged.
      const statsB = await request(testApp.app)
        .get("/api/coach/follow-ups/stats")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${tokenB}`]);
      expect(statsB.body.snoozeCount).toBe(0);
      expect(statsB.body.dismissCount).toBe(1);

      // Track the rows the route created so cleanup removes them.
      const allForA = await db
        .select({ id: coachFollowUpsTable.id })
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.anonymousClaimToken, tokenA));
      for (const r of allForA) insertedIds.push(r.id);
    } finally {
      await cleanup();
    }
  });

  it("excludes anonymous snooze/dismiss from totalPrompts and lastAnswer", async () => {
    testApp.setUser(null);
    const token = makeToken();
    try {
      const t0 = new Date(Date.now() - 60_000);
      const seedRows = [
        { answer: "not_sent", createdAt: t0 },
        { answer: "sent", createdAt: new Date(t0.getTime() + 1000) },
        // snooze + dismiss are the MOST recent events — they must not become
        // lastAnswer and must not bump totalPrompts.
        { answer: "snoozed", createdAt: new Date(t0.getTime() + 2000) },
        { answer: "dismissed", createdAt: new Date(t0.getTime() + 3000) },
      ] as const;
      for (const v of seedRows) {
        const [row] = await db
          .insert(coachFollowUpsTable)
          .values({
            userId: null,
            anonymousClaimToken: token,
            answer: v.answer,
            createdAt: v.createdAt,
          })
          .returning({ id: coachFollowUpsTable.id });
        insertedIds.push(row.id);
      }

      const stats = await request(testApp.app)
        .get("/api/coach/follow-ups/stats")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`]);
      expect(stats.status).toBe(200);
      expect(stats.body.totalPrompts).toBe(2);
      expect(stats.body.sentCount).toBe(1);
      expect(stats.body.notSentCount).toBe(1);
      expect(stats.body.snoozeCount).toBe(1);
      expect(stats.body.dismissCount).toBe(1);
      expect(stats.body.lastAnswer).toBe("sent");
      expect(stats.body.lastAnsweredAt).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("does not leak signed-in counts to an anonymous caller", async () => {
    try {
      await recordSignedIn(TEST_USER_ID, "snoozed");
      await recordSignedIn(TEST_USER_ID, "dismissed");
      await recordSignedIn(TEST_USER_ID, "sent");

      testApp.setUser(null);
      const stats = await request(testApp.app).get(
        "/api/coach/follow-ups/stats",
      );
      // No cookie, no user → all zeros.
      expect(stats.status).toBe(200);
      expect(stats.body.snoozeCount).toBe(0);
      expect(stats.body.dismissCount).toBe(0);
      expect(stats.body.totalPrompts).toBe(0);
      expect(stats.body.lastAnswer).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
