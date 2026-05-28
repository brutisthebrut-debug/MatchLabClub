import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CreateFn = ReturnType<typeof vi.fn>;
const createMock: CreateFn = vi.fn();
const anthropicCreateMock: CreateFn = vi.fn();

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

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: anthropicCreateMock };
      constructor(_opts: unknown) {}
    },
  };
});

vi.mock("@workspace/db", () => {
  return {
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn(),
    },
    aiRequestMetricsTable: {},
    usersTable: { id: "id", aiContentConsentGranted: "ai_content_consent_granted" },
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
    anthropicCreateMock.mockReset();
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

  it("routes provider:'anthropic' to the Anthropic client and ignores OpenAI", async () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-anthro-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://example.test/anthropic";
    anthropicCreateMock.mockReset();
    anthropicCreateMock.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_BLUEPRINT) }],
      model: "claude-sonnet-4-6",
    });
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
        provider: "anthropic",
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.validated).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(JSON.parse(result.output)).toEqual(VALID_BLUEPRINT);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  });

  it("returns fallback for provider:'anthropic' when Anthropic env vars are missing", async () => {
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    anthropicCreateMock.mockReset();
    const { generate } = await import("./aiService");
    const result = await generate(
      { system: "s", user: "u", provider: "anthropic" },
      "ANTHROPIC_FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.output).toBe("ANTHROPIC_FALLBACK");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it("retries once on Anthropic schema failure and validates the second response", async () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-anthro-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://example.test/anthropic";
    anthropicCreateMock.mockReset();
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify({ wrong: "shape" }) }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(VALID_BLUEPRINT) }] });
    const { generate } = await import("./aiService");
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
        provider: "anthropic",
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.validated).toBe(true);
    expect(result.attempts).toBe(2);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  });

  it("short-circuits to fallback when requireContentConsent is set but user has not granted consent", async () => {
    const { generate, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => false);
    const result = await generate(
      {
        system: "s",
        user: "u",
        expectJson: true,
        context: { toolName: "Personal Blueprint" },
        requireContentConsent: true,
        userId: "user-no-consent",
      },
      "DETERMINISTIC_FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.output).toBe("DETERMINISTIC_FALLBACK");
    expect(result.error).toBe("consent_required");
    expect(createMock).not.toHaveBeenCalled();
    expect(anthropicCreateMock).not.toHaveBeenCalled();
    __setConsentCheckerForTests(null);
  });

  it("blocks consent-gated calls when userId is missing (anonymous)", async () => {
    const { generate, __setConsentCheckerForTests } = await import("./aiService");
    const consentSpy = vi.fn(async (userId: string | undefined) => Boolean(userId));
    __setConsentCheckerForTests(consentSpy);
    const result = await generate(
      {
        system: "s",
        user: "u",
        requireContentConsent: true,
        // no userId
      },
      "DETERMINISTIC_FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.error).toBe("consent_required");
    expect(consentSpy).toHaveBeenCalledWith(undefined);
    expect(createMock).not.toHaveBeenCalled();
    __setConsentCheckerForTests(null);
  });

  it("proceeds normally when requireContentConsent is set and user has granted consent", async () => {
    const { generate, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    createMock.mockResolvedValueOnce(completion("Hello, this is a coaching reply."));
    const result = await generate(
      {
        system: "s",
        user: "u",
        requireContentConsent: true,
        userId: "user-with-consent",
      },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.output).toBe("Hello, this is a coaching reply.");
    expect(createMock).toHaveBeenCalledTimes(1);
    __setConsentCheckerForTests(null);
  });

  it("getAiStatus reports both providers independently", async () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-anthro-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://example.test/anthropic";
    const { getAiStatus } = await import("./aiService");
    const status = getAiStatus();
    expect(status.providers.openai.keyDetected).toBe(true);
    expect(status.providers.openai.model).toBe("gpt-4o-mini");
    expect(status.providers.anthropic.keyDetected).toBe(true);
    expect(status.providers.anthropic.model).toBe("claude-sonnet-4-6");
    expect(status.providers.anthropic.source).toBe("replit-proxy");
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
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
