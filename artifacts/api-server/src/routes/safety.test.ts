import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
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
  const safetyRouter = (await import("./safety")).default;
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

  app.use("/api", safetyRouter);

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

const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `safety-a-${suffix}`;
const USER_B = `safety-b-${suffix}`;

describe("POST /api/me/safety/report", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "harassment" });
    expect(res.status).toBe(401);
  });

  it("400s when reporting yourself", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_A, reason: "harassment" });
    expect(res.status).toBe(400);
  });

  it("400s on an unknown reason", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "not-a-real-reason" });
    expect(res.status).toBe(400);
  });

  it("files a report and returns its id", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "scam", context: "match" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.reportId).toBe("number");
  });
});

describe("safety block / list / unblock", () => {
  it("401s for an anonymous caller blocking", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });
    expect(res.status).toBe(401);
  });

  it("400s when blocking yourself", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_A });
    expect(res.status).toBe(400);
  });

  it("blocks, lists, and is idempotent", async () => {
    testApp.setUser({ id: USER_A });
    const first = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B, reason: "harassment" });
    expect(first.status).toBe(201);
    expect(first.body.blockedUserId).toBe(USER_B);

    // Blocking again must not create a duplicate row.
    const second = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });
    expect(second.status).toBe(201);

    const list = await request(testApp.app).get("/api/me/safety/block");
    expect(list.status).toBe(200);
    const mine = list.body.blocks.filter(
      (b: { blockedUserId: string }) => b.blockedUserId === USER_B,
    );
    expect(mine.length).toBe(1);
  });

  it("unblocks and is idempotent for a non-existent block", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });

    const undo = await request(testApp.app).delete(
      `/api/me/safety/block/${USER_B}`,
    );
    expect(undo.status).toBe(200);
    expect(undo.body.ok).toBe(true);

    const list = await request(testApp.app).get("/api/me/safety/block");
    const mine = list.body.blocks.filter(
      (b: { blockedUserId: string }) => b.blockedUserId === USER_B,
    );
    expect(mine.length).toBe(0);

    // Undoing again on an already-removed block still returns ok.
    const again = await request(testApp.app).delete(
      `/api/me/safety/block/${USER_B}`,
    );
    expect(again.status).toBe(200);
    expect(again.body.ok).toBe(true);
  });
});
