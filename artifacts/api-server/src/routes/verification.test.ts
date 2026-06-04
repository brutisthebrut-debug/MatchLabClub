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

import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const verificationRouter = (await import("./verification")).default;
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

  app.use("/api", verificationRouter);

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

const USER = `test-verify-user-${crypto.randomBytes(6).toString("hex")}`;
const PHONE = "+14155550123";

describe("GET /api/me/verification", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/verification");
    expect(res.status).toBe(401);
  });

  it("reports an unverified default for a fresh user", async () => {
    testApp.setUser({ id: USER });
    const res = await request(testApp.app).get("/api/me/verification");
    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(false);
    expect(res.body.isVerified).toBe(false);
    expect(res.body.verifiedTiers).toBe(0);
    expect(res.body.tierTotal).toBe(3);
  });
});

describe("phone verification flow (log transport fallback)", () => {
  it("rejects an invalid phone on start with 400", async () => {
    testApp.setUser({ id: USER });
    const res = await request(testApp.app)
      .post("/api/me/verification/phone/start")
      .send({ phone: "" });
    expect(res.status).toBe(400);
  });

  it("starts, checks, and persists only the passed result", async () => {
    testApp.setUser({ id: USER });

    const start = await request(testApp.app)
      .post("/api/me/verification/phone/start")
      .send({ phone: PHONE });
    expect(start.status).toBe(200);
    expect(start.body.sent).toBe(true);
    // With no Twilio creds in test, the lib falls back to the log transport.
    expect(start.body.transport).toBe("log");

    // A wrong code never flips the badge.
    const wrong = await request(testApp.app)
      .post("/api/me/verification/phone/check")
      .send({ phone: PHONE, code: "000000" });
    expect(wrong.status).toBe(200);
    expect(wrong.body.verified).toBe(false);
    expect(wrong.body.verification.phoneVerified).toBe(false);

    // Read the logged dev code from the in-memory challenge to finish the flow.
    const { peekLocalChallengeCodeForTest } = await import(
      "../lib/phoneVerification"
    );
    const code = peekLocalChallengeCodeForTest(USER);
    expect(code).toBeTruthy();
    const right = await request(testApp.app)
      .post("/api/me/verification/phone/check")
      .send({ phone: PHONE, code });
    expect(right.status).toBe(200);
    expect(right.body.verified).toBe(true);
    expect(right.body.verification.phoneVerified).toBe(true);
    expect(right.body.verification.isVerified).toBe(true);
    expect(right.body.verification.verifiedTiers).toBe(1);

    // The state endpoint now reflects the verified standing.
    const state = await request(testApp.app).get("/api/me/verification");
    expect(state.body.phoneVerified).toBe(true);
    expect(typeof state.body.phoneVerifiedAt).toBe("string");
  });

  it("rejects unauthenticated start and check with 401", async () => {
    testApp.setUser(null);
    const start = await request(testApp.app)
      .post("/api/me/verification/phone/start")
      .send({ phone: PHONE });
    expect(start.status).toBe(401);
    const check = await request(testApp.app)
      .post("/api/me/verification/phone/check")
      .send({ phone: PHONE, code: "123456" });
    expect(check.status).toBe(401);
  });
});
