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
  const predictionsRouter = (await import("./predictions")).default;
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
  app.use("/api", predictionsRouter);
  return { app, setUser: (user) => { currentUser = user; } };
}

let testApp: TestApp;
beforeAll(async () => { testApp = await makeTestApp(); });

let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const USER_A = `test-prediction-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-prediction-user-b-${crypto.randomBytes(6).toString("hex")}`;

describe("prediction response API", () => {
  it("rejects unauthenticated capture", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/me/predictions").send({ itemId: "r1", predicted: 2, actual: 3 });
    expect(res.status).toBe(401);
  });

  it("saves privately with every downstream permission closed", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/predictions").send({ itemId: "r-private", predicted: 2, actual: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      itemId: "r-private",
      predicted: 2,
      actual: 3,
      echoUseAllowed: false,
      learningConfirmed: false,
      matchingUseAllowed: false,
    });
  });

  it("replaying updates the counts without creating a duplicate", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "r-repeat", predicted: 1, actual: 2 });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "r-repeat", predicted: 4, actual: 5 });
    const res = await request(testApp.app).get("/api/me/predictions");
    const rows = res.body.filter((row: { itemId: string }) => row.itemId === "r-repeat");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ predicted: 4, actual: 5 });
  });

  it("returns only the requesting member's rounds", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "mine", predicted: 1, actual: 1 });
    testApp.setUser({ id: USER_B });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "theirs", predicted: 2, actual: 2 });
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/predictions");
    expect(res.body.some((row: { itemId: string }) => row.itemId === "mine")).toBe(true);
    expect(res.body.some((row: { itemId: string }) => row.itemId === "theirs")).toBe(false);
  });

  it("updates independent permissions without changing the round", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "r-permissions", predicted: 3, actual: 4 });
    const res = await request(testApp.app).patch("/api/me/predictions/r-permissions/permissions").send({ learningConfirmed: true, matchingUse: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ predicted: 3, actual: 4, learningConfirmed: true, matchingUseAllowed: true, echoUseAllowed: false });
  });

  it("rejects empty and cross-member permission updates", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/predictions").send({ itemId: "r-owned", predicted: 1, actual: 1 });
    const empty = await request(testApp.app).patch("/api/me/predictions/r-owned/permissions").send({});
    expect(empty.status).toBe(400);
    testApp.setUser({ id: USER_B });
    const other = await request(testApp.app).patch("/api/me/predictions/r-owned/permissions").send({ matchingUse: true });
    expect(other.status).toBe(404);
  });
});
