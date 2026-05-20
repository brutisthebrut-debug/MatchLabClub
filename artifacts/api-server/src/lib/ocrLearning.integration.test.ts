import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

vi.mock("@workspace/db", async () => await import("./testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("./testDb");
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

// Mock only the tesseract.js worker — the rest of `lib/ocr` (which is what
// invokes the parser with the cached learned rules) runs for real, so this
// test genuinely exercises the learning → parse loop.
vi.mock("tesseract.js", () => ({
  createWorker: async () => ({
    recognize: async (buffer: Buffer) => ({
      data: { text: buffer.toString("utf8") },
    }),
    terminate: async () => undefined,
  }),
}));

import { AuditFromScreenshotResponse } from "@workspace/api-zod";

async function makeTestApp(): Promise<Express> {
  const auditsRouter = (await import("../routes/audits")).default;
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
  const { resetTestDb, setLearnedRulesCacheForTests, EMPTY_LEARNED_RULES } =
    await import("./testDb").then(async (testDb) => ({
      ...(await import("./ocrLearning")),
      resetTestDb: testDb.resetTestDb,
    }));
  resetTestDb();
  setLearnedRulesCacheForTests(EMPTY_LEARNED_RULES);
});

function toBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("OCR learning loop (end-to-end)", () => {
  // The OCR'd raw text the parser sees for a screenshot of "Moe". Without any
  // learned rules the parser pulls out "Moo" (the literal OCR mistake), so
  // the user has to correct it to "Moe" in the review screen.
  const RAW_OCR_TEXT = [
    "Moo",
    "29",
    "Hinge",
    "Engineer who loves long hikes and slow Sundays.",
    "My ideal Sunday is",
    "pottery and a long walk",
  ].join("\n");

  it("seed -> learn -> parser produces corrected value, and a fresh /audits/from-screenshot records no diff", async () => {
    const { auditsTable, db } = await import("./testDb");
    const {
      learnFromCorrections,
      listPendingRules,
      approveOcrRule,
      getCachedLearnedRules,
    } = await import("./ocrLearning");
    const { parseProfileText } = await import("./profileParser");

    // 1. Seed two audits with the same `firstName` correction (Moo -> Moe).
    //    MIN_OCCURRENCES defaults to 2, so a single audit would not promote
    //    the rule. This is the realistic user-correction signal the learner
    //    is supposed to act on.
    for (let i = 0; i < 2; i++) {
      await db.insert(auditsTable).values({
        firstName: "Moe",
        age: 29,
        gender: "unspecified",
        orientation: "unspecified",
        datingGoal: "find a relationship",
        currentApps: ["Hinge"],
        bio: "Engineer who loves long hikes and slow Sundays.",
        prompts: "My ideal Sunday is\npottery and a long walk",
        sourceApp: "Hinge",
        status: "complete",
        source: "screenshot",
        rawOcrText: RAW_OCR_TEXT,
        ocrCorrections: {
          firstName: { raw: "Moo", corrected: "Moe" },
        },
      });
    }

    // Sanity: before learning, the parser yields the uncorrected value.
    const before = parseProfileText(RAW_OCR_TEXT, getCachedLearnedRules());
    expect(before.firstName).toBe("Moo");

    // 2. Run the learner. It should scan the seeded audits, promote the
    //    Moo->Moe rule (occurrences >= 2), persist it, and refresh the
    //    in-process cache.
    const result = await learnFromCorrections();
    expect(result.scannedAudits).toBe(2);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(
      result.candidates.find(
        (c) => c.kind === "nameSubstitution" && c.pattern === "moo",
      ),
    ).toMatchObject({ replacement: "Moe", occurrences: 2 });
    expect(result.persisted).toBeGreaterThanOrEqual(1);

    // 3. Approve the learned rule (Task #253: rules are now gated on founder
    //    approval before they affect parsing). After approval the cache
    //    refreshes and the parser should produce the corrected value.
    const pending = await listPendingRules();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    for (const rule of pending) {
      await approveOcrRule(rule.id, "test");
    }

    const after = parseProfileText(RAW_OCR_TEXT, getCachedLearnedRules());
    expect(after.firstName).toBe("Moe");

    // 4. A fresh /audits/from-screenshot scan of the same OCR text should
    //    persist the corrected firstName AND record no ocrCorrections diff
    //    for that field — there's nothing left for the user to fix.
    const { dumpTable } = await import("./testDb");
    const auditCountBefore = dumpTable("audits").length;

    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(RAW_OCR_TEXT) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();

    const auditRows = dumpTable("audits");
    expect(auditRows.length).toBe(auditCountBefore + 1);
    const newAudit = auditRows[auditRows.length - 1];
    expect(newAudit.source).toBe("screenshot");
    expect(newAudit.firstName).toBe("Moe");
    // No client-side corrections supplied, AND the parser already produced
    // the corrected value, so no diff is ever recorded.
    expect(newAudit.ocrCorrections).toBeNull();
  });
});
