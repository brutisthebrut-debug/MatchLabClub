import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// Hard-mock OpenAI so importing aiService never reaches the network.
const createMock = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
    constructor(_opts: unknown) {}
  },
}));

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

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

async function makeApp(): Promise<Express> {
  const aiRouter = (await import("./ai")).default;
  const app = express();
  app.use(express.json());
  // minimal req.log stub
  app.use((req, _res, next) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", aiRouter);
  return app;
}

function clearAiKeys() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}

describe("GET /api/ai/status", () => {
  beforeEach(() => {
    createMock.mockReset();
    clearAiKeys();
    vi.resetModules();
  });

  afterEach(() => {
    clearAiKeys();
  });

  it("requires founder authorization", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/ai/status");
    expect(res.status).toBe(401);
  });

  it("reports fallback mode when no API key is configured", async () => {
    const app = await makeApp();
    const res = await request(app)
      .get("/api/ai/status")
      .set("x-test-founder-role", "founder");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("fallback");
    expect(res.body.keyDetected).toBe(false);
    expect(res.body.provider).toBeNull();
    expect(res.body.source).toBe("none");
    expect(typeof res.body.message).toBe("string");
  });

  it("reports live mode when an API key is present", async () => {
    process.env.OPENAI_API_KEY = "test-key-abc";
    const app = await makeApp();
    const res = await request(app)
      .get("/api/ai/status")
      .set("x-test-founder-role", "founder");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("live");
    expect(res.body.keyDetected).toBe(true);
    expect(res.body.provider).toBe("openai");
  });
});

describe("POST /api/ai/enhance", () => {
  beforeEach(() => {
    createMock.mockReset();
    clearAiKeys();
    vi.resetModules();
  });

  afterEach(() => {
    clearAiKeys();
  });

  it("returns a fallback response cleanly when no API key is configured", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/ai/enhance")
      .send({
        toolName: "Message Coach",
        prompt: "How should I follow up after two days of silence?",
      });
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.mode).toBe("fallback");
    expect(typeof res.body.output).toBe("string");
    expect(res.body.output).toContain("Message Coach");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns a fallback (setup-needed) response when the model call throws", async () => {
    process.env.OPENAI_API_KEY = "test-key-abc";
    createMock.mockRejectedValueOnce(new Error("network boom"));
    const app = await makeApp();
    const res = await request(app)
      .post("/api/ai/enhance")
      .send({
        toolName: "Message Coach",
        prompt: "Help me rewrite this opener.",
      });
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.mode).toBe("setup-needed");
    expect(typeof res.body.output).toBe("string");
    expect(res.body.error).toBe("network boom");
  });

  it("returns a live response when the model call succeeds", async () => {
    process.env.OPENAI_API_KEY = "test-key-abc";
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "Try a specific, warm follow-up." } }],
    });
    const app = await makeApp();
    const res = await request(app)
      .post("/api/ai/enhance")
      .send({
        toolName: "Message Coach",
        prompt: "Help me rewrite this opener.",
      });
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(false);
    expect(res.body.mode).toBe("live");
    expect(res.body.output).toBe("Try a specific, warm follow-up.");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 on invalid bodies", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/ai/enhance").send({ prompt: "no tool name" });
    expect(res.status).toBe(400);
  });

  it("blocks a content-sensitive tool at the consent gate and never hits the default OpenAI lane", async () => {
    // A key is present (so a non-sensitive tool would go live), but the
    // Compatibility Compass prompt ships the user's own content, so it must be
    // consent-gated server-side. With no authenticated/consented user the call
    // falls back deterministically and OpenAI is never touched.
    process.env.OPENAI_API_KEY = "test-key-abc";
    const app = await makeApp();
    const res = await request(app)
      .post("/api/ai/enhance")
      .send({
        toolName: "Compatibility Compass",
        prompt: "Two people: one anxious, one avoidant. Read the dynamic.",
      });
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.fallbackReason).toBe("consent_required");
    expect(createMock).not.toHaveBeenCalled();
  });
});
