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
  const timeCapsulesRouter = (await import("./timeCapsules")).default;
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
  app.use("/api", timeCapsulesRouter);
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

const USER_A = `test-capsule-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-capsule-user-b-${crypto.randomBytes(6).toString("hex")}`;

describe("Time Capsule API", () => {
  it("rejects unauthenticated capture", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/me/time-capsules").send({ body: "A private note" });
    expect(res.status).toBe(401);
  });

  it("saves privately with every downstream permission closed", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/time-capsules").send({ body: "I hope we laugh often." });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      body: "I hope we laugh often.",
      echoUseAllowed: false,
      learningConfirmed: false,
      matchingUseAllowed: false,
    });
    expect(typeof res.body.id).toBe("number");
  });

  it("returns only the requesting member's notes", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/time-capsules").send({ body: "Mine" });
    testApp.setUser({ id: USER_B });
    await request(testApp.app).post("/api/me/time-capsules").send({ body: "Theirs" });
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/time-capsules");
    expect(res.body.some((row: { body: string }) => row.body === "Mine")).toBe(true);
    expect(res.body.some((row: { body: string }) => row.body === "Theirs")).toBe(false);
  });

  it("updates independent permissions without changing the private body", async () => {
    testApp.setUser({ id: USER_A });
    const saved = await request(testApp.app).post("/api/me/time-capsules").send({ body: "Keep this exact note." });
    const res = await request(testApp.app)
      .patch(`/api/me/time-capsules/${saved.body.id}/permissions`)
      .send({ learningConfirmed: true, matchingUse: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      body: "Keep this exact note.",
      learningConfirmed: true,
      matchingUseAllowed: true,
      echoUseAllowed: false,
    });
  });

  it("rejects invalid ids and empty permission changes", async () => {
    testApp.setUser({ id: USER_A });
    const invalid = await request(testApp.app).patch("/api/me/time-capsules/not-an-id/permissions").send({ matchingUse: true });
    expect(invalid.status).toBe(400);
    const saved = await request(testApp.app).post("/api/me/time-capsules").send({ body: "Owned" });
    const empty = await request(testApp.app).patch(`/api/me/time-capsules/${saved.body.id}/permissions`).send({});
    expect(empty.status).toBe(400);
  });

  it("does not let another member update an owned note", async () => {
    testApp.setUser({ id: USER_A });
    const saved = await request(testApp.app).post("/api/me/time-capsules").send({ body: "Owner only" });
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app)
      .patch(`/api/me/time-capsules/${saved.body.id}/permissions`)
      .send({ matchingUse: true });
    expect(res.status).toBe(404);
  });
});
