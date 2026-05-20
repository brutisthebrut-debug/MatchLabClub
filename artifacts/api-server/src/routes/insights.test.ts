import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
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

import { AnalyzeInsightResponse, ListInsightsResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const insightsRouter = (await import("./insights")).default;
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
  app.use("/api", insightsRouter);
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

beforeEach(async () => {
  const { resetTestDb } = await import("../lib/testDb");
  resetTestDb();
});

const USER_ID = `test-insight-user-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  sourceLabel: "Gmail export — past 6 months",
  pastedContent:
    "Sample exchange: I usually wait two days to reply because I overthink the right tone. She said it made her feel like a backup plan. I tried to explain, but it came out defensive.",
  consentGiven: true,
};

async function createInsight(userId: string): Promise<number> {
  testApp.setUser({ id: userId });
  const res = await request(testApp.app).post("/api/insights").send(VALID_BODY);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/insights", () => {
  it("returns 400 on invalid bodies", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights").send({ pastedContent: 42 });
    expect(res.status).toBe(400);
  });

  it("creates an insight row tied to the caller", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.sourceLabel).toBe(VALID_BODY.sourceLabel);
  });
});

describe("GET /api/insights", () => {
  it("returns a contract-shaped list", async () => {
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/insights");
    expect(res.status).toBe(200);
    expect(() => ListInsightsResponse.parse(res.body)).not.toThrow();
    const ids = res.body.map((i: { id: number }) => i.id);
    expect(ids).toContain(id);
  });
});

describe("POST /api/insights/:id/analyze", () => {
  it("returns analysis matching AnalyzeInsightResponse and marks complete", async () => {
    const id = await createInsight(USER_ID);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(() => AnalyzeInsightResponse.parse(res.body)).not.toThrow();
    expect(res.body.insightId).toBe(id);
    expect(Array.isArray(res.body.communicationPatterns)).toBe(true);
    expect(Array.isArray(res.body.datingProfileTips)).toBe(true);
    expect(res.body.summary.length).toBeGreaterThan(0);

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.status).toBe("complete");
  });

  it("returns 404 when not owned by the caller", async () => {
    const otherId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const id = await createInsight(otherId);
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric ids", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/insights/abc/analyze").send({});
    expect(res.status).toBe(400);
  });

  it("backfills sourceApp on the row when the engine detects one and the row didn't have it set", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "Hinge conversation export",
      pastedContent:
        "We matched on Hinge a few weeks back. Replies were short, mostly about her travel prompt. haha thanks for the chat.",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const { dumpTable } = await import("../lib/testDb");
    const beforeRow = dumpTable("email_insights").find((r) => r.id === id);
    expect(beforeRow?.sourceApp ?? null).toBeNull();

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBe("Hinge");

    const afterRow = dumpTable("email_insights").find((r) => r.id === id);
    expect(afterRow?.sourceApp).toBe("Hinge");
    expect(afterRow?.status).toBe("complete");
  });

  it("does not overwrite an existing sourceApp on the row", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "exported chat",
      pastedContent: "we matched on tinder and chatted",
      sourceApp: "Bumble",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBe("Bumble");

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.sourceApp).toBe("Bumble");
  });

  it("leaves sourceApp null on the row when the engine cannot detect a source", async () => {
    testApp.setUser({ id: USER_ID });
    const createRes = await request(testApp.app).post("/api/insights").send({
      sourceLabel: "untitled clipboard paste",
      pastedContent: "just some generic chatter about weekend plans and coffee",
      consentGiven: true,
    });
    expect(createRes.status).toBe(201);
    const id: number = createRes.body.id;

    const res = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sourceApp).toBeNull();

    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("email_insights").find((r) => r.id === id);
    expect(row?.sourceApp ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-import rollup
// ---------------------------------------------------------------------------

const ROLLUP_USER_ID = `test-rollup-user-${crypto.randomBytes(6).toString("hex")}`;

async function createAndAnalyzeInsight(
  userId: string,
  body: { sourceLabel: string; pastedContent: string; sourceApp?: string; consentGiven: boolean },
): Promise<number> {
  testApp.setUser({ id: userId });
  const create = await request(testApp.app).post("/api/insights").send(body);
  expect(create.status).toBe(201);
  const id: number = create.body.id;
  const analyze = await request(testApp.app).post(`/api/insights/${id}/analyze`).send({});
  expect(analyze.status).toBe(200);
  return id;
}

const HINGE_CONTENT =
  "Me: I really love talking to you, feel like we connect.\n" +
  "Them: Same here, I miss you when you're offline.\n" +
  "Me: I care so much about these conversations. I'm excited!\n" +
  "Them: I feel happy and love how honest you are. I'm sad when it ends.";

const IMESSAGE_CONTENT =
  "Me: haha that's wild lol\n" +
  "Them: lmao right jk jk\n" +
  "Me: haha totally kidding\n" +
  "Them: lol nice one lmao";

describe("DELETE /api/insights/:id", () => {
  it("deletes an insight owned by the current user and returns success", async () => {
    const userId = `test-delete-${crypto.randomBytes(4).toString("hex")}`;
    testApp.setUser({ id: userId });
    const create = await request(testApp.app).post("/api/insights").send(VALID_BODY);
    expect(create.status).toBe(201);
    const id: number = create.body.id;

    const res = await request(testApp.app).delete(`/api/insights/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedId).toBe(id);

    const list = await request(testApp.app).get("/api/insights");
    expect(list.body.find((i: { id: number }) => i.id === id)).toBeUndefined();
  });

  it("returns 400 for a non-numeric id", async () => {
    testApp.setUser({ id: "user-x" });
    const res = await request(testApp.app).delete("/api/insights/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when insight does not exist", async () => {
    testApp.setUser({ id: "user-x" });
    const res = await request(testApp.app).delete("/api/insights/999999");
    expect(res.status).toBe(404);
  });

  it("returns 404 when insight belongs to a different user", async () => {
    const ownerUser = `test-owner-${crypto.randomBytes(4).toString("hex")}`;
    const otherUser = `test-other-${crypto.randomBytes(4).toString("hex")}`;

    testApp.setUser({ id: ownerUser });
    const create = await request(testApp.app).post("/api/insights").send(VALID_BODY);
    expect(create.status).toBe(201);
    const id: number = create.body.id;

    testApp.setUser({ id: otherUser });
    const res = await request(testApp.app).delete(`/api/insights/${id}`);
    expect(res.status).toBe(404);
  });

  it("rollup updates after deletion (no longer counts deleted insight)", async () => {
    const userId = `test-rollup-delete-${crypto.randomBytes(4).toString("hex")}`;
    const id = await createAndAnalyzeInsight(userId, {
      sourceLabel: "Hinge chat",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });

    testApp.setUser({ id: userId });
    const before = await request(testApp.app).get("/api/insights/rollup");
    expect(before.body.totalAnalyzed).toBe(1);

    await request(testApp.app).delete(`/api/insights/${id}`);

    const after = await request(testApp.app).get("/api/insights/rollup");
    expect(after.body.totalAnalyzed).toBe(0);
    expect(after.body.sources).toHaveLength(0);
  });
});

describe("GET /api/insights/rollup", () => {
  it("returns an empty rollup when no insights have been analyzed", async () => {
    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);
    expect(res.body.totalAnalyzed).toBe(0);
    expect(res.body.sources).toEqual([]);
    expect(res.body.comparisons).toEqual([]);
  });

  it("returns a single-source rollup with no comparisons for 1 analyzed insight", async () => {
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge chat",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);
    expect(res.body.totalAnalyzed).toBe(1);
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0].sourceApp).toBe("Hinge");
    expect(res.body.sources[0].count).toBe(1);
    // Single-import summary must use the "One import from X." prefix.
    expect(res.body.sources[0].summary).toMatch(/^One import from Hinge\./);
    expect(res.body.comparisons).toEqual([]);
  });

  it("returns per-source tiles for two sources and fires warmth comparison", async () => {
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "iMessage export",
      pastedContent: IMESSAGE_CONTENT,
      sourceApp: "iMessage",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);

    expect(res.body.totalAnalyzed).toBe(2);
    expect(res.body.sources).toHaveLength(2);

    const sourceApps: string[] = res.body.sources.map((s: { sourceApp: string }) => s.sourceApp);
    expect(sourceApps).toContain("Hinge");
    expect(sourceApps).toContain("iMessage");

    expect(res.body.comparisons.length).toBeGreaterThan(0);
    const warmthCmp = res.body.comparisons.find((c: { trait: string }) => c.trait === "warmth");
    expect(warmthCmp).toBeDefined();
    expect(warmthCmp.leader).toBe("Hinge");
    expect(warmthCmp.laggard).toBe("iMessage");
    expect(warmthCmp.delta).toBeGreaterThanOrEqual(15);
    expect(warmthCmp.sentence).toMatch(/warmer on Hinge than on iMessage/i);
  });

  it("response matches GetInsightsRollupResponse schema for a two-source rollup", async () => {
    const { GetInsightsRollupResponse } = await import("@workspace/api-zod");

    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "iMessage export",
      pastedContent: IMESSAGE_CONTENT,
      sourceApp: "iMessage",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);
    expect(() => GetInsightsRollupResponse.parse(res.body)).not.toThrow();
  });

  it("folds two imports from the same source into one tile with averaged traits and correct signaturePattern", async () => {
    // Import 1: warmth-heavy Hinge conversation (emotional words, no humor)
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export — warmth heavy",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });
    // Import 2: humor-heavy Hinge conversation (humor words, no emotional)
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export — humor heavy",
      pastedContent: IMESSAGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);

    // Both imports share the same sourceApp so they must collapse into ONE tile
    expect(res.body.sources).toHaveLength(1);
    const tile = res.body.sources[0];
    expect(tile.sourceApp).toBe("Hinge");
    expect(tile.count).toBe(2);

    // Traits must be the average of the two individual score vectors:
    //   HINGE_CONTENT:   warmth=100, humor=0,   curiosity=0, verbosity=49
    //   IMESSAGE_CONTENT: warmth=0,  humor=100, curiosity=0, verbosity=20
    //   Average:          warmth=50, humor=50,  curiosity=0, verbosity=35
    expect(tile.traits.warmth).toBe(50);
    expect(tile.traits.humor).toBe(50);
    expect(tile.traits.curiosity).toBe(0);
    expect(tile.traits.verbosity).toBe(35);

    // Both imports produce short messages (wordCount < 80) so each analysis emits
    // "Concise messaging style" as its first pattern → count=2, wins the signaturePattern
    expect(tile.signaturePattern).toBe("Concise messaging style");

    // The multi-import summary sentence must mention the import count, the source
    // name, and the top pattern so that a typo or logic regression is caught.
    expect(tile.summary).toContain("2");
    expect(tile.summary).toContain("Hinge");
    expect(tile.summary).toContain("Concise messaging style");

    // Only one source → no cross-source comparisons
    expect(res.body.comparisons).toEqual([]);
    expect(res.body.totalAnalyzed).toBe(2);
  });

  it("sorts sources by import count and fires correct comparisons when one source has more imports", async () => {
    // Two Hinge imports (warmth-heavy + humor-heavy) → averaged traits
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export — warmth heavy",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "Hinge export — humor heavy",
      pastedContent: IMESSAGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });
    // One iMessage import (humor-heavy only) → un-averaged traits
    await createAndAnalyzeInsight(ROLLUP_USER_ID, {
      sourceLabel: "iMessage export",
      pastedContent: IMESSAGE_CONTENT,
      sourceApp: "iMessage",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);

    expect(res.body.totalAnalyzed).toBe(3);
    // Two distinct sources
    expect(res.body.sources).toHaveLength(2);

    // Hinge (count=2) must sort before iMessage (count=1)
    expect(res.body.sources[0].sourceApp).toBe("Hinge");
    expect(res.body.sources[0].count).toBe(2);
    expect(res.body.sources[1].sourceApp).toBe("iMessage");
    expect(res.body.sources[1].count).toBe(1);

    // Hinge averaged warmth=50; iMessage warmth=0 → delta=50 ≥ 15 → warmth comparison fires
    const warmthCmp = res.body.comparisons.find((c: { trait: string }) => c.trait === "warmth");
    expect(warmthCmp).toBeDefined();
    expect(warmthCmp.leader).toBe("Hinge");
    expect(warmthCmp.laggard).toBe("iMessage");
    expect(warmthCmp.delta).toBe(50);

    // iMessage humor=100; Hinge averaged humor=50 → delta=50 ≥ 15 → humor comparison fires
    const humorCmp = res.body.comparisons.find((c: { trait: string }) => c.trait === "humor");
    expect(humorCmp).toBeDefined();
    expect(humorCmp.leader).toBe("iMessage");
    expect(humorCmp.laggard).toBe("Hinge");
    expect(humorCmp.delta).toBe(50);
  });

  it("does not leak insights from a different user into the rollup", async () => {
    const otherUser = `other-rollup-${crypto.randomBytes(4).toString("hex")}`;
    await createAndAnalyzeInsight(otherUser, {
      sourceLabel: "Other user Hinge export",
      pastedContent: HINGE_CONTENT,
      sourceApp: "Hinge",
      consentGiven: true,
    });

    testApp.setUser({ id: ROLLUP_USER_ID });
    const res = await request(testApp.app).get("/api/insights/rollup");
    expect(res.status).toBe(200);
    expect(res.body.totalAnalyzed).toBe(0);
  });
});
