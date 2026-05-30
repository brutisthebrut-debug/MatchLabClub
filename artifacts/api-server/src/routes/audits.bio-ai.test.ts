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

// Mock OCR so the from-screenshot path decodes the base64 payload as text and
// runs it through the real deterministic parser (no tesseract.js in tests).
vi.mock("../lib/ocr", async () => {
  const profileParser = await import("../lib/profileParser");
  return {
    parseProfileText: profileParser.parseProfileText,
    detectLowConfidenceFields: () => [],
    extractProfileFromScreenshot: async (imageBase64: string) => {
      const cleaned = imageBase64.trim();
      if (!cleaned) throw new Error("Empty image payload");
      const rawText = Buffer.from(cleaned, "base64").toString("utf8").trim();
      const parsed = profileParser.parseProfileText(rawText);
      return { ...parsed, rawText };
    },
  };
});

import { GenerateAuditReportResponse, AuditFromScreenshotResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";
import { generate } from "../lib/aiService";
import { HINGE_OCR } from "./__fixtures__/screenshotOcr";

const generateMock = vi.mocked(generate);

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const auditsRouter = (await import("./audits")).default;
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

  app.use("/api", auditsRouter);

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

const USER_ID = `test-bio-ai-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  firstName: "Riley",
  age: 31,
  gender: "f",
  orientation: "straight",
  datingGoal: "find a relationship",
  currentApps: ["Hinge", "Bumble"],
  bio: "Yoga teacher who loves long hikes and slow Sundays. Looking for someone who values curiosity over cleverness.",
  prompts: "Best travel story: getting lost in Lisbon and stumbling into the best meal of my life.",
  recentMessageSample: null,
  photoCount: 5,
  relationshipHistory: null,
  biggestChallenge: "matching but no replies",
};

const AI_BIO = {
  rewrittenBio:
    "I teach 6am vinyasa, then chase the sunrise up Eaton Canyon before the trail gets crowded. Ask me about the worst meal I have ever loved in Lisbon.",
  bioAudit:
    "The original tells me your hobbies but not a single specific moment. The Lisbon prompt is the strongest thread, so I pulled it forward into a concrete hook someone can react to.",
};

async function createAudit(user: { id: string } | null = { id: USER_ID }): Promise<number> {
  testApp.setUser(user);
  const res = await request(testApp.app).post("/api/audits").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/audits/:id/generate deep-AI bio lane", () => {
  it("overlays the Claude bio and audit while keeping the deterministic score", async () => {
    // Baseline run with the AI lane reporting fallback gives us the
    // deterministic score and bio to compare against.
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);
    const baselineId = await createAudit();
    testApp.setUser({ id: USER_ID });
    const baseline = await request(testApp.app)
      .post(`/api/audits/${baselineId}/generate`)
      .send({});
    expect(baseline.status).toBe(200);
    const deterministicScore = baseline.body.readinessScore as number;
    const deterministicBio = baseline.body.rewrittenBio as string;

    // Now a run where Claude returns a clean, validated result.
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: true,
      output: JSON.stringify(AI_BIO),
    } as Awaited<ReturnType<typeof generate>>);
    const id = await createAudit();
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/generate`).send({});

    expect(res.status).toBe(200);
    expect(() => GenerateAuditReportResponse.parse(res.body)).not.toThrow();
    // Textual fields are the Claude output.
    expect(res.body.rewrittenBio).toBe(AI_BIO.rewrittenBio);
    expect(res.body.bioAudit).toBe(AI_BIO.bioAudit);
    expect(res.body.rewrittenBio).not.toBe(deterministicBio);
    // Score and structured fields stay 100% deterministic.
    expect(res.body.readinessScore).toBe(deterministicScore);

    // The stored row score matches the response (drives history/filters).
    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits").find((r) => r.id === id);
    expect(row?.readinessScore).toBe(deterministicScore);

    const opts = generateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(opts.provider).toBe("anthropic");
    expect(opts.requireContentConsent).toBe(true);
    expect((opts.context as { toolName?: string }).toolName).toBe("Bio Rewrite");
  });

  it("keeps the deterministic bio when the AI lane reports fallback", async () => {
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "daily_cap_reached",
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createAudit();
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/generate`).send({});

    expect(res.status).toBe(200);
    expect(res.body.rewrittenBio).not.toBe(AI_BIO.rewrittenBio);
    expect(res.body.readinessScore).toBeGreaterThan(0);
  });

  it("keeps the deterministic bio when the AI result is unvalidated", async () => {
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: false,
      output: JSON.stringify({ bogus: "shape" }),
    } as Awaited<ReturnType<typeof generate>>);

    const id = await createAudit();
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/generate`).send({});

    expect(res.status).toBe(200);
    expect(res.body.rewrittenBio).not.toBe(AI_BIO.rewrittenBio);
    expect(() => GenerateAuditReportResponse.parse(res.body)).not.toThrow();
  });

  it("returns 200 deterministic report when the AI lane throws", async () => {
    generateMock.mockRejectedValue(new Error("provider exploded"));

    const id = await createAudit();
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/audits/${id}/generate`).send({});

    expect(res.status).toBe(200);
    expect(() => GenerateAuditReportResponse.parse(res.body)).not.toThrow();
    expect(res.body.rewrittenBio).not.toBe(AI_BIO.rewrittenBio);
    expect(res.body.readinessScore).toBeGreaterThan(0);
  });

  it("never invokes the AI lane for an anonymous audit", async () => {
    // Forward the anon_claim cookie explicitly so the anonymous owner is
    // recognised on the generate call (more deterministic than agent state).
    testApp.setUser(null);
    const created = await request(testApp.app).post("/api/audits").send(VALID_BODY);
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    const setCookie = created.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie : [String(setCookie)];

    testApp.setUser(null);
    const res = await request(testApp.app)
      .post(`/api/audits/${id}/generate`)
      .set("Cookie", cookieHeader)
      .send({});

    expect(res.status).toBe(200);
    expect(() => GenerateAuditReportResponse.parse(res.body)).not.toThrow();
    expect(generateMock).not.toHaveBeenCalled();
  });
});

function toBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("POST /api/audits/from-screenshot deep-AI bio lane", () => {
  it("overlays the Claude bio for a signed-in user while keeping the deterministic score", async () => {
    // Deterministic baseline (AI lane reports fallback).
    generateMock.mockResolvedValue({
      isFallback: true,
      output: "",
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);
    testApp.setUser({ id: USER_ID });
    const baseline = await request(testApp.app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(HINGE_OCR) });
    expect(baseline.status).toBe(200);
    const deterministicScore = baseline.body.report.readinessScore as number;
    const deterministicBio = baseline.body.report.rewrittenBio as string;

    // Clean validated Claude result.
    generateMock.mockResolvedValue({
      isFallback: false,
      validated: true,
      output: JSON.stringify(AI_BIO),
    } as Awaited<ReturnType<typeof generate>>);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(HINGE_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.report.rewrittenBio).toBe(AI_BIO.rewrittenBio);
    expect(res.body.report.bioAudit).toBe(AI_BIO.bioAudit);
    expect(res.body.report.rewrittenBio).not.toBe(deterministicBio);
    // Score is untouched by the AI lane.
    expect(res.body.report.readinessScore).toBe(deterministicScore);
    expect((generateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>).provider).toBe(
      "anthropic",
    );
  });

  it("never invokes the AI lane for an anonymous screenshot audit", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(HINGE_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.report.rewrittenBio).not.toBe(AI_BIO.rewrittenBio);
    expect(generateMock).not.toHaveBeenCalled();
  });
});
