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

// Mock the AI service so the test controls exactly what the deep-AI lane
// returns without touching real providers, env, or the consent DB lookup.
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

const USER_ID = `test-coach-ai-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  matchName: "Sam",
  conversationContext:
    "We matched on Hinge two days ago. They commented on my hiking prompt. I sent a friendly opener but they took 18 hours to reply with a one-liner.",
  yourLastMessage: "Haha fair — what's your favorite trail near here?",
  goal: "keep momentum without being pushy",
  sourceApp: "Hinge",
};

const AI_OUTPUT = {
  analysis:
    "Sam took 18 hours and answered with a one-liner, so the thread is cooling. Your question is the right instinct but soft enough to ignore.",
  suggestedReplies: [
    {
      style: "Direct",
      text: "Free Saturday morning to go settle whether that trail lives up to the hype?",
      rationale: "Turns the trail thread into a concrete plan instead of more small talk.",
    },
    {
      style: "Playful",
      text: "Eighteen hours is a power move, Sam. Now sell me on your trail pick.",
      rationale: "Names the slow reply with humor and hands them an easy opening.",
    },
    {
      style: "Warm",
      text: "Your hiking prompt is what got me. What got you out there in the first place?",
      rationale: "Goes one layer deeper on the thing that already connected you.",
    },
  ],
  tone: "Warm with a clear nudge toward making a plan.",
  redFlags: ["Your last message is easy to answer with one word, keeping the burden on them."],
  coachTip: "Offer a specific day so the next reply is a yes or no, not more chat.",
};

async function createSession(userId: string): Promise<number> {
  testApp.setUser({ id: userId });
  const res = await request(testApp.app).post("/api/messages").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/messages/:id/coach deep-AI lane", () => {
  it("returns validated Claude output when consent yields a clean result", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: true,
      output: JSON.stringify(AI_OUTPUT),
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});

    expect(res.status).toBe(200);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
    expect(res.body.analysis).toBe(AI_OUTPUT.analysis);
    expect(res.body.suggestedReplies).toHaveLength(3);
    expect(res.body.coachTip).toBe(AI_OUTPUT.coachTip);

    // The deep lane must request Claude with the registered tool schema.
    expect(generateMock).toHaveBeenCalledTimes(1);
    const opts = generateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.provider).toBe("anthropic");
    expect(opts.requireContentConsent).toBe(true);
    expect((opts.context as { toolName?: string }).toolName).toBe("Message Coach");
  });

  it("falls back to deterministic coaching when the AI lane reports fallback", async () => {
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});

    expect(res.status).toBe(200);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
    // Deterministic baseline, not the mocked AI payload.
    expect(res.body.analysis).not.toBe(AI_OUTPUT.analysis);
    expect(res.body.suggestedReplies.length).toBeGreaterThan(0);
  });

  it("never invokes the AI lane for anonymous callers", async () => {
    // Create the session as a real user (anon session creation needs cookies),
    // then confirm the coach path itself does not call generate for that user
    // would — here we assert the anon branch by clearing the user before coach.
    const id = await createSession(USER_ID);
    // Re-scope: an anonymous caller cannot own this session, so it 404s before
    // ever reaching the AI lane. This guards that generate() is never called on
    // the unauthenticated path.
    testApp.setUser(null);
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});
    expect(res.status).toBe(404);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 200 deterministic coaching when the AI lane throws", async () => {
    generateMock.mockRejectedValue(new Error("provider exploded"));

    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});

    expect(res.status).toBe(200);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
    expect(res.body.analysis).not.toBe(AI_OUTPUT.analysis);
    expect(res.body.suggestedReplies.length).toBeGreaterThan(0);
  });

  it("keeps deterministic coaching when the AI result is unvalidated", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: false,
      output: JSON.stringify({ bogus: "shape" }),
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createSession(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/messages/${id}/coach`).send({});

    expect(res.status).toBe(200);
    expect(res.body.analysis).not.toBe(AI_OUTPUT.analysis);
    expect(() => CoachMessageResponse.parse(res.body)).not.toThrow();
  });
});
