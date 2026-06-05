import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
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

import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const dailySparkRouter = (await import("./dailySpark")).default;
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

  app.use("/api", dailySparkRouter);

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

let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const USER_A = `test-spark-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-spark-user-b-${crypto.randomBytes(6).toString("hex")}`;

describe("POST /api/me/daily-spark", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "q1", choice: "a" });
    expect(res.status).toBe(401);
  });

  it("rejects invalid bodies with 400", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "" });
    expect(res.status).toBe(400);
  });

  it("records an answer scoped to the authenticated user", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "q1", choice: "playful" });
    expect(res.status).toBe(201);
    expect(res.body.questionId).toBe("q1");
    expect(res.body.choice).toBe("playful");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("answering the same question again updates the choice in place (deduped)", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "q-dedupe", choice: "first" });
    await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "q-dedupe", choice: "second" });

    const res = await request(testApp.app).get("/api/me/daily-spark");
    expect(res.status).toBe(200);
    const forQuestion = res.body.filter(
      (r: { questionId: string }) => r.questionId === "q-dedupe",
    );
    expect(forQuestion).toHaveLength(1);
    expect(forQuestion[0].choice).toBe("second");
  });
});

describe("GET /api/me/daily-spark", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/daily-spark");
    expect(res.status).toBe(401);
  });

  it("only returns answers owned by the requesting user", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "qa", choice: "a" });

    testApp.setUser({ id: USER_B });
    await request(testApp.app)
      .post("/api/me/daily-spark")
      .send({ questionId: "qb", choice: "b" });

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/daily-spark");
    expect(res.status).toBe(200);
    for (const r of res.body) {
      expect(r.questionId).not.toBe("qb");
    }
    expect(res.body.some((r: { questionId: string }) => r.questionId === "qa")).toBe(true);
  });
});
