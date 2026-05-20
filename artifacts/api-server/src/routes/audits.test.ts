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
  BulkDeleteAuditsResponse,
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

  it("on first generation returns no changeSummary, but on regeneration returns a diff vs the previous run", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });

    const first = await request(testApp.app)
      .post(`/api/audits/${id}/generate`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.changeSummary ?? null).toBeNull();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits").find((r) => r.id === id) as Record<string, unknown>;
    expect(row.report).not.toBeNull();
    const firstScore = row.readinessScore as number;

    // Mutate the stored report to simulate a prior run with different
    // strengths/risks/score so we can verify the diff math. dumpTable
    // returns the live rows array, so direct mutation is sufficient.
    row.readinessScore = 40;
    row.report = {
      ...(row.report as Record<string, unknown>),
      readinessScore: 40,
      strengths: ["Old strength A", "Shared strength"],
      risks: ["Old risk only"],
    };

    const second = await request(testApp.app)
      .post(`/api/audits/${id}/generate`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.changeSummary).toBeTruthy();
    expect(second.body.changeSummary.previousScore).toBe(40);
    expect(second.body.changeSummary.newScore).toBe(firstScore);
    expect(second.body.changeSummary.scoreDelta).toBe(firstScore - 40);
    expect(second.body.changeSummary.removedStrengths).toContain("Old strength A");
    expect(second.body.changeSummary.removedRisks).toContain("Old risk only");
    expect(Array.isArray(second.body.changeSummary.addedStrengths)).toBe(true);
    expect(Array.isArray(second.body.changeSummary.addedRisks)).toBe(true);

    const afterRegen = dumpTable("audits").find((r) => r.id === id) as
      | {
          previousReport?: Record<string, unknown> | null;
          previousReadinessScore?: number | null;
          previousReportGeneratedAt?: Date | null;
        }
      | undefined;
    expect(afterRegen?.previousReadinessScore).toBe(40);
    expect(afterRegen?.previousReport).toBeTruthy();
    expect(afterRegen?.previousReportGeneratedAt).toBeTruthy();
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

describe("GET /api/audits filters and pagination", () => {
  interface SeedRow {
    firstName: string;
    bio: string;
    readinessScore: number | null;
    createdAt?: Date;
  }

  async function seedAudits(rows: SeedRow[]): Promise<number[]> {
    const { db: testDb, auditsTable: tbl, dumpTable } = await import(
      "../lib/testDb"
    );
    const ids: number[] = [];
    for (const r of rows) {
      const [{ id }] = await testDb
        .insert(tbl)
        .values({
          firstName: r.firstName,
          age: 30,
          gender: "x",
          orientation: "straight",
          datingGoal: "find a relationship",
          currentApps: ["Hinge"],
          bio: r.bio,
          prompts: null,
          status: r.readinessScore === null ? "pending" : "complete",
          source: "manual",
          readinessScore: r.readinessScore,
          userId: USER_ID,
          anonymousClaimToken: null,
        })
        .returning({ id: tbl.id });
      ids.push(id as number);
    }
    // Reassign createdAt so newest-sort tests are deterministic.
    const stored = dumpTable("audits");
    for (let i = 0; i < rows.length; i++) {
      const target = stored.find((row) => row.id === ids[i]);
      if (target) {
        target.createdAt = rows[i].createdAt ?? new Date(2025, 0, i + 1);
      }
    }
    return ids;
  }

  it("filters by `q` against firstName and bio (case-insensitive)", async () => {
    await seedAudits([
      { firstName: "Alice", bio: "Loves climbing and pottery", readinessScore: 80 },
      { firstName: "Bob", bio: "Casual hiker", readinessScore: 60 },
      { firstName: "Charlie", bio: "Enjoys POTTERY classes", readinessScore: 40 },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits?q=pottery");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName).sort();
    expect(names).toEqual(["Alice", "Charlie"]);
  });

  it("treats `%` and `_` in `q` as literal characters, not SQL wildcards", async () => {
    await seedAudits([
      { firstName: "Alice", bio: "ordinary bio", readinessScore: 80 },
      { firstName: "Bob", bio: "another bio", readinessScore: 70 },
      { firstName: "Charlie", bio: "third bio", readinessScore: 60 },
    ]);

    testApp.setUser({ id: USER_ID });

    // None of the seeded rows contain `%`, so a search for `%` must NOT
    // be interpreted as the SQL "match anything" wildcard.
    const pctRes = await request(testApp.app).get("/api/audits?q=%25");
    expect(pctRes.status).toBe(200);
    expect(pctRes.body.length).toBe(0);

    // Same for `_` — it should be treated as a literal underscore, not
    // "match any single character".
    const underRes = await request(testApp.app).get("/api/audits?q=_");
    expect(underRes.status).toBe(200);
    expect(underRes.body.length).toBe(0);
  });

  it("sort=topScore orders by readinessScore desc", async () => {
    await seedAudits([
      { firstName: "Low", bio: "x", readinessScore: 30 },
      { firstName: "High", bio: "x", readinessScore: 90 },
      { firstName: "Mid", bio: "x", readinessScore: 60 },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits?sort=topScore");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName);
    expect(names).toEqual(["High", "Mid", "Low"]);
  });

  it("default sort returns newest first", async () => {
    await seedAudits([
      { firstName: "Oldest", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 1) },
      { firstName: "Middle", bio: "x", readinessScore: 50, createdAt: new Date(2025, 0, 5) },
      { firstName: "Newest", bio: "x", readinessScore: 60, createdAt: new Date(2025, 0, 9) },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName);
    expect(names).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("scoreRange=high returns only scores >= 75", async () => {
    await seedAudits([
      { firstName: "A", bio: "x", readinessScore: 74 },
      { firstName: "B", bio: "x", readinessScore: 75 },
      { firstName: "C", bio: "x", readinessScore: 99 },
      { firstName: "D", bio: "x", readinessScore: null },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits?scoreRange=high");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName).sort();
    expect(names).toEqual(["B", "C"]);
  });

  it("scoreRange=medium returns scores in [55, 75)", async () => {
    await seedAudits([
      { firstName: "A", bio: "x", readinessScore: 54 },
      { firstName: "B", bio: "x", readinessScore: 55 },
      { firstName: "C", bio: "x", readinessScore: 74 },
      { firstName: "D", bio: "x", readinessScore: 75 },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits?scoreRange=medium");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName).sort();
    expect(names).toEqual(["B", "C"]);
  });

  it("scoreRange=low returns scores < 55 and excludes null scores", async () => {
    await seedAudits([
      { firstName: "A", bio: "x", readinessScore: 10 },
      { firstName: "B", bio: "x", readinessScore: 54 },
      { firstName: "C", bio: "x", readinessScore: 55 },
      { firstName: "Pending", bio: "x", readinessScore: null },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits?scoreRange=low");
    expect(res.status).toBe(200);
    const names = res.body.map((a: { firstName: string }) => a.firstName).sort();
    expect(names).toEqual(["A", "B"]);
  });

  it("applies limit and offset for pagination", async () => {
    await seedAudits([
      { firstName: "R1", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 1) },
      { firstName: "R2", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 2) },
      { firstName: "R3", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 3) },
      { firstName: "R4", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 4) },
      { firstName: "R5", bio: "x", readinessScore: 80, createdAt: new Date(2025, 0, 5) },
    ]);

    testApp.setUser({ id: USER_ID });
    const page1 = await request(testApp.app).get("/api/audits?limit=2&offset=0");
    expect(page1.status).toBe(200);
    expect(page1.body.map((a: { firstName: string }) => a.firstName)).toEqual([
      "R5",
      "R4",
    ]);

    const page2 = await request(testApp.app).get("/api/audits?limit=2&offset=2");
    expect(page2.body.map((a: { firstName: string }) => a.firstName)).toEqual([
      "R3",
      "R2",
    ]);

    const page3 = await request(testApp.app).get("/api/audits?limit=2&offset=4");
    expect(page3.body.map((a: { firstName: string }) => a.firstName)).toEqual([
      "R1",
    ]);
  });

  it("clamps limit to [1, 100] and falls back to defaults on garbage values", async () => {
    await seedAudits(
      Array.from({ length: 3 }, (_, i) => ({
        firstName: `N${i}`,
        bio: "x",
        readinessScore: 80,
      })),
    );

    testApp.setUser({ id: USER_ID });
    const garbage = await request(testApp.app).get(
      "/api/audits?limit=not-a-number&offset=also-bogus",
    );
    expect(garbage.status).toBe(200);
    expect(garbage.body.length).toBe(3);

    const tooSmall = await request(testApp.app).get("/api/audits?limit=0");
    expect(tooSmall.status).toBe(200);
    // limit clamped up to 1
    expect(tooSmall.body.length).toBe(1);
  });

  it("combines q, scoreRange, sort, limit and offset together", async () => {
    await seedAudits([
      { firstName: "Pottery Pat", bio: "x", readinessScore: 90 },
      { firstName: "Pottery Sam", bio: "x", readinessScore: 80 },
      { firstName: "Pottery Lee", bio: "x", readinessScore: 60 },
      { firstName: "Climbing Kim", bio: "x", readinessScore: 95 },
    ]);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get(
      "/api/audits?q=pottery&scoreRange=high&sort=topScore&limit=1&offset=1",
    );
    expect(res.status).toBe(200);
    // Pottery + high (>=75) = Pat (90), Sam (80). Top-score sorted: Pat, Sam.
    // With offset=1, limit=1 → just Sam.
    expect(res.body.map((a: { firstName: string }) => a.firstName)).toEqual([
      "Pottery Sam",
    ]);
  });
});

describe("DELETE /api/audits/:id", () => {
  it("soft-deletes audits owned by the caller and hides them from the list", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).delete(`/api/audits/${id}`);
    expect(res.status).toBe(200);
    expect(() => DeleteAuditResponse.parse(res.body)).not.toThrow();
    expect(res.body.deletedId).toBe(id);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits").find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.deletedAt).toBeInstanceOf(Date);

    const list = await request(testApp.app).get("/api/audits");
    expect(list.status).toBe(200);
    expect(list.body.map((a: { id: number }) => a.id)).not.toContain(id);

    const get = await request(testApp.app).get(`/api/audits/${id}`);
    expect(get.status).toBe(404);
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

  it("returns 404 when soft-deleting an already-deleted audit", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    await request(testApp.app).delete(`/api/audits/${id}`);
    const res = await request(testApp.app).delete(`/api/audits/${id}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/audits/trash", () => {
  it("lists soft-deleted audits and excludes active ones", async () => {
    const activeId = await createAudit({ id: USER_ID });
    const deletedId = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    await request(testApp.app).delete(`/api/audits/${deletedId}`);

    const res = await request(testApp.app).get("/api/audits/trash");
    expect(res.status).toBe(200);
    expect(() => ListAuditsResponse.parse(res.body)).not.toThrow();
    const ids = res.body.map((a: { id: number }) => a.id);
    expect(ids).toContain(deletedId);
    expect(ids).not.toContain(activeId);
    expect(res.body[0].deletedAt).not.toBeNull();
  });

  it("scopes trash to the calling user", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createAudit({ id: otherUserId });
    testApp.setUser({ id: otherUserId });
    await request(testApp.app).delete(`/api/audits/${theirsId}`);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/audits/trash");
    expect(res.status).toBe(200);
    expect(res.body.map((a: { id: number }) => a.id)).not.toContain(theirsId);
  });
});

describe("POST /api/audits/:id/restore", () => {
  it("restores a soft-deleted audit and makes it visible again", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    await request(testApp.app).delete(`/api/audits/${id}`);

    const res = await request(testApp.app).post(`/api/audits/${id}/restore`);
    expect(res.status).toBe(200);
    expect(() => GetAuditResponse.parse(res.body)).not.toThrow();
    expect(res.body.id).toBe(id);
    expect(res.body.deletedAt).toBeNull();

    const list = await request(testApp.app).get("/api/audits");
    expect(list.body.map((a: { id: number }) => a.id)).toContain(id);
  });

  it("returns 404 when restoring an audit that isn't in the trash", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/restore`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when restoring someone else's deleted audit", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createAudit({ id: otherUserId });
    testApp.setUser({ id: otherUserId });
    await request(testApp.app).delete(`/api/audits/${theirsId}`);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(
      `/api/audits/${theirsId}/restore`,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/audits/:id/purge", () => {
  it("hard-deletes audits already in the trash", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    await request(testApp.app).delete(`/api/audits/${id}`);

    const res = await request(testApp.app).delete(
      `/api/audits/${id}/purge`,
    );
    expect(res.status).toBe(200);
    expect(() => DeleteAuditResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("audits").find((r) => r.id === id)).toBeUndefined();
  });

  it("returns 404 when purging an audit that hasn't been soft-deleted", async () => {
    const id = await createAudit({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).delete(
      `/api/audits/${id}/purge`,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/audits/bulk-delete", () => {
  it("deletes only the caller's owned ids and skips ids belonging to others", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const mine1 = await createAudit({ id: USER_ID });
    const mine2 = await createAudit({ id: USER_ID });
    const theirs = await createAudit({ id: otherUserId });

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits/bulk-delete")
      .send({ ids: [mine1, mine2, theirs, 999999999] });

    expect(res.status).toBe(200);
    expect(() => BulkDeleteAuditsResponse.parse(res.body)).not.toThrow();
    expect(res.body.success).toBe(true);
    expect([...res.body.deletedIds].sort()).toEqual([mine1, mine2].sort());

    const { dumpTable } = await import("../lib/testDb");
    const remaining = dumpTable("audits").map((r) => r.id);
    expect(remaining).not.toContain(mine1);
    expect(remaining).not.toContain(mine2);
    expect(remaining).toContain(theirs);
  });

  it("scopes anonymous bulk deletes by anon_claim cookie", async () => {
    // Anonymous A creates two audits and gets a cookie back.
    testApp.setUser(null);
    const createA1 = await request(testApp.app).post("/api/audits").send(VALID_BODY);
    expect(createA1.status).toBe(201);
    const cookieA = (Array.isArray(createA1.headers["set-cookie"])
      ? createA1.headers["set-cookie"]
      : [createA1.headers["set-cookie"] ?? ""]) as string[];
    const anonCookieA = cookieA
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("anon_claim=")) as string;
    expect(anonCookieA).toBeDefined();

    const createA2 = await request(testApp.app)
      .post("/api/audits")
      .set("Cookie", anonCookieA)
      .send(VALID_BODY);
    expect(createA2.status).toBe(201);
    const a1Id = createA1.body.id as number;
    const a2Id = createA2.body.id as number;

    // Anonymous B creates an audit with a different cookie.
    const createB = await request(testApp.app).post("/api/audits").send(VALID_BODY);
    expect(createB.status).toBe(201);
    const cookieB = (Array.isArray(createB.headers["set-cookie"])
      ? createB.headers["set-cookie"]
      : [createB.headers["set-cookie"] ?? ""]) as string[];
    const anonCookieB = cookieB
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("anon_claim=")) as string;
    const bId = createB.body.id as number;
    expect(anonCookieB).toBeDefined();
    expect(anonCookieB).not.toBe(anonCookieA);

    // Anonymous A also tries to delete an audit owned by an authed user.
    const authedId = await createAudit({ id: USER_ID });

    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/audits/bulk-delete")
      .set("Cookie", anonCookieA)
      .send({ ids: [a1Id, a2Id, bId, authedId] });

    expect(res.status).toBe(200);
    expect(() => BulkDeleteAuditsResponse.parse(res.body)).not.toThrow();
    expect([...res.body.deletedIds].sort()).toEqual([a1Id, a2Id].sort());

    const { dumpTable } = await import("../lib/testDb");
    const remaining = dumpTable("audits").map((r) => r.id);
    expect(remaining).not.toContain(a1Id);
    expect(remaining).not.toContain(a2Id);
    expect(remaining).toContain(bId);
    expect(remaining).toContain(authedId);
  });

  it("returns an empty deletedIds list (not 404) when caller owns none of the ids", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirs1 = await createAudit({ id: otherUserId });
    const theirs2 = await createAudit({ id: otherUserId });

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits/bulk-delete")
      .send({ ids: [theirs1, theirs2] });

    expect(res.status).toBe(200);
    expect(() => BulkDeleteAuditsResponse.parse(res.body)).not.toThrow();
    expect(res.body.deletedIds).toEqual([]);

    const { dumpTable } = await import("../lib/testDb");
    const remaining = dumpTable("audits").map((r) => r.id);
    expect(remaining).toContain(theirs1);
    expect(remaining).toContain(theirs2);
  });

  it("returns 400 when ids is empty", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits/bulk-delete")
      .send({ ids: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when ids has more than 200 entries", async () => {
    testApp.setUser({ id: USER_ID });
    const ids = Array.from({ length: 201 }, (_, i) => i + 1);
    const res = await request(testApp.app)
      .post("/api/audits/bulk-delete")
      .send({ ids });
    expect(res.status).toBe(400);
  });
});
