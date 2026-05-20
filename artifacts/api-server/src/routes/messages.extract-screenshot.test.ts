import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

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

// Mock the OCR layer so we don't invoke tesseract.js in tests. The mocked
// `extractChatFromScreenshot` decodes the base64 payload as UTF-8 text (the
// fixture we send in the request) and feeds it through the real noise-filter
// + `detectSourceApp` pipeline, mirroring the style of
// `audits.from-screenshot.test.ts`.
vi.mock("../lib/ocr", async () => {
  const profileParser = await import("../lib/profileParser");

  const CHAT_UI_NOISE: RegExp[] = [
    /^send like$/i,
    /^send a like$/i,
    /^send a compliment$/i,
    /^send$/i,
    /^reply$/i,
    /^message$/i,
    /^type a message/i,
    /^aa$/i,
    /^delivered$/i,
    /^read$/i,
    /^seen$/i,
    /^it'?s a match/i,
    /^unmatch$/i,
    /^report$/i,
    /^block$/i,
    /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
    /^(yesterday|today|now|just now|\d+\s?(m|h|d)\s?ago)$/i,
    /^(mon|tue|wed|thu|fri|sat|sun)(day)?$/i,
    /^[•·●○◆■\s]+$/,
  ];
  function isChatNoise(line: string): boolean {
    if (line.length < 2) return true;
    return CHAT_UI_NOISE.some((rx) => rx.test(line));
  }

  function inferSpeakerTurns(lines: string[]): { speaker: "them" | "you"; text: string }[] {
    const blocks: string[][] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (isChatNoise(line)) {
        if (current.length > 0) { blocks.push(current); current = []; }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) blocks.push(current);
    return blocks.flatMap((block, i) =>
      block.map((text) => ({ speaker: (i % 2 === 0 ? "them" : "you") as "them" | "you", text })),
    );
  }

  return {
    extractChatFromScreenshot: async (imageBase64: string) => {
      const cleaned = imageBase64.trim();
      if (!cleaned) throw new Error("Empty image payload");
      const rawText = Buffer.from(cleaned, "base64").toString("utf8").trim();
      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter((l) => l.length > 0);
      const sourceApp = profileParser.detectSourceApp(lines);
      const conversationText = lines.filter((l) => !isChatNoise(l)).join("\n");
      const speakerTurns = inferSpeakerTurns(lines);
      return { conversationText, sourceApp, rawText, speakerTurns };
    },
  };
});

import { ExtractMessageScreenshotResponse } from "@workspace/api-zod";

async function makeTestApp(): Promise<Express> {
  const messagesRouter = (await import("./messages")).default;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", messagesRouter);
  return app;
}

let app: Express;

beforeAll(async () => {
  app = await makeTestApp();
});

beforeEach(async () => {
  const { resetTestDb } = await import("../lib/testDb");
  resetTestDb();
});

function toBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

const HINGE_CHAT = [
  "9:41",
  "Sam",
  "Hey! Saw you climbed Kilimanjaro — favorite memory from the trip?",
  "Honestly the sunrise above the clouds at Stella Point. Surreal.",
  "Send Like",
  "Two truths and a lie",
  "Delivered",
].join("\n");

const BUMBLE_CHAT = [
  "Bumble",
  "10:24 AM",
  "Loved your breakfast burrito photo — what's the secret?",
  "Smoked paprika and way too much cheese 😅",
  "Send a Compliment",
  "Delivered",
].join("\n");

const TINDER_CHAT = [
  "Tinder",
  "It's a Match!",
  "9:02 PM",
  "Coffee black like your soul?",
  "Black like my Monday mornings, yeah",
  "Type a message...",
].join("\n");

const UNREADABLE_CHAT = ["9:41", "Delivered", "•"].join("\n");

describe("POST /api/messages/extract-screenshot", () => {
  it("happy path: extracts a Hinge chat and returns the contract response", async () => {
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: toBase64(HINGE_CHAT) });

    expect(res.status).toBe(200);
    expect(() => ExtractMessageScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.sourceApp).toBe("Hinge");
    expect(res.body.conversationText).toMatch(/Kilimanjaro/);
    expect(res.body.conversationText).toMatch(/Stella Point/);
    // UI chrome should be filtered out of conversationText but preserved in rawOcrText.
    expect(res.body.conversationText).not.toMatch(/Send Like/);
    expect(res.body.conversationText).not.toMatch(/Delivered/);
    expect(res.body.conversationText).not.toMatch(/^9:41$/m);
    expect(res.body.rawOcrText).toMatch(/Send Like/);
    expect(res.body.rawOcrText).toMatch(/Delivered/);
    // Speaker turns should be returned and contain valid speaker values.
    expect(Array.isArray(res.body.speakerTurns)).toBe(true);
    expect(res.body.speakerTurns.length).toBeGreaterThan(0);
    for (const turn of res.body.speakerTurns) {
      expect(["them", "you"]).toContain(turn.speaker);
      expect(typeof turn.text).toBe("string");
    }
    // The Hinge sample has no noise between the two message lines so they both
    // land in the first block → attributed to "them".
    const kilimanjaro = res.body.speakerTurns.find((t: { text: string }) =>
      t.text.includes("Kilimanjaro"),
    );
    expect(kilimanjaro?.speaker).toBe("them");
  });

  it("happy path: extracts a Bumble chat", async () => {
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: toBase64(BUMBLE_CHAT) });

    expect(res.status).toBe(200);
    expect(() => ExtractMessageScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.sourceApp).toBe("Bumble");
    expect(res.body.conversationText).toMatch(/breakfast burrito/);
    expect(res.body.conversationText).not.toMatch(/Send a Compliment/);
    expect(Array.isArray(res.body.speakerTurns)).toBe(true);
    expect(res.body.speakerTurns.length).toBeGreaterThan(0);
  });

  it("happy path: extracts a Tinder chat", async () => {
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: toBase64(TINDER_CHAT) });

    expect(res.status).toBe(200);
    expect(() => ExtractMessageScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.sourceApp).toBe("Tinder");
    expect(res.body.conversationText).toMatch(/Coffee black/);
    expect(res.body.conversationText).not.toMatch(/Type a message/);
    expect(res.body.conversationText).not.toMatch(/It's a Match/i);
    expect(Array.isArray(res.body.speakerTurns)).toBe(true);
    expect(res.body.speakerTurns.length).toBeGreaterThan(0);
  });

  it("returns null sourceApp when no app-specific cues are present", async () => {
    const generic = [
      "Hey, how's your week?",
      "Pretty good — kind of slammed at work.",
      "Same here. Want to grab dinner Friday?",
    ].join("\n");
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: toBase64(generic) });

    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBeNull();
    expect(res.body.conversationText).toMatch(/dinner Friday/);
  });

  it("returns 400 when the body fails Zod validation", async () => {
    const res = await request(app).post("/api/messages/extract-screenshot").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when the OCR layer throws (empty payload)", async () => {
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Couldn't read text|No readable/i);
  });

  it("returns 400 when no readable conversation text remains after noise filtering", async () => {
    const res = await request(app)
      .post("/api/messages/extract-screenshot")
      .send({ imageBase64: toBase64(UNREADABLE_CHAT) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no readable conversation/i);
  });
});
