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
  const lifePulseRouter = (await import("./lifePulse")).default;
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

  app.use("/api", lifePulseRouter);

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

const USER_A = `test-pulse-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-pulse-user-b-${crypto.randomBytes(6).toString("hex")}`;

const VALID = { sleep: 4, energy: 3, social: 5, money: 2, headspace: 4, note: "Good morning run" };

describe("POST /api/life-pulse", () => {
  it("rejects invalid bodies with 400", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/life-pulse")
      .send({ sleep: 9, energy: 3, social: 3, money: 3, headspace: 3 });
    expect(res.status).toBe(400);
  });

  it("creates a pulse scoped to the authenticated user", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/life-pulse").send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.sleep).toBe(4);
    expect(res.body.note).toBe("Good morning run");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("creates a pulse for anonymous callers and binds an anon claim cookie", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/life-pulse").send(VALID);
    expect(res.status).toBe(201);
    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie) ? setCookie.join(",") : String(setCookie ?? "")).toMatch(/anon_claim/);
  });
});

describe("GET /api/life-pulse", () => {
  it("only returns pulses owned by the requesting user", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/life-pulse").send({ ...VALID, sleep: 5 });

    testApp.setUser({ id: USER_B });
    await request(testApp.app).post("/api/life-pulse").send({ ...VALID, sleep: 1 });

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/life-pulse");
    expect(res.status).toBe(200);
    expect(res.body.pulses.length).toBeGreaterThan(0);
    for (const p of res.body.pulses) expect(p.sleep).toBe(5);
    expect(res.body.latest.sleep).toBe(5);
  });

  it("returns empty list when caller has neither a user nor an anon token", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/life-pulse");
    expect(res.status).toBe(200);
    expect(res.body.pulses).toEqual([]);
    expect(res.body.latest).toBeNull();
  });

  it("does not leak anonymous pulses from another browser to a fresh anon caller", async () => {
    // Anon browser A logs a pulse (cookie set on response).
    testApp.setUser(null);
    const seed = await request(testApp.app).post("/api/life-pulse").send({ ...VALID, sleep: 2 });
    expect(seed.status).toBe(201);

    // A different anon caller with no cookie must see nothing.
    const res = await request(testApp.app).get("/api/life-pulse");
    expect(res.status).toBe(200);
    expect(res.body.pulses).toEqual([]);
  });
});
