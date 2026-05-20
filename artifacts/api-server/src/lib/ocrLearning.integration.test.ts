import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import crypto from "crypto";
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

// Scoped cleanup: track only the rows this test run inserts so that
// afterEach deletes exactly those rows — no resetTestDb() / TRUNCATE that
// would wipe rows belonging to other parallel workers.
const seededAuditIds: number[] = [];
const seededRuleIds: string[] = [];

afterEach(async () => {
  const { db, auditsTable, ocrLearnedRulesTable, ocrRuleReviewLogTable } =
    await import("./testDb");
  const { inArray } = await import("drizzle-orm");

  if (seededAuditIds.length > 0) {
    await db
      .delete(auditsTable)
      .where(inArray(auditsTable.id, [...seededAuditIds]));
    seededAuditIds.length = 0;
  }

  if (seededRuleIds.length > 0) {
    // Remove review-log entries that reference our rules first (FK order).
    await db
      .delete(ocrRuleReviewLogTable)
      .where(inArray(ocrRuleReviewLogTable.ruleId, [...seededRuleIds]));
    await db
      .delete(ocrLearnedRulesTable)
      .where(inArray(ocrLearnedRulesTable.id, [...seededRuleIds]));
    seededRuleIds.length = 0;
  }

  // Reset in-process learned-rules cache so the next test starts clean.
  const { setLearnedRulesCacheForTests, EMPTY_LEARNED_RULES } =
    await import("./ocrLearning");
  setLearnedRulesCacheForTests(EMPTY_LEARNED_RULES);
});

function toBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/**
 * Generate a per-run unique suffix using only lowercase letters so the
 * resulting name matches NAME_RX = /^([A-Z][a-zA-Z''\-]{1,20})/ in
 * profileParser.ts (digits would fail that regex).
 */
function randomLetters(n: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return Array.from(crypto.randomBytes(n))
    .map((b) => alphabet[b % 26])
    .join("");
}

/**
 * Compute the deterministic rule ID that `learnFromCorrections` will assign,
 * mirroring `ruleId()` in ocrLearning.ts:
 *   `${kind}:${scope ?? ""}:${pattern}`
 */
function computeRuleId(
  kind: string,
  pattern: string,
  scope: string | null,
): string {
  return `${kind}:${scope ?? ""}:${pattern}`;
}

describe("OCR learning loop (end-to-end)", () => {
  // Per-run unique suffix (letters only so NAME_RX still matches). This
  // ensures the OCR correction values and the resulting learned-rule ID are
  // unique across parallel workers, preventing cross-worker row collisions.
  const runTag = randomLetters(4); // e.g. "abce"

  // RAW_NAME is what the fake OCR "misreads" — starts with uppercase M,
  // followed by lowercase letters only, matching NAME_RX.
  const RAW_NAME = `Moo${runTag}`;       // e.g. "Mooabce"
  const CORRECTED_NAME = `Moe${runTag}`; // e.g. "Moeabce"

  // The normalized (lowercase) raw name — used as the rule pattern.
  const RAW_NORM = RAW_NAME.toLowerCase(); // e.g. "mooabce"

  const RAW_OCR_TEXT = [
    RAW_NAME,
    "29",
    "Hinge",
    "Engineer who loves long hikes and slow Sundays.",
    "My ideal Sunday is",
    "pottery and a long walk",
  ].join("\n");

  it("seed -> learn -> parser produces corrected value, and a fresh /audits/from-screenshot records no diff", async () => {
    const { auditsTable, db, dumpTable } = await import("./testDb");
    const {
      learnFromCorrections,
      listPendingRules,
      approveOcrRule,
      getCachedLearnedRules,
    } = await import("./ocrLearning");
    const { parseProfileText } = await import("./profileParser");

    // 1. Seed two audits with the same firstName correction (RAW_NAME -> CORRECTED_NAME).
    //    MIN_OCCURRENCES defaults to 2, so a single audit would not promote
    //    the rule. This is the realistic user-correction signal the learner
    //    is supposed to act on.
    //    We capture each inserted row's ID so afterEach can delete exactly
    //    these rows without touching any other worker's data.
    for (let i = 0; i < 2; i++) {
      const [row] = await db.insert(auditsTable).values({
        firstName: CORRECTED_NAME,
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
          firstName: { raw: RAW_NAME, corrected: CORRECTED_NAME },
        },
      });
      seededAuditIds.push(row.id as number);
    }

    // Sanity: before learning, the parser yields the uncorrected value.
    const before = parseProfileText(RAW_OCR_TEXT, getCachedLearnedRules());
    expect(before.firstName).toBe(RAW_NAME);

    // 2. Run the learner, restricted to our seeded audit IDs so the scan is
    //    not affected by any other parallel worker's rows.
    const result = await learnFromCorrections({
      limitToAuditIds: [...seededAuditIds],
    });
    expect(result.scannedAudits).toBe(2);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(
      result.candidates.find(
        (c) => c.kind === "nameSubstitution" && c.pattern === RAW_NORM,
      ),
    ).toMatchObject({ replacement: CORRECTED_NAME, occurrences: 2 });
    expect(result.persisted).toBeGreaterThanOrEqual(1);

    // Derive rule IDs from the scoped candidates and register them for
    // cleanup. This avoids reading the global pending-rules table and
    // accidentally touching rules from other parallel workers.
    const expectedRuleIds = result.candidates.map((c) =>
      computeRuleId(c.kind, c.pattern, c.scope),
    );
    for (const id of expectedRuleIds) {
      if (!seededRuleIds.includes(id)) seededRuleIds.push(id);
    }

    // 3. Approve the learned rule (Task #253: rules are now gated on founder
    //    approval before they affect parsing). We read only the pending rules
    //    whose IDs match this run's candidates — scoped, not global.
    const allPending = await listPendingRules();
    const ourPending = allPending.filter((r) => expectedRuleIds.includes(r.id));
    expect(ourPending.length).toBeGreaterThanOrEqual(1);
    for (const rule of ourPending) {
      await approveOcrRule(rule.id, "test");
    }

    const after = parseProfileText(RAW_OCR_TEXT, getCachedLearnedRules());
    expect(after.firstName).toBe(CORRECTED_NAME);

    // 4. A fresh /audits/from-screenshot scan of the same OCR text should
    //    persist the corrected firstName AND record no ocrCorrections diff
    //    for that field — there's nothing left for the user to fix.
    //    We snapshot which audit IDs exist before the HTTP call and look for
    //    exactly the one new row afterwards — scoped, not a global count.
    const auditIdsBefore = new Set(dumpTable("audits").map((r) => r.id));

    const res = await request(app)
      .post("/api/audits/from-screenshot")
      .send({ imageBase64: toBase64(RAW_OCR_TEXT) });

    expect(res.status).toBe(200);
    expect(() => AuditFromScreenshotResponse.parse(res.body)).not.toThrow();

    const newAuditRows = dumpTable("audits").filter(
      (r) => !auditIdsBefore.has(r.id),
    );
    expect(newAuditRows).toHaveLength(1);
    const newAudit = newAuditRows[0];

    // Track the newly-created audit for cleanup too.
    seededAuditIds.push(newAudit.id as number);

    expect(newAudit.source).toBe("screenshot");
    expect(newAudit.firstName).toBe(CORRECTED_NAME);
    // No client-side corrections supplied, AND the parser already produced
    // the corrected value, so no diff is ever recorded.
    expect(newAudit.ocrCorrections).toBeNull();
  });
});
