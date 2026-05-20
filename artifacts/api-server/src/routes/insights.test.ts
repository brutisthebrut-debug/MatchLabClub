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

import { AnalyzeInsightResponse, ListInsightsResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const insightsRouter = (await import("./insights")).default;
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
  app.use("/api", insightsRouter);
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

const USER_ID = `test-insight-user-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  sourceLabel: "Gmail export — past 6 months",
  pastedContent:
    "Sample exchange: I usually wait two days to reply because I overthink the right tone. She said it made her feel like a backup plan. I tried to explain, but it came out defensive.",
  consentGiven: true,
};

async function createInsight(userId: string): Promise<number> {
  testApp.setUser({ id: userId });
  const res = await request(testApp.app).post("/api/insights").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/insights", () => {
  it("returns 400 on invalid bodies", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights").send({ pastedContent: 42 });
    expect(res.status).toBe(400);
  });

  it("creates an insight row tied to the caller", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.sourceLabel).toBe(VALID_BODY.sourceLabel);
  });
});

describe("GET /api/insights", () => {
  it("returns a contract-shaped list", async () => {
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/insights");
    expect(res.status).toBe(200);
    expect(() => ListInsightsResponse.parse(res.body)).not.toThrow();
    const ids = res.body.map((i: { id: number }) => i.id);
    expect(ids).toContain(id);
  });
});

describe("POST /api/insights/:id/analyze", () => {
  it("returns analysis matching AnalyzeInsightResponse and marks complete", async () => {
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(res.body.insightId).toBe(id);
    expect(Array.isArray(res.body.communicationPatterns)).toBe(true);
    expect(Array.isArray(res.body.datingProfileTips)).toBe(true);
    expect(res.body.summary.length).toBeGreaterThan(0);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.status).toBe("complete");
  });

  it("returns 404 when not owned by the caller", async () => {
    const otherId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const id = await createInsight(otherId);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric ids", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights/abc/analyze").send({});
    expect(res.status).toBe(400);
  });

  it("backfills sourceApp on the row when the engine detects one and the row didn't have it set", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "Hinge conversation export",
      pastedContent:
        "We matched on Hinge a few weeks back. Replies were short, mostly about her travel prompt. haha thanks for the chat.",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const { dumpTable } = await import("../lib/testDb");
    const beforeRow = dumpTable("email_insights").find((r) => r.id === id);
    expect(beforeRow?.sourceApp ?? null).toBeNull();

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBe("Hinge");

    const afterRow = dumpTable("email_insights").find((r) => r.id === id);
    expect(afterRow?.sourceApp).toBe("Hinge");
    expect(afterRow?.status).toBe("complete");
  });

  it("does not overwrite an existing sourceApp on the row", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "exported chat",
      pastedContent: "we matched on tinder and chatted",
      sourceApp: "Bumble",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBe("Bumble");

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.sourceApp).toBe("Bumble");
  });

  it("leaves sourceApp null on the row when the engine cannot detect a source", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "untitled clipboard paste",
      pastedContent: "just some generic chatter about weekend plans and coffee",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBeNull();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.sourceApp ?? null).toBeNull();
  });
});
