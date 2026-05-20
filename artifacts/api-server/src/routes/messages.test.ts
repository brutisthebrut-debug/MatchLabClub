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
  CoachMessageResponse,
  ListMessageCoachingSessionsResponse,
} from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const messagesRouter = (await import("./messages")).default;
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

  app.use("/api", messagesRouter);

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

const USER_ID = `test-msg-user-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  matchName: "Sam",
  conversationContext:
    "We matched on Hinge two days ago. They commented on my hiking prompt. I sent a friendly opener but they took 18 hours to reply with a one-liner.",
  yourLastMessage: "Haha fair — what's your favorite trail near here?",
  goal: "keep momentum without being pushy",
};

async function createSession(userId: string | null): Promise<number> {
  testApp.setUser(userId ? { id: userId } : null);
  const res = await request(testApp.app).post("/api/messages").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/messages", () => {
  it("returns 400 when the body fails Zod validation", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/messages").send({ matchName: "x" });
    expect(res.status).toBe(400);
  });

  it("creates a session for an authenticated user", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/messages").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf("number");
    expect(res.body.status).toBe("pending");
    expect(res.body.matchName).toBe(VALID_BODY.matchName);
  });
});

describe("GET /api/messages", () => {
  it("returns a contract-shaped list scoped to the caller", async () => {
    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/messages");
    expect(res.status).toBe(200);
    expect(() => ListMessageCoachingSessionsResponse.parse(res.body)).not.toThrow();
    const ids = res.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(id);
  });
});

describe("POST /api/messages/:id/coach", () => {
  it("returns coaching output matching CoachMessageResponse and marks the session complete", async () => {
    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});
    expect(res.status).toBe(200);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
    expect(res.body.sessionId).toBe(id);
    expect(Array.isArray(res.body.suggestedReplies)).toBe(true);
    expect(res.body.suggestedReplies.length).toBeGreaterThan(0);
    for (const reply of res.body.suggestedReplies) {
      expect(reply.style).toBeTypeOf("string");
      expect(reply.text).toBeTypeOf("string");
      expect(reply.rationale).toBeTypeOf("string");
    }

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("message_coaching_sessions").find((r) => r.id === id);
    expect(row?.status).toBe("complete");
  });

  it("returns 404 when the session isn't owned by the caller", async () => {
    const otherId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const id = await createSession(otherId);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/messages/nope/coach").send({});
    expect(res.status).toBe(400);
  });
});
