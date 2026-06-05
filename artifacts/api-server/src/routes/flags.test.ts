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
  const flagsRouter = (await import("./flags")).default;
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

  app.use("/api", flagsRouter);

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

const USER_A = `test-flags-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-flags-user-b-${crypto.randomBytes(6).toString("hex")}`;

describe("PUT /api/me/flags", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: ["a"], seekFlags: ["b"] });
    expect(res.status).toBe(401);
  });

  it("rejects invalid bodies with 400", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("stores the selection scoped to the authenticated user", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: ["communicates-openly", "owns-mistakes"], seekFlags: ["calm-in-conflict"] });
    expect(res.status).toBe(200);
    expect(res.body.bringFlags).toEqual(["communicates-openly", "owns-mistakes"]);
    expect(res.body.seekFlags).toEqual(["calm-in-conflict"]);
    expect(typeof res.body.updatedAt).toBe("string");
  });

  it("replaces the selection in place on a second PUT (one accumulating row)", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: ["one"], seekFlags: ["two"] });
    await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: ["three"], seekFlags: ["four", "five"] });

    const res = await request(testApp.app).get("/api/me/flags");
    expect(res.status).toBe(200);
    expect(res.body.bringFlags).toEqual(["three"]);
    expect(res.body.seekFlags).toEqual(["four", "five"]);
  });
});

describe("GET /api/me/flags", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/flags");
    expect(res.status).toBe(401);
  });

  it("returns an empty selection when the user has none", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app).get("/api/me/flags");
    expect(res.status).toBe(200);
    expect(res.body.bringFlags).toEqual([]);
    expect(res.body.seekFlags).toEqual([]);
    expect(res.body.updatedAt).toBeNull();
  });

  it("does not leak another user's selection", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .put("/api/me/flags")
      .send({ bringFlags: ["mine"], seekFlags: [] });

    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app).get("/api/me/flags");
    expect(res.status).toBe(200);
    expect(res.body.bringFlags).toEqual([]);
  });
});
