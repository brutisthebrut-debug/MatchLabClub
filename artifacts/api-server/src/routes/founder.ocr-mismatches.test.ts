import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, auditsTable, usersTable } from "@workspace/db";
import type { OcrCorrectionsRecord } from "@workspace/db";
import founderRouter from "./founder";

const FOUNDER_USER = "founder-ocr-route-test";
function makeTestApp(userId: string | null = FOUNDER_USER): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userId) req.user = { id: userId, email: null, firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  app.use("/api", founderRouter);
  return app;
}

let app: Express;

beforeAll(async () => {
  await db.insert(usersTable).values({ id: FOUNDER_USER, role: "founder" }).onConflictDoNothing();
  app = makeTestApp();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, FOUNDER_USER));
  await pool.end();
});

interface SeedIds {
  rileyId: number;
  emmaId: number;
  rileyDupId: number;
  noCorrectionsId: number;
  manualId: number;
}

async function seed(): Promise<SeedIds> {
  // Screenshot audit with corrections on firstName + bio.
  const [riley] = await db
    .insert(auditsTable)
    .values({
      firstName: "Riley",
      age: 31,
      gender: "unspecified",
      datingGoal: "find a relationship",
      bio: "Yoga teacher who loves long hikes and slow Sundays.",
      source: "screenshot",
      rawOcrText: "Rilye\n31\nYoga teacher...",
      ocrCorrections: {
        firstName: { raw: "Rilye", corrected: "Riley" },
        bio: {
          raw: "Yoga teacher who loves long hikes and slow Sundayss.",
          corrected: "Yoga teacher who loves long hikes and slow Sundays.",
        },
      } satisfies OcrCorrectionsRecord,
    })
    .returning({ id: auditsTable.id });

  // Second screenshot audit with the SAME firstName diff so we can verify
  // topDiffs ranking aggregates duplicates.
  const [rileyDup] = await db
    .insert(auditsTable)
    .values({
      firstName: "Riley",
      age: 29,
      gender: "unspecified",
      datingGoal: "find a relationship",
      bio: "Same person different audit.",
      source: "screenshot",
      rawOcrText: "Rilye...",
      ocrCorrections: {
        firstName: { raw: "Rilye", corrected: "Riley" },
      } satisfies OcrCorrectionsRecord,
    })
    .returning({ id: auditsTable.id });

  // Different firstName diff — should appear as a separate topDiff bucket.
  const [emma] = await db
    .insert(auditsTable)
    .values({
      firstName: "Emma",
      age: 29,
      gender: "unspecified",
      datingGoal: "find a relationship",
      bio: "Anything goes.",
      source: "screenshot",
      rawOcrText: "Erma\n29\n...",
      ocrCorrections: {
        firstName: { raw: "Erma", corrected: "Emma" },
        sourceApp: { raw: "Humble", corrected: "Bumble" },
      } satisfies OcrCorrectionsRecord,
    })
    .returning({ id: auditsTable.id });

  // Screenshot audit WITHOUT corrections — bumps totalScreenshotAudits and
  // auditsWithRawOcr but must not show up in perField / recent.
  const [noCorrections] = await db
    .insert(auditsTable)
    .values({
      firstName: "Quinn",
      age: 33,
      gender: "unspecified",
      datingGoal: "casual",
      bio: "No corrections recorded.",
      source: "screenshot",
      rawOcrText: "Quinn\n33\n...",
      ocrCorrections: null,
    })
    .returning({ id: auditsTable.id });

  // Manual audit — should NOT count toward totalScreenshotAudits.
  const [manual] = await db
    .insert(auditsTable)
    .values({
      firstName: "Manual",
      age: 30,
      gender: "unspecified",
      datingGoal: "find a relationship",
      bio: "Plain manual entry, no OCR involved.",
      source: "manual",
    })
    .returning({ id: auditsTable.id });

  return {
    rileyId: riley.id,
    rileyDupId: rileyDup.id,
    emmaId: emma.id,
    noCorrectionsId: noCorrections.id,
    manualId: manual.id,
  };
}

async function cleanup(ids: SeedIds): Promise<void> {
  await db
    .delete(auditsTable)
    .where(
      inArray(auditsTable.id, [
        ids.rileyId,
        ids.rileyDupId,
        ids.emmaId,
        ids.noCorrectionsId,
        ids.manualId,
      ]),
    );
}

describe("GET /api/founder/ocr-mismatches", () => {
  let ids: SeedIds;

  beforeEach(async () => {
    ids = await seed();
  });

  afterEach(async () => {
    await cleanup(ids);
  });

  it("aggregates per-field correction counts and ranks topDiffs by frequency", async () => {
    const res = await request(app)
      .get("/api/founder/ocr-mismatches")
      ;
    expect(res.status).toBe(200);

    const { summary, perField, recent } = res.body;

    // The fixture seeds 3 rows with corrections, but other tests in the suite
    // (or prior data) may exist. Assert lower bounds and look up our entries
    // explicitly so the test is robust to coexisting data.
    expect(summary.totalScreenshotAudits).toBeGreaterThanOrEqual(4);
    expect(summary.auditsWithRawOcr).toBeGreaterThanOrEqual(4);
    expect(summary.auditsWithCorrections).toBeGreaterThanOrEqual(3);
    expect(summary.sampleSize).toBeGreaterThanOrEqual(3);

    const firstNameField = perField.find(
      (f: { field: string }) => f.field === "firstName",
    );
    expect(firstNameField).toBeTruthy();
    expect(firstNameField.correctionsCount).toBeGreaterThanOrEqual(3);

    // "Rilye → Riley" should appear with at least count 2 (two seeded rows).
    const rilyeRow = firstNameField.topDiffs.find(
      (d: { example: string; count: number }) =>
        d.example.includes("Rilye") && d.example.includes("Riley"),
    );
    expect(rilyeRow?.count).toBeGreaterThanOrEqual(2);

    // "Erma → Emma" should also appear, with count 1.
    const ermaRow = firstNameField.topDiffs.find(
      (d: { example: string; count: number }) =>
        d.example.includes("Erma") && d.example.includes("Emma"),
    );
    expect(ermaRow?.count).toBeGreaterThanOrEqual(1);

    // The more frequent diff should rank ahead of the less frequent one.
    const rilyeIndex = firstNameField.topDiffs.findIndex(
      (d: { example: string }) => d.example.includes("Rilye"),
    );
    const ermaIndex = firstNameField.topDiffs.findIndex(
      (d: { example: string }) => d.example.includes("Erma"),
    );
    expect(rilyeIndex).toBeGreaterThanOrEqual(0);
    expect(ermaIndex).toBeGreaterThanOrEqual(0);
    expect(rilyeIndex).toBeLessThan(ermaIndex);

    // The bio + sourceApp fields should also report nonzero corrections.
    const bioField = perField.find(
      (f: { field: string }) => f.field === "bio",
    );
    expect(bioField.correctionsCount).toBeGreaterThanOrEqual(1);
    const sourceAppField = perField.find(
      (f: { field: string }) => f.field === "sourceApp",
    );
    expect(sourceAppField.correctionsCount).toBeGreaterThanOrEqual(1);

    // perField is sorted by correctionsCount desc.
    for (let i = 0; i < perField.length - 1; i++) {
      expect(perField[i].correctionsCount).toBeGreaterThanOrEqual(
        perField[i + 1].correctionsCount,
      );
    }

    // `recent` should contain one entry per (audit, field) for our seeded rows.
    const ourRecent = (recent as Array<{ auditId: number; field: string }>)
      .filter((r) =>
        [ids.rileyId, ids.rileyDupId, ids.emmaId].includes(r.auditId),
      );
    // Riley (2 fields) + RileyDup (1 field) + Emma (2 fields) = 5 entries.
    expect(ourRecent.length).toBe(5);

    // The audit without corrections must NOT appear in perField/recent
    // (only in the summary totals).
    expect(
      (recent as Array<{ auditId: number }>).some(
        (r) => r.auditId === ids.noCorrectionsId,
      ),
    ).toBe(false);
    // The manual audit must NOT appear at all.
    expect(
      (recent as Array<{ auditId: number }>).some(
        (r) => r.auditId === ids.manualId,
      ),
    ).toBe(false);
  });

  it("applies the window filter to summary, perField, and recent", async () => {
    // Backdate the rileyDup audit far enough that a 7-day window excludes it.
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await db
      .update(auditsTable)
      .set({ createdAt: longAgo })
      .where(inArray(auditsTable.id, [ids.rileyDupId]));

    const res7 = await request(app)
      .get("/api/founder/ocr-mismatches?window=7")
      ;
    expect(res7.status).toBe(200);
    expect(res7.body.summary.windowDays).toBe(7);
    expect(typeof res7.body.summary.since).toBe("string");

    // rileyDup is now outside the 7-day window, so it must not appear in recent.
    const recent7 = res7.body.recent as Array<{ auditId: number }>;
    expect(recent7.some((r) => r.auditId === ids.rileyDupId)).toBe(false);
    // The other two seeded corrected audits are within 7 days.
    expect(recent7.some((r) => r.auditId === ids.rileyId)).toBe(true);
    expect(recent7.some((r) => r.auditId === ids.emmaId)).toBe(true);

    // With a 90-day window, the backdated rileyDup audit comes back.
    const res90 = await request(app)
      .get("/api/founder/ocr-mismatches?window=90")
      ;
    expect(res90.body.summary.windowDays).toBe(90);
    const recent90 = res90.body.recent as Array<{ auditId: number }>;
    expect(recent90.some((r) => r.auditId === ids.rileyDupId)).toBe(true);

    // An invalid window value falls back to the default (no time filter).
    const resBad = await request(app)
      .get("/api/founder/ocr-mismatches?window=42")
      ;
    expect(resBad.body.summary.windowDays).toBeNull();
  });

  it("supports sort=top to rank perField by the single top diff", async () => {
    const resTotal = await request(app)
      .get("/api/founder/ocr-mismatches?sort=total")
      ;
    expect(resTotal.body.summary.sort).toBe("total");
    // perField sorted by correctionsCount desc.
    const totals = resTotal.body.perField as Array<{
      correctionsCount: number;
    }>;
    for (let i = 0; i < totals.length - 1; i++) {
      expect(totals[i].correctionsCount).toBeGreaterThanOrEqual(
        totals[i + 1].correctionsCount,
      );
    }

    const resTop = await request(app)
      .get("/api/founder/ocr-mismatches?sort=top")
      ;
    expect(resTop.body.summary.sort).toBe("top");
    const tops = resTop.body.perField as Array<{ topDiffCount: number }>;
    for (let i = 0; i < tops.length - 1; i++) {
      expect(tops[i].topDiffCount).toBeGreaterThanOrEqual(
        tops[i + 1].topDiffCount,
      );
    }
  });

  it("rejects anonymous requests even when they invent a legacy key", async () => {
    const anonymousApp = makeTestApp(null);
    const resNoKey = await request(anonymousApp).get("/api/founder/ocr-mismatches");
    expect(resNoKey.status).toBe(401);
    expect(resNoKey.body).toEqual({
      error: "Sign in with a founder account.",
    });

    const resWrongKey = await request(anonymousApp)
      .get("/api/founder/ocr-mismatches")
      .set("x-founder-key", "not-the-right-key");
    expect(resWrongKey.status).toBe(401);
    expect(resWrongKey.body).toEqual({
      error: "Sign in with a founder account.",
    });
  });
});
