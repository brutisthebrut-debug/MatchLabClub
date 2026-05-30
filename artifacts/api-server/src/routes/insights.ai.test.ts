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

import { AnalyzeInsightResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";
import { generate } from "../lib/aiService";

const generateMock = vi.mocked(generate);

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const insightsRouter = (await import("./insights")).default;
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
  app.use("/api", insightsRouter);
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

const USER_ID = `test-insight-ai-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  sourceLabel: "Gmail export — past 6 months",
  pastedContent:
    "Sample exchange: I usually wait two days to reply because I overthink the right tone. She said it made her feel like a backup plan. I tried to explain, but it came out defensive.",
  consentGiven: true,
};

const AI_INSIGHT = {
  communicationPatterns: [
    {
      pattern: "Delayed, over-considered replies",
      frequency: "Most threads",
      impact: "Reads as low interest even when the opposite is true.",
    },
  ],
  attachmentStyle: "Anxious-leaning, with a fear of saying the wrong thing",
  strengths: ["Self-aware about your own tendencies", "Willing to repair after a misstep"],
  growthAreas: ["Reply on your real timeline, not a defensive one"],
  datingProfileTips: ["Name one thing you are genuinely curious about up top"],
  summary:
    "You think hard about tone and it slows you down. The two-day gap costs you more than a quick, honest reply ever would.",
};

async function createInsight(userId: string | null): Promise<number> {
  testApp.setUser(userId ? { id: userId } : null);
  const res = await request(testApp.app).post("/api/insights").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/insights/:id/analyze deep-AI lane", () => {
  it("overlays the Claude analysis for a signed-in user", async () => {
    // Deterministic baseline (AI lane reports fallback).
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);
    const baselineId = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const baseline = await request(testApp.app)
      .post(`/api/insights/${baselineId}/analyze`)
      .send({});
    expect(baseline.status).toBe(200);
    const deterministicSummary = baseline.body.summary as string;
    const deterministicSourceApp = baseline.body.sourceApp ?? null;

    // Clean validated Claude result.
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: true,
      output: JSON.stringify(AI_INSIGHT),
    } as Awaited<ReturnType<typeof generate>>);
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});

    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(res.body.summary).toBe(AI_INSIGHT.summary);
    expect(res.body.attachmentStyle).toBe(AI_INSIGHT.attachmentStyle);
    expect(res.body.strengths).toEqual(AI_INSIGHT.strengths);
    expect(res.body.summary).not.toBe(deterministicSummary);
    // sourceApp is deliberately NOT overlaid: it is persisted and drives the
    // rollup grouping, so it must stay the deterministic value.
    expect(res.body.sourceApp ?? null).toBe(deterministicSourceApp);

    const opts = generateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(opts.provider).toBe("anthropic");
    expect(opts.requireContentConsent).toBe(true);
    expect((opts.context as Record<string, unknown>).toolName).toBe("Email Insights");
  });

  it("falls back to deterministic analysis when the AI lane reports fallback", async () => {
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "daily_cap_exceeded",
    } as Awaited<ReturnType<typeof generate>>);
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});

    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(res.body.summary).not.toBe(AI_INSIGHT.summary);
  });

  it("falls back when the AI output is unvalidated", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: false,
      output: JSON.stringify(AI_INSIGHT),
    } as Awaited<ReturnType<typeof generate>>);
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});

    expect(res.status).toBe(200);
    expect(res.body.summary).not.toBe(AI_INSIGHT.summary);
  });

  it("still returns a deterministic 200 when the AI lane throws", async () => {
    generateMock.mockRejectedValue(new Error("boom"));
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});

    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(res.body.summary).not.toBe(AI_INSIGHT.summary);
  });

  it("never invokes the AI lane for an anonymous insight", async () => {
    // Create + analyze as an anonymous caller, forwarding the anon cookie.
    testApp.setUser(null);
    const created = await request(testApp.app).post("/api/insights").send(VALID_BODY);
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    const setCookie = created.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie : [String(setCookie)];

    testApp.setUser(null);
    const res = await request(testApp.app)
      .post(`/api/insights/${id}/analyze`)
      .set("Cookie", cookieHeader)
      .send({});

    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(generateMock).not.toHaveBeenCalled();
  });
});
