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

vi.mock("../lib/aiService", () => ({
  generate: vi.fn(),
}));

import { CoachMessageResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";
import { generate } from "../lib/aiService";

const generateMock = vi.mocked(generate);

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const messagesRouter = (await import("./messages")).default;
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

  app.use("/api", messagesRouter);

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
  generateMock.mockReset();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const USER_ID = `coach-safety-${crypto.randomBytes(6).toString("hex")}`;

// A conversation laced with classic romance-scam financial cues so the
// deterministic scam detector lands on an elevated risk regardless of the lane.
const SCAM_BODY = {
  matchName: "Riley",
  conversationContext:
    "We matched a week ago and have not video called. Riley says they are stuck overseas on an oil rig and the company will not release their pay. They asked me to send gift cards and wire money through bitcoin to cover an emergency customs fee.",
  yourLastMessage: "That sounds really stressful, are you sure about this?",
  goal: "figure out if this is real",
  sourceApp: "Hinge",
};

async function createScamSession(userId: string): Promise<number> {
  testApp.setUser({ id: userId });
  const res = await request(testApp.app).post("/api/messages").send(SCAM_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/messages/:id/coach safety check", () => {
  it("attaches a deterministic elevated safety read when the deep lane falls back", async () => {
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createScamSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post(`/api/messages/${id}/coach`)
      .send({});

    expect(res.status).toBe(200);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
    expect(res.body.safety).toBeDefined();
    expect(res.body.safety.risk).toBe("elevated");
    expect(Array.isArray(res.body.safety.signals)).toBe(true);
    expect(res.body.safety.signals.length).toBeGreaterThan(0);
    expect(typeof res.body.safety.advice).toBe("string");
  });

  it("keeps the deterministic safety read when the AI safety lane throws", async () => {
    generateMock.mockRejectedValue(new Error("provider exploded"));

    const id = await createScamSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post(`/api/messages/${id}/coach`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.safety).toBeDefined();
    expect(res.body.safety.risk).toBe("elevated");
  });
});
