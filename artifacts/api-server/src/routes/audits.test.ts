import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

// Replace the real Postgres-backed @workspace/db and drizzle-orm operators
// with in-memory equivalents so the route handlers can be exercised without
// any real database connection.
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
  CreateAuditBody,
  GetAuditResponse,
  ListAuditsResponse,
  GenerateAuditReportResponse,
  GetAuditSummaryResponse,
  DeleteAuditResponse,
} from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const auditsRouter = (await import("./audits")).default;
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

  app.use("/api", auditsRouter);

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

const USER_ID = `test-audit-user-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  firstName: "Riley",
  age: 31,
  gender: "f",
  orientation: "straight",
  datingGoal: "find a relationship",
  currentApps: ["Hinge", "Bumble"],
  bio: "Yoga teacher who loves long hikes and slow Sundays. Looking for someone who values curiosity over cleverness.",
  prompts: "Best travel story: getting lost in Lisbon and stumbling into the best meal of my life.",
  recentMessageSample: null,
  photoCount: 5,
  relationshipHistory: null,
  biggestChallenge: "matching but no replies",
};

async function createAudit(
  user: { id: string } | null = { id: USER_ID },
  overrides: Partial<typeof VALID_BODY> = {},
): Promise<number> {
  testApp.setUser(user);
  const res = await request(testApp.app)
    .post("/api/audits")
    .send({ ...VALID_BODY, ...overrides });
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/audits", () => {
  it("validates body with Zod and returns 400 on bad input", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits")
      .send({ firstName: "x" });
    expect(res.status).toBe(400);
  });

  it("creates an audit for an authenticated user with the contract shape", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/audits").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(() => GetAuditResponse.parse(res.body)).not.toThrow();
    expect(res.body.status).toBe("pending");
    expect(res.body.source).toBe("manual");
    expect(res.body.report).toBeNull();

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("audits");
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe(USER_ID);
    expect(rows[0].anonymousClaimToken).toBeNull();
  });

  it("creates an anonymous audit and sets the anon cookie when no user is signed in", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/audits").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(() => GetAuditResponse.parse(res.body)).not.toThrow();

    const setCookie = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
    expect(cookieHeader).toMatch(/anon_claim=/);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("audits");
    expect(rows[0].userId).toBeNull();
    expect(rows[0].anonymousClaimToken).not.toBeNull();
  });

  it("CreateAuditBody zod schema accepts the same body the route accepts", () => {
    expect(() => CreateAuditBody.parse(VALID_BODY)).not.toThrow();
  });
});

describe("GET /api/audits", () => {
  it("lists audits scoped to the caller", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const mineId = await createAudit({ id: USER_ID });
    const theirsId = await createAudit({ id: otherUserId });

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits");
    expect(res.status).toBe(200);
    expect(() => ListAuditsResponse.parse(res.body)).not.toThrow();

    const ids = res.body.map((a: { id: number }) => a.id);
    expect(ids).toContain(mineId);
    expect(ids).not.toContain(theirsId);
  });

  it("returns an empty list when the caller has no audits and no cookie", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/audits");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});

describe("GET /api/audits/:id", () => {
  it("returns 404 when the audit isn't owned by the caller", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createAudit({ id: otherUserId });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get(`/api/audits/${theirsId}`);
    expect(res.status).toBe(404);
  });

  it("returns the audit in the contract shape when owned", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get(`/api/audits/${id}`);
    expect(res.status).toBe(200);
    expect(() => GetAuditResponse.parse(res.body)).not.toThrow();
    expect(res.body.id).toBe(id);
  });

  it("returns 400 on a non-numeric id", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits/not-a-number");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/audits/:id/generate", () => {
  it("returns a generated report matching GenerateAuditReportResponse", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/generate`).send({});
    expect(res.status).toBe(200);
    expect(() => GenerateAuditReportResponse.parse(res.body)).not.toThrow();
    expect(res.body.auditId).toBe(id);
    expect(res.body.readinessScore).toBeGreaterThan(0);
    expect(res.body.rewrittenBio.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.actionPlan)).toBe(true);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits").find((r) => r.id === id);
    expect(row?.status).toBe("complete");
    expect(row?.readinessScore).toBe(res.body.readinessScore);
    expect(row?.report).not.toBeNull();
  });

  it("returns 404 when the audit doesn't exist for the caller", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits/999999999/generate")
      .send({});
    expect(res.status).toBe(404);
  });
});

describe("GET /api/audits/summary", () => {
  it("returns an empty summary contract for callers with no audits", async () => {
    const freshUser = { id: `summary-empty-${crypto.randomBytes(4).toString("hex")}` };
    testApp.setUser(freshUser);
    const res = await request(testApp.app).get("/api/audits/summary");
    expect(res.status).toBe(200);
    expect(() => GetAuditSummaryResponse.parse(res.body)).not.toThrow();
    expect(res.body.totalAudits).toBe(0);
    expect(res.body.latestScore).toBeNull();
    expect(res.body.scoreHistory).toEqual([]);
  });

  it("aggregates scores after audits are generated", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    await request(testApp.app).post(`/api/audits/${id}/generate`).send({});

    const res = await request(testApp.app).get("/api/audits/summary");
    expect(res.status).toBe(200);
    expect(() => GetAuditSummaryResponse.parse(res.body)).not.toThrow();
    expect(res.body.totalAudits).toBeGreaterThan(0);
    expect(res.body.latestScore).not.toBeNull();
    expect(res.body.scoreHistory.length).toBeGreaterThan(0);
  });
});

describe("DELETE /api/audits/:id", () => {
  it("deletes only audits owned by the caller", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).delete(`/api/audits/${id}`);
    expect(res.status).toBe(200);
    expect(() => DeleteAuditResponse.parse(res.body)).not.toThrow();
    expect(res.body.deletedId).toBe(id);

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("audits").find((r) => r.id === id)).toBeUndefined();
  });

  it("returns 404 when trying to delete someone else's audit", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createAudit({ id: otherUserId });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).delete(`/api/audits/${theirsId}`);
    expect(res.status).toBe(404);

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("audits").find((r) => r.id === theirsId)).toBeDefined();
  });
});
