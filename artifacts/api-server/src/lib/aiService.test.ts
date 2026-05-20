import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CreateFn = ReturnType<typeof vi.fn>;
const createMock: CreateFn = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: createMock,
        },
      };
      constructor(_opts: unknown) {}
    },
  };
});

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

const VALID_BLUEPRINT = {
  firstImpression: "x".repeat(25),
  repeatingPattern: "x".repeat(25),
  communicationStyle: "x".repeat(25),
  attractionPattern: "x".repeat(25),
  comfortNeeds: "x".repeat(25),
  riskLoop: "x".repeat(25),
  growthEdge: "x".repeat(25),
};

describe("aiService.generate", () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = "test-key-abc";
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns fallback when no API key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const { generate } = await import("./aiService");
    const result = await generate(
      { system: "s", user: "u", expectJson: true, context: { toolName: "Personal Blueprint" } },
      "FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.output).toBe("FALLBACK");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns free-text output on first attempt when no schema applies", async () => {
    createMock.mockResolvedValueOnce(completion("Hello, this is a coaching reply."));
    const { generate } = await import("./aiService");
    const result = await generate(
      { system: "s", user: "u" },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.isFallback).toBe(false);
    expect(result.output).toBe("Hello, this is a coaching reply.");
    expect(result.attempts).toBe(1);
    expect(result.validated).toBeUndefined();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("returns validated:true on attempt 1 when schema passes", async () => {
    createMock.mockResolvedValueOnce(completion(JSON.stringify(VALID_BLUEPRINT)));
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.validated).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.isFallback).toBe(false);
    expect(JSON.parse(result.output)).toEqual(VALID_BLUEPRINT);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries once and succeeds when first response fails schema", async () => {
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify({ bogus: "shape" })))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_BLUEPRINT)));
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.validated).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(JSON.parse(result.output)).toEqual(VALID_BLUEPRINT);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when both attempts fail schema validation", async () => {
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify({ bogus: "shape" })))
      .mockResolvedValueOnce(completion(JSON.stringify({ still: "wrong" })));
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.validated).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.output).toBe("FALLBACK");
    expect(result.error).toMatch(/schema validation/i);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("returns setup-needed fallback when the model call throws", async () => {
    createMock.mockRejectedValueOnce(new Error("network boom"));
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("setup-needed");
    expect(result.isFallback).toBe(true);
    expect(result.validated).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.error).toBe("network boom");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("tolerates JSON wrapped in prose/code fences on first attempt", async () => {
    const wrapped = "Here you go:\n```json\n" + JSON.stringify(VALID_BLUEPRINT) + "\n```";
    createMock.mockResolvedValueOnce(completion(wrapped));
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
      },
      "FALLBACK",
    );
    expect(result.validated).toBe(true);
    expect(result.attempts).toBe(1);
    expect(JSON.parse(result.output)).toEqual(VALID_BLUEPRINT);
  });
});
