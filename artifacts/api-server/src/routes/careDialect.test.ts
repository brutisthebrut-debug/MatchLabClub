import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
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

// POST layers an optional Claude narrative via generate(). Force the
// deterministic fallback so the test never touches a provider and narrative
// stays null (the always-on baseline path the deterministic comparison covers).
vi.mock("../lib/aiService", () => ({
  generate: vi.fn(async () => ({
    mode: "fallback",
    isFallback: true,
    output: "",
    fallbackReason: "consent_required",
  })),
}));

import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const careDialectRouter = (await import("./careDialect")).default;
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

  app.use("/api", careDialectRouter);

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

describe("GET /api/me/care-dialect", () => {
  it("serves a clearly flagged demo profile to signed-out visitors", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/care-dialect");
    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(true);
    expect(res.body.hasProfile).toBe(true);
    expect(res.body.testedReceiveTop).toBe("undividedTime");
  });

  it("returns an empty, non-demo profile for a signed-in user with no row", async () => {
    testApp.setUser({ id: `test-care-empty-${crypto.randomBytes(6).toString("hex")}` });
    const res = await request(testApp.app).get("/api/me/care-dialect");
    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(false);
    expect(res.body.hasProfile).toBe(false);
    expect(res.body.testedGiveTop).toBeNull();
    expect(res.body.comparison.alignment).toBe("unknown");
  });
});

describe("POST /api/me/care-dialect", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/care-dialect")
      .send({ giveAnswers: ["spokenWarmth"], receiveAnswers: ["undividedTime"] });
    expect(res.status).toBe(401);
  });

  it("rejects a submission with no answers on an axis", async () => {
    testApp.setUser({ id: `test-care-bad-${crypto.randomBytes(6).toString("hex")}` });
    const res = await request(testApp.app)
      .post("/api/me/care-dialect")
      .send({ giveAnswers: [], receiveAnswers: ["undividedTime"] });
    expect(res.status).toBe(400);
  });

  it("scores answers server-side, persists only derived data, and reads back", async () => {
    const uid = `test-care-save-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: uid });
    const res = await request(testApp.app)
      .post("/api/me/care-dialect")
      .send({
        selfGive: "spokenWarmth",
        selfReceive: "spokenWarmth",
        giveAnswers: ["helpingHands", "helpingHands", "spokenWarmth"],
        receiveAnswers: ["undividedTime", "undividedTime", "closeContact"],
      });
    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(false);
    expect(res.body.hasProfile).toBe(true);
    expect(res.body.testedGiveTop).toBe("helpingHands");
    expect(res.body.testedReceiveTop).toBe("undividedTime");
    // Provider is mocked to fall back, so the deterministic comparison stands
    // alone and no narrative is attached.
    expect(res.body.narrative).toBeNull();
    // Guessed giving spokenWarmth but tested helpingHands, so give does not align.
    expect(res.body.comparison.giveMatch).toBe(false);

    const get = await request(testApp.app).get("/api/me/care-dialect");
    expect(get.body.hasProfile).toBe(true);
    expect(get.body.isDemo).toBe(false);
    expect(get.body.testedGiveTop).toBe("helpingHands");
    expect(get.body.selfGive).toBe("spokenWarmth");

    // Only derived data is persisted: the stored row never carries raw answers.
    const { db, careDialectProfilesTable, eq } = await import("../lib/testDb");
    const rows = await db
      .select()
      .from(careDialectProfilesTable)
      .where(eq(careDialectProfilesTable.userId, uid));
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("giveAnswers");
    expect(rows[0]).not.toHaveProperty("receiveAnswers");
    expect(rows[0].testedGiveTop).toBe("helpingHands");
  });

  it("upserts on retake instead of creating a second row", async () => {
    const uid = `test-care-retake-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: uid });
    await request(testApp.app)
      .post("/api/me/care-dialect")
      .send({ giveAnswers: ["spokenWarmth"], receiveAnswers: ["spokenWarmth"] });
    const second = await request(testApp.app)
      .post("/api/me/care-dialect")
      .send({ giveAnswers: ["closeContact"], receiveAnswers: ["closeContact"] });
    expect(second.status).toBe(200);
    expect(second.body.testedGiveTop).toBe("closeContact");

    const { db, careDialectProfilesTable, eq } = await import("../lib/testDb");
    const rows = await db
      .select()
      .from(careDialectProfilesTable)
      .where(eq(careDialectProfilesTable.userId, uid));
    expect(rows).toHaveLength(1);
    expect(rows[0].testedGiveTop).toBe("closeContact");
  });
});
