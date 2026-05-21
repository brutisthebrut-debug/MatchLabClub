import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import {
  HINGE_OCR,
  BUMBLE_OCR,
  TINDER_OCR,
  OKCUPID_OCR,
  UNREADABLE_OCR,
} from "./__fixtures__/screenshotOcr";

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

// Mock the OCR layer to avoid invoking tesseract.js in tests. The mocked
// `extractProfileFromScreenshot` decodes the base64 payload as UTF-8 text
// (the fixtures we send in the request) and feeds it through the real
// deterministic parser via `parseProfileText`.
vi.mock("../lib/ocr", async () => {
  const profileParser = await import("../lib/profileParser");
  return {
    parseProfileText: profileParser.parseProfileText,
    detectLowConfidenceFields: (parsed: {
      firstName: string | null;
      age: number | null;
      sourceApp: string | null;
      bio: string;
      prompts: string[];
    }) => {
      const flags: string[] = [];
      if (!parsed.firstName) flags.push("firstName");
      if (parsed.age === null) flags.push("age");
      if (!parsed.sourceApp) flags.push("sourceApp");
      if (!parsed.bio || parsed.bio.length < 20) flags.push("bio");
      if (parsed.prompts.length === 0) flags.push("prompts");
      return flags;
    },
    extractProfileFromScreenshot: async (imageBase64: string) => {
      const cleaned = imageBase64.trim();
      if (!cleaned) throw new Error("Empty image payload");
      const rawText = Buffer.from(cleaned, "base64").toString("utf8").trim();
      const parsed = profileParser.parseProfileText(rawText);
      return { ...parsed, rawText };
    },
  };
});

import { AuditFromScreenshotResponse } from "@workspace/api-zod";

async function makeTestApp(): Promise<Express> {
  const auditsRouter = (await import("./audits")).default;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", auditsRouter);
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

describe("POST /api/audits/from-screenshot", () => {
  it("happy path: extracts a Hinge profile and returns the audit response contract", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(HINGE_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.auditId).toBeTypeOf("number");
    expect(res.body.extractedBio.length).toBeGreaterThan(0);
    expect(res.body.extractedPrompts.length).toBeGreaterThan(0);
    expect(res.body.report.readinessScore).toBeGreaterThan(0);
    expect(res.body.rawOcrText).toMatch(/Sarah/);
    expect(res.body.report.rewrittenBio.length).toBeGreaterThan(0);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("audits");
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe("screenshot");
    expect(rows[0].status).toBe("complete");
    expect(rows[0].sourceApp).toBe("Hinge");
    expect(rows[0].firstName).toBe("Sarah");
    expect(rows[0].age).toBe(28);
    expect(rows[0].rawOcrText).toMatch(/Sarah/);
  });

  it("happy path: extracts a Bumble profile", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(BUMBLE_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.sourceApp).toBe("Bumble");
    expect(row.firstName).toBe("Emma");
    expect(row.age).toBe(29);
  });

  it("happy path: extracts a Tinder profile", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(TINDER_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.sourceApp).toBe("Tinder");
    expect(row.firstName).toBe("Mia");
    expect(row.age).toBe(24);
  });

  it("happy path: extracts an OkCupid profile", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(OKCUPID_OCR) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.sourceApp).toBe("OkCupid");
    expect(row.firstName).toBe("Jordan");
    expect(row.age).toBe(27);
    expect(row.bio.toLowerCase()).toMatch(/sourdough|hiking|engineer|baker/);
  });

  it("corrected-text path: skips OCR when `bio` is provided and records OCR corrections", async () => {
    const correctedBio =
      "Yoga teacher who loves long hikes and slow Sundays. Looking for someone who values curiosity over cleverness.";
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({
        firstName: "Riley",
        age: 31,
        sourceApp: "Hinge",
        bio: correctedBio,
        prompts: ["My ideal Sunday: pottery and a long walk"],
        rawOcrText: "Riley\n31\nYoga teacher who...",
        rawExtracted: {
          firstName: "Rilye",
          age: 31,
          sourceApp: "Hinge",
          bio: "Yoga teacher who loves long hikes and slow Sundayss.",
          prompts: ["My ideal Sunday: pottery and a long walk"],
        },
      });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();
    expect(res.body.extractedBio).toBe(correctedBio);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.firstName).toBe("Riley");
    expect(row.bio).toBe(correctedBio);
    expect(row.ocrCorrections).toBeTruthy();
    expect(row.ocrCorrections?.firstName?.raw).toBe("Rilye");
    expect(row.ocrCorrections?.firstName?.corrected).toBe("Riley");
    expect(row.ocrCorrections?.bio).toBeTruthy();
    // prompts were identical — should NOT appear in the corrections diff.
    expect(row.ocrCorrections?.prompts).toBeUndefined();
  });

  it("corrected-text path: records NO ocr_corrections when every rawExtracted field matches the corrected value", async () => {
    const correctedBio = "Engineer who loves long hikes and slow Sundays.";
    const correctedPrompts = ["My ideal Sunday: pottery and a long walk"];
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({
        firstName: "Riley",
        age: 31,
        sourceApp: "Hinge",
        bio: correctedBio,
        prompts: correctedPrompts,
        rawOcrText: "Riley\n31\nEngineer who...",
        rawExtracted: {
          firstName: "Riley",
          age: 31,
          sourceApp: "Hinge",
          bio: correctedBio,
          prompts: correctedPrompts,
        },
      });

    expect(res.status).toBe(200);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.ocrCorrections).toBeNull();
    // rawOcrText supplied by the client is still persisted so the audit is
    // inspectable later, even when no diff was produced.
    expect(row.rawOcrText).toBe("Riley\n31\nEngineer who...");
  });

  it("image-OCR path: stores raw_ocr_text and leaves ocr_corrections null", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(HINGE_OCR) });

    expect(res.status).toBe(200);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("audits")[0];
    expect(row.rawOcrText).toBeTruthy();
    expect(typeof row.rawOcrText).toBe("string");
    expect((row.rawOcrText as string).length).toBeGreaterThan(0);
    // No client corrections were provided, so no diff should be recorded.
    expect(row.ocrCorrections).toBeNull();
  });

  it("returns 400 when no readable profile text is found in the screenshot", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(UNREADABLE_OCR) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no readable profile text/i);

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("audits").length).toBe(0);
  });

  it("returns 400 when neither imageBase64 nor bio is provided", async () => {
    const res = await request(app).post("/api/audits/from-screenshot").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when the OCR layer throws (bad base64)", async () => {
    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Couldn't read text|No readable|Provide either/i);
  });
});
