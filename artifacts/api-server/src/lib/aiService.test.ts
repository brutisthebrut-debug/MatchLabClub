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

  it("auto-cleans em dashes from free-text output without regenerating", async () => {
    createMock.mockResolvedValueOnce(
      completion("She replied fast — that's a good sign."),
    );
    const { generate } = await import("./aiService");
    const result = await generate({ system: "s", user: "u" }, "FALLBACK");
    expect(result.mode).toBe("live");
    expect(result.isFallback).toBe(false);
    expect(result.output).toBe("She replied fast, that's a good sign.");
    expect(result.voiceCleaned).toBe(true);
    // Em dashes are cleaned in place, no regeneration.
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("regenerates once when free-text output contains a banned AI-tell word", async () => {
    createMock
      .mockResolvedValueOnce(completion("Let's leverage this momentum."))
      .mockResolvedValueOnce(completion("Keep this momentum going."));
    const { generate } = await import("./aiService");
    const result = await generate({ system: "s", user: "u" }, "FALLBACK");
    expect(result.mode).toBe("live");
    expect(result.isFallback).toBe(false);
    expect(result.output).toBe("Keep this momentum going.");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("falls back deterministically when output is still off-voice after one regeneration", async () => {
    createMock
      .mockResolvedValueOnce(completion("This is a seamless experience."))
      .mockResolvedValueOnce(completion("A truly seamless experience again."));
    const { generate } = await import("./aiService");
    const result = await generate({ system: "s", user: "u" }, "ON_VOICE_FALLBACK");
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.output).toBe("ON_VOICE_FALLBACK");
    expect(result.fallbackReason).toBe("voice_violation");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("allows gamification 'unlock(ed)' reward language without regenerating", async () => {
    createMock.mockResolvedValueOnce(completion("Momentum unlocked. Keep going."));
    const { generate } = await import("./aiService");
    const result = await generate({ system: "s", user: "u" }, "FALLBACK");
    expect(result.mode).toBe("live");
    expect(result.output).toBe("Momentum unlocked. Keep going.");
    expect(result.voiceCleaned).toBeUndefined();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("reports validated:false on a voice-violation fallback for JSON tools", async () => {
    const offVoice = { ...VALID_BLUEPRINT, communicationStyle: "A seamless way of talking here." };
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(offVoice)))
      .mockResolvedValueOnce(completion(JSON.stringify(offVoice)));
    const { generate } = await import("./aiService");
    const result = await generate(
      { system: "s", user: "u", expectJson: true, context: { toolName: "Personal Blueprint" } },
      "FALLBACK",
    );
    expect(result.mode).toBe("fallback");
    expect(result.isFallback).toBe(true);
    expect(result.output).toBe("FALLBACK");
    expect(result.fallbackReason).toBe("voice_violation");
    // Must NOT claim the returned fallback was schema-validated.
    expect(result.validated).toBe(false);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("auto-cleans em dashes inside structured JSON output", async () => {
    const offVoice = { ...VALID_BLUEPRINT, growthEdge: "Open up more — slowly does it here." };
    const cleaned = { ...VALID_BLUEPRINT, growthEdge: "Open up more, slowly does it here." };
    createMock.mockResolvedValueOnce(completion(JSON.stringify(offVoice)));
    const { generate } = await import("./aiService");
    const result = await generate(
      { system: "s", user: "u", expectJson: true, context: { toolName: "Personal Blueprint" } },
      "FALLBACK",
    );
    expect(result.mode).toBe("live");
    expect(result.validated).toBe(true);
    expect(result.voiceCleaned).toBe(true);
    expect(JSON.parse(result.output)).toEqual(cleaned);
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

const VALID_PHOTO_ANALYSIS = {
  summary: "Clear solo headshot with warm natural light.",
  observations: [
    { aspect: "Lighting", assessment: "strong", detail: "Soft daylight, no harsh shadows." },
    { aspect: "Variety", assessment: "needs_work", detail: "Add one full-body and one activity shot." },
  ],
  topFix: "Swap the dim indoor shot for an outdoor photo with eye contact.",
};

function photoResponse(text: string) {
  return { content: [{ type: "text", text }], model: "claude-sonnet-4-6" };
}

function lastImageMediaType(): string {
  const call = anthropicCreateMock.mock.calls.at(-1);
  const body = call?.[0] as {
    messages: { content: { type: string; source?: { media_type?: string } }[] }[];
  };
  const image = body.messages[0].content.find((c) => c.type === "image");
  return image?.source?.media_type ?? "";
}

describe("aiService.analyzeProfilePhotos", () => {
  beforeEach(() => {
    anthropicCreateMock.mockReset();
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-anthro-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://example.test/anthropic";
  });

  afterEach(() => {
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  });

  it("labels the image with an explicit media type when base64 has no data-URL prefix", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    anthropicCreateMock.mockResolvedValueOnce(
      photoResponse(JSON.stringify(VALID_PHOTO_ANALYSIS)),
    );
    const result = await analyzeProfilePhotos({
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      imageMediaType: "image/png",
      userId: "user-with-consent",
    });
    expect(result.isFallback).toBe(false);
    expect(result.analysis).not.toBeNull();
    expect(lastImageMediaType()).toBe("image/png");
    __setConsentCheckerForTests(null);
  });

  it("normalizes image/jpg to image/jpeg from the explicit hint", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    anthropicCreateMock.mockResolvedValueOnce(
      photoResponse(JSON.stringify(VALID_PHOTO_ANALYSIS)),
    );
    await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/jpg",
      userId: "user-with-consent",
    });
    expect(lastImageMediaType()).toBe("image/jpeg");
    __setConsentCheckerForTests(null);
  });

  it("sniffs the media type from a data-URL prefix when no explicit hint is given", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    anthropicCreateMock.mockResolvedValueOnce(
      photoResponse(JSON.stringify(VALID_PHOTO_ANALYSIS)),
    );
    await analyzeProfilePhotos({
      imageBase64: "data:image/webp;base64,UklGRhoAAABXRUJQ",
      userId: "user-with-consent",
    });
    expect(lastImageMediaType()).toBe("image/webp");
    __setConsentCheckerForTests(null);
  });

  it("defaults to image/jpeg when the explicit type is unsupported and no prefix exists", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    anthropicCreateMock.mockResolvedValueOnce(
      photoResponse(JSON.stringify(VALID_PHOTO_ANALYSIS)),
    );
    await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/tiff",
      userId: "user-with-consent",
    });
    expect(lastImageMediaType()).toBe("image/jpeg");
    __setConsentCheckerForTests(null);
  });

  it("auto-cleans em dashes in the photo analysis fields", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    const offVoice = {
      summary: "Clear solo headshot — warm natural light.",
      observations: [
        { aspect: "Lighting", assessment: "strong", detail: "Soft daylight — no harsh shadows." },
      ],
      topFix: "Swap the dim shot — add an outdoor photo with eye contact.",
    };
    anthropicCreateMock.mockResolvedValueOnce(photoResponse(JSON.stringify(offVoice)));
    const result = await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/png",
      userId: "user-with-consent",
    });
    expect(result.isFallback).toBe(false);
    expect(result.mode).toBe("live");
    expect(result.analysis?.summary).toBe("Clear solo headshot, warm natural light.");
    expect(result.analysis?.observations[0].detail).toBe("Soft daylight, no harsh shadows.");
    expect(result.analysis?.topFix).toBe(
      "Swap the dim shot, add an outdoor photo with eye contact.",
    );
    __setConsentCheckerForTests(null);
  });

  it("drops to the deterministic checklist when a photo field has a banned AI-tell word", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    const offVoice = {
      ...VALID_PHOTO_ANALYSIS,
      topFix: "A seamless set of photos would help here.",
    };
    anthropicCreateMock.mockResolvedValueOnce(photoResponse(JSON.stringify(offVoice)));
    const result = await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/png",
      userId: "user-with-consent",
    });
    expect(result.analysis).toBeNull();
    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe("voice_violation");
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    __setConsentCheckerForTests(null);
  });

  it("allows gamification 'unlock(ed)' in photo analysis fields", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => true);
    const analysis = {
      ...VALID_PHOTO_ANALYSIS,
      summary: "A second photo unlocked a fuller picture of you.",
    };
    anthropicCreateMock.mockResolvedValueOnce(photoResponse(JSON.stringify(analysis)));
    const result = await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/png",
      userId: "user-with-consent",
    });
    expect(result.isFallback).toBe(false);
    expect(result.analysis?.summary).toBe("A second photo unlocked a fuller picture of you.");
    __setConsentCheckerForTests(null);
  });

  it("returns the deterministic fallback (null analysis) without calling the model when consent is off", async () => {
    const { analyzeProfilePhotos, __setConsentCheckerForTests } = await import("./aiService");
    __setConsentCheckerForTests(async () => false);
    const result = await analyzeProfilePhotos({
      imageBase64: "abc123",
      imageMediaType: "image/png",
      userId: "user-no-consent",
    });
    expect(result.analysis).toBeNull();
    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe("consent_required");
    expect(anthropicCreateMock).not.toHaveBeenCalled();
    __setConsentCheckerForTests(null);
  });
});
