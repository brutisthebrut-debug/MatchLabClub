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

const stripeMock = vi.hoisted(() => ({
  connected: true,
  createResult: {
    id: "vs_test_123",
    client_secret: "vs_secret_abc",
    url: "https://verify.stripe.test/vs_test_123",
  } as { id: string; client_secret: string | null; url: string | null },
  retrieveResult: null as unknown,
  webhookEvent: null as unknown,
}));

vi.mock("../lib/stripeClient", () => ({
  isStripeConnected: vi.fn(async () => stripeMock.connected),
  getUncachableStripeClient: vi.fn(async () => ({
    identity: {
      verificationSessions: {
        create: vi.fn(async () => stripeMock.createResult),
        retrieve: vi.fn(async () => stripeMock.retrieveResult),
      },
    },
  })),
  constructStripeEvent: vi.fn(async () => stripeMock.webhookEvent),
}));

const selfieMock = vi.hoisted(() => ({
  result: null as unknown,
}));

vi.mock("../lib/aiService", () => ({
  compareSelfieVision: vi.fn(async () => selfieMock.result),
}));

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

describe("ID verification (Stripe Identity, mocked)", () => {
  beforeEach(() => {
    stripeMock.connected = true;
    stripeMock.retrieveResult = null;
    stripeMock.webhookEvent = null;
  });

  it("id/start returns configured:false when Stripe is not connected", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: idUser });
    stripeMock.connected = false;
    const res = await request(testApp.app).post(
      "/api/me/verification/id/start",
    );
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.clientSecret).toBeNull();
    expect(res.body.url).toBeNull();
  });

  it("id/start creates a session and returns the client secret and url", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: idUser });
    const res = await request(testApp.app).post(
      "/api/me/verification/id/start",
    );
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.clientSecret).toBe(stripeMock.createResult.client_secret);
    expect(res.body.url).toBe(stripeMock.createResult.url);
  });

  it("id/refresh captures a verified result, deriving over-18 and bumping tiers", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: idUser });

    // Start to persist our provider reference (the session id).
    const start = await request(testApp.app).post(
      "/api/me/verification/id/start",
    );
    expect(start.status).toBe(200);

    // Stripe now reports the session as verified, with a DOB that is over 18.
    stripeMock.retrieveResult = {
      id: stripeMock.createResult.id,
      status: "verified",
      metadata: { userId: idUser },
      verified_outputs: { dob: { day: 1, month: 1, year: 1990 } },
    };

    const refresh = await request(testApp.app).post(
      "/api/me/verification/id/refresh",
    );
    expect(refresh.status).toBe(200);
    expect(refresh.body.configured).toBe(true);
    expect(refresh.body.verification.idVerified).toBe(true);
    expect(refresh.body.verification.ageOver18).toBe(true);
    expect(refresh.body.verification.isVerified).toBe(true);
    expect(refresh.body.verification.verifiedTiers).toBe(1);
    expect(typeof refresh.body.verification.idVerifiedAt).toBe("string");
  });

  it("id/refresh does not flag over-18 for a date of birth under 18", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: idUser });
    await request(testApp.app).post("/api/me/verification/id/start");

    const recentYear = new Date().getFullYear() - 5;
    stripeMock.retrieveResult = {
      id: stripeMock.createResult.id,
      status: "verified",
      metadata: { userId: idUser },
      verified_outputs: { dob: { day: 1, month: 1, year: recentYear } },
    };

    const refresh = await request(testApp.app).post(
      "/api/me/verification/id/refresh",
    );
    expect(refresh.status).toBe(200);
    expect(refresh.body.verification.idVerified).toBe(true);
    expect(refresh.body.verification.ageOver18).toBe(false);
  });

  it("id/refresh returns configured:false and unchanged state when Stripe is off", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: idUser });
    stripeMock.connected = false;
    const res = await request(testApp.app).post(
      "/api/me/verification/id/refresh",
    );
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.verification.idVerified).toBe(false);
  });

  it("webhook re-retrieves the session to read DOB and stores the result", async () => {
    const idUser = `id-${crypto.randomBytes(6).toString("hex")}`;

    // The webhook payload itself never carries verified_outputs, so the handler
    // must re-retrieve the session (mocked here with an over-18 DOB).
    stripeMock.webhookEvent = {
      type: "identity.verification_session.verified",
      data: { object: { id: stripeMock.createResult.id } },
    };
    stripeMock.retrieveResult = {
      id: stripeMock.createResult.id,
      status: "verified",
      metadata: { userId: idUser },
      verified_outputs: { dob: { day: 1, month: 1, year: 1990 } },
    };

    const { handleIdentityWebhook } = await import(
      "../lib/identityVerification"
    );
    const handled = await handleIdentityWebhook(
      Buffer.from("{}"),
      "test-signature",
    );
    expect(handled).toBe(true);

    testApp.setUser({ id: idUser });
    const state = await request(testApp.app).get("/api/me/verification");
    expect(state.status).toBe(200);
    expect(state.body.idVerified).toBe(true);
    expect(state.body.ageOver18).toBe(true);
  });

  it("ignores non-identity webhook events so they fall through", async () => {
    stripeMock.webhookEvent = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1" } },
    };
    const { handleIdentityWebhook } = await import(
      "../lib/identityVerification"
    );
    const handled = await handleIdentityWebhook(
      Buffer.from("{}"),
      "test-signature",
    );
    expect(handled).toBe(false);
  });

  it("rejects unauthenticated id/start and id/refresh with 401", async () => {
    testApp.setUser(null);
    const start = await request(testApp.app).post(
      "/api/me/verification/id/start",
    );
    expect(start.status).toBe(401);
    const refresh = await request(testApp.app).post(
      "/api/me/verification/id/refresh",
    );
    expect(refresh.status).toBe(401);
  });
});

describe("selfie verification (Claude vision, mocked)", () => {
  const SELFIE_BODY = {
    selfie: { imageBase64: "selfie-bytes" },
    profilePhotos: [{ imageBase64: "photo-bytes" }],
  };

  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send(SELFIE_BODY);
    expect(res.status).toBe(401);
  });

  it("rejects a payload with no profile photos with 400", async () => {
    const user = `selfie-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: user });
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send({ selfie: { imageBase64: "x" }, profilePhotos: [] });
    expect(res.status).toBe(400);
  });

  it("awards the selfie tier on a live consistent verdict", async () => {
    const user = `selfie-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: user });
    selfieMock.result = {
      analysis: { verdict: "consistent", reason: "Looks like the same person." },
      mode: "anthropic",
      isFallback: false,
      durationMs: 5,
    };
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send(SELFIE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("consistent");
    expect(res.body.mode).toBe("live");
    expect(res.body.verification.selfieVerified).toBe(true);
    expect(res.body.verification.isVerified).toBe(true);
    expect(res.body.verification.verifiedTiers).toBe(1);
    expect(typeof res.body.verification.selfieVerifiedAt).toBe("string");

    // The state endpoint now reflects the cleared selfie tier.
    const state = await request(testApp.app).get("/api/me/verification");
    expect(state.body.selfieVerified).toBe(true);
  });

  it("does not award the tier on a live inconsistent verdict", async () => {
    const user = `selfie-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: user });
    selfieMock.result = {
      analysis: {
        verdict: "inconsistent",
        reason: "These look like different people.",
      },
      mode: "anthropic",
      isFallback: false,
      durationMs: 5,
    };
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send(SELFIE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("inconsistent");
    expect(res.body.mode).toBe("live");
    expect(res.body.verification.selfieVerified).toBe(false);
    expect(res.body.verification.verifiedTiers).toBe(0);
  });

  it("falls back honestly with no tier when consent is off", async () => {
    const user = `selfie-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: user });
    selfieMock.result = {
      analysis: null,
      mode: "fallback",
      isFallback: true,
      durationMs: 1,
      fallbackReason: "consent_required",
    };
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send(SELFIE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("unclear");
    expect(res.body.mode).toBe("fallback");
    expect(res.body.fallbackReason).toBe("consent_required");
    expect(res.body.verification.selfieVerified).toBe(false);
    expect(res.body.verification.verifiedTiers).toBe(0);
  });

  it("falls back honestly with no tier when the daily cap is hit", async () => {
    const user = `selfie-${crypto.randomBytes(6).toString("hex")}`;
    testApp.setUser({ id: user });
    selfieMock.result = {
      analysis: null,
      mode: "fallback",
      isFallback: true,
      durationMs: 1,
      fallbackReason: "daily_cap_exceeded",
    };
    const res = await request(testApp.app)
      .post("/api/me/verification/selfie/check")
      .send(SELFIE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("unclear");
    expect(res.body.mode).toBe("fallback");
    expect(res.body.verification.selfieVerified).toBe(false);
  });
});
