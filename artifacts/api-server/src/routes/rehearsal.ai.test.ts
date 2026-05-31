import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import crypto from "crypto";

// Mock the AI service so the test controls exactly what the deep-AI lane
// returns without touching real providers, env, or the consent DB lookup.
vi.mock("../lib/aiService", () => ({
  generate: vi.fn(),
}));

import { RehearsalTurnResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";
import { generate } from "../lib/aiService";

const generateMock = vi.mocked(generate);

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const rehearsalRouter = (await import("./rehearsal")).default;
  const app = express();
  app.use(express.json());

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

  app.use("/api", rehearsalRouter);

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

beforeEach(() => {
  generateMock.mockReset();
});

const USER_ID = `test-rehearsal-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  scenario: "define_the_relationship",
  theirStyle: "Warm but avoids conflict, goes quiet when things get serious.",
  transcript: [
    { role: "them", text: "Can I ask where your head is at with us?" },
    { role: "you", text: "I want something real, and I get scared saying it out loud." },
  ],
};

const AI_OUTPUT = {
  reply: "That actually makes me feel safer, not more scared. Thank you for saying it first.",
  note: "You named the fear and the want in one breath. That is exactly the move. Now let them respond.",
  tone: "warm and relieved",
};

describe("POST /api/rehearsal/turn deep-AI lane", () => {
  it("returns validated Claude output when consent yields a clean result", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: true,
      output: JSON.stringify(AI_OUTPUT),
    } as Awaited<ReturnType<typeof generate>>);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/rehearsal/turn").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(() => RehearsalTurnResponse.parse(res.body)).not.toThrow();
    expect(res.body.reply).toBe(AI_OUTPUT.reply);
    expect(res.body.note).toBe(AI_OUTPUT.note);
    expect(res.body.isFallback).toBe(false);

    expect(generateMock).toHaveBeenCalledTimes(1);
    const opts = generateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.provider).toBe("anthropic");
    expect(opts.requireContentConsent).toBe(true);
    expect((opts.context as { toolName?: string }).toolName).toBe("Rehearsal Room");
  });

  it("falls back to the deterministic baseline when the AI lane reports fallback", async () => {
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/rehearsal/turn").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(() => RehearsalTurnResponse.parse(res.body)).not.toThrow();
    expect(res.body.isFallback).toBe(true);
    expect(res.body.reply).not.toBe(AI_OUTPUT.reply);
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  it("never invokes the AI lane for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/rehearsal/turn").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.reply.length).toBeGreaterThan(0);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 200 deterministic output when the AI lane throws", async () => {
    generateMock.mockRejectedValue(new Error("provider exploded"));

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/rehearsal/turn").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(() => RehearsalTurnResponse.parse(res.body)).not.toThrow();
    expect(res.body.isFallback).toBe(true);
    expect(res.body.reply).not.toBe(AI_OUTPUT.reply);
  });

  it("keeps the deterministic baseline when the AI result is unvalidated", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: false,
      output: JSON.stringify({ bogus: "shape" }),
    } as Awaited<ReturnType<typeof generate>>);

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/rehearsal/turn").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.reply).not.toBe(AI_OUTPUT.reply);
    expect(() => RehearsalTurnResponse.parse(res.body)).not.toThrow();
  });

  it("rejects invalid input with 400", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/rehearsal/turn")
      .send({ scenario: "x" });
    expect(res.status).toBe(400);
  });
});
