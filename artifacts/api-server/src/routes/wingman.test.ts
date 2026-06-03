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
  const wingmanRouter = (await import("./wingman")).default;
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

  app.use("/", wingmanRouter);

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

const OWNER = `test-wingman-owner-${crypto.randomBytes(6).toString("hex")}`;

const VALID = { warmth: 4, humor: 3, drive: 5, openness: 2, steadiness: 4 };

function tokenFromPath(path: string): string {
  const marker = "/wingman/r/";
  const idx = path.indexOf(marker);
  expect(idx).toBeGreaterThanOrEqual(0);
  return path.slice(idx + marker.length);
}

async function mintInviteToken(): Promise<string> {
  testApp.setUser({ id: OWNER });
  const res = await request(testApp.app)
    .post("/me/wingman/invites")
    .send({ friendLabel: "A friend" });
  expect(res.status).toBe(201);
  expect(typeof res.body.path).toBe("string");
  return tokenFromPath(res.body.path);
}

describe("PUT /me/wingman/self", () => {
  it("rejects fractional ratings with 400", async () => {
    testApp.setUser({ id: OWNER });
    const res = await request(testApp.app)
      .put("/me/wingman/self")
      .send({ ...VALID, warmth: 3.5 });
    expect(res.status).toBe(400);
  });

  it("stores whole-number self ratings", async () => {
    testApp.setUser({ id: OWNER });
    const res = await request(testApp.app).put("/me/wingman/self").send(VALID);
    expect(res.status).toBe(200);
    expect(res.body.selfRatings.warmth).toBe(4);
  });
});

describe("POST /wingman/invite/:token/answer", () => {
  it("returns 404 for an invalid token", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/wingman/invite/not-a-real-token/answer")
      .send(VALID);
    expect(res.status).toBe(404);
  });

  it("rejects fractional ratings with 400 before consuming the invite", async () => {
    const token = await mintInviteToken();

    testApp.setUser(null);
    const bad = await request(testApp.app)
      .post(`/wingman/invite/${token}/answer`)
      .send({ ...VALID, humor: 2.5 });
    expect(bad.status).toBe(400);

    // The invite must still be answerable after a rejected fractional payload.
    const good = await request(testApp.app)
      .post(`/wingman/invite/${token}/answer`)
      .send(VALID);
    expect(good.status).toBe(200);
    expect(good.body.ok).toBe(true);
  });

  it("records exactly one perspective and blocks a second answer (single-use)", async () => {
    const token = await mintInviteToken();

    testApp.setUser(null);
    const first = await request(testApp.app)
      .post(`/wingman/invite/${token}/answer`)
      .send(VALID);
    expect(first.status).toBe(200);

    const second = await request(testApp.app)
      .post(`/wingman/invite/${token}/answer`)
      .send({ ...VALID, warmth: 1 });
    expect(second.status).toBe(409);

    // The owner sees one perspective and the friend average reflects the single
    // recorded answer, never the rejected second submission.
    testApp.setUser({ id: OWNER });
    const state = await request(testApp.app).get("/me/wingman");
    expect(state.status).toBe(200);
    expect(state.body.perspectives).toBe(1);
    expect(state.body.friendAverages.warmth).toBe(4);
  });

  it("marks the public invite as answered once consumed", async () => {
    const token = await mintInviteToken();

    testApp.setUser(null);
    const before = await request(testApp.app).get(`/wingman/invite/${token}`);
    expect(before.status).toBe(200);
    expect(before.body.answered).toBe(false);

    await request(testApp.app).post(`/wingman/invite/${token}/answer`).send(VALID);

    const after = await request(testApp.app).get(`/wingman/invite/${token}`);
    expect(after.status).toBe(200);
    expect(after.body.answered).toBe(true);
  });
});
