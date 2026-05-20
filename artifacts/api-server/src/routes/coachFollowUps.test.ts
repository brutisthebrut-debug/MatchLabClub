import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return {
    ...actual,
    eq: fake.eq,
    and: fake.and,
    or: fake.or,
    isNull: fake.isNull,
    isNotNull: fake.isNotNull,
    gte: fake.gte,
    lt: fake.lt,
    ilike: fake.ilike,
    inArray: fake.inArray,
    desc: fake.desc,
    asc: fake.asc,
    sql: fake.sql,
  };
});

import {
  RecordCoachFollowUpBody,
  RecordCoachFollowUpResponse,
  GetCoachFollowUpStatsResponse,
} from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const coachFollowUpsRouter = (await import("./coachFollowUps")).default;
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

beforeAll(async () => {
  testApp = await makeTestApp();
});

beforeEach(async () => {
  const { resetTestDb } = await import("../lib/testDb");
  resetTestDb();
});

const USER_ID = `test-coach-fu-user-${crypto.randomBytes(6).toString("hex")}`;

describe("POST /api/coach/follow-ups", () => {
  it("returns 400 when the body fails Zod validation", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ answer: "maybe" }); // not in enum
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer is missing", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ sessionId: 1 });
    expect(res.status).toBe(400);
  });

  it("records a follow-up for an authenticated user and returns stats in the contract shape", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ answer: "sent", sessionId: 42 });
    expect(res.status).toBe(200);
    expect(() => RecordCoachFollowUpResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("coach_follow_ups");
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe(USER_ID);
    expect(rows[0].anonymousClaimToken).toBeNull();
    expect(rows[0].answer).toBe("sent");
    expect(rows[0].sessionId).toBe(42);
    expect(res.body.followUpId).toBe(rows[0].id);
  });

  it("records an anonymous follow-up and sets the anon_claim cookie when no user is signed in", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ answer: "not_sent" });
    expect(res.status).toBe(200);
    expect(() => RecordCoachFollowUpResponse.parse(res.body)).not.toThrow();

    const setCookie = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
    expect(cookieHeader).toMatch(/anon_claim=/);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("coach_follow_ups");
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].anonymousClaimToken).not.toBeNull();
    expect(rows[0].answer).toBe("not_sent");
  });

  it("scopes anonymous follow-ups by anon_claim cookie", async () => {
    // Anon A
    testApp.setUser(null);
    const a = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ answer: "sent" });
    expect(a.status).toBe(200);
    const cookiesA = (Array.isArray(a.headers["set-cookie"])
      ? a.headers["set-cookie"]
      : [a.headers["set-cookie"] ?? ""]) as string[];
    const anonCookieA = cookiesA
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("anon_claim=")) as string;
    expect(anonCookieA).toBeDefined();

    // Anon B (fresh cookie)
    const b = await request(testApp.app)
      .post("/api/coach/follow-ups")
      .send({ answer: "snoozed" });
    expect(b.status).toBe(200);
    const cookiesB = (Array.isArray(b.headers["set-cookie"])
      ? b.headers["set-cookie"]
      : [b.headers["set-cookie"] ?? ""]) as string[];
    const anonCookieB = cookiesB
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("anon_claim=")) as string;
    expect(anonCookieB).toBeDefined();
    expect(anonCookieB).not.toBe(anonCookieA);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("coach_follow_ups");
    expect(rows.length).toBe(2);
    const tokens = rows.map((r) => r.anonymousClaimToken);
    expect(new Set(tokens).size).toBe(2);
  });

  it("RecordCoachFollowUpBody zod schema accepts the same bodies the route accepts", () => {
    for (const answer of ["sent", "not_sent", "snoozed", "dismissed"] as const) {
      expect(() => RecordCoachFollowUpBody.parse({ answer })).not.toThrow();
    }
    expect(() => RecordCoachFollowUpBody.parse({ answer: "sent", sessionId: 7 })).not.toThrow();
  });
});

describe("GET /api/coach/follow-ups/stats", () => {
  it("returns a contract-shaped response for an authenticated caller", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/coach/follow-ups/stats");
    expect(res.status).toBe(200);
    expect(() => GetCoachFollowUpStatsResponse.parse(res.body)).not.toThrow();
  });

  it("returns a contract-shaped response for an anonymous caller with no cookie", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/coach/follow-ups/stats");
    expect(res.status).toBe(200);
    expect(() => GetCoachFollowUpStatsResponse.parse(res.body)).not.toThrow();
    expect(res.body.totalPrompts).toBe(0);
    expect(res.body.sentCount).toBe(0);
    expect(res.body.lastAnsweredAt).toBeNull();
    expect(res.body.lastAnswer).toBeNull();
  });

  it("returns a contract-shaped response after the caller has recorded follow-ups", async () => {
    testApp.setUser({ id: USER_ID });
    for (const answer of ["sent", "not_sent", "snoozed"] as const) {
      const r = await request(testApp.app)
        .post("/api/coach/follow-ups")
        .send({ answer });
      expect(r.status).toBe(200);
    }

    const res = await request(testApp.app).get("/api/coach/follow-ups/stats");
    expect(res.status).toBe(200);
    expect(() => GetCoachFollowUpStatsResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("coach_follow_ups").length).toBe(3);
  });
});
