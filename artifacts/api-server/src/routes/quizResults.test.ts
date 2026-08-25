import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, eq: fake.eq, and: fake.and, isNull: fake.isNull, desc: fake.desc, sql: fake.sql };
});
vi.mock("../lib/anonClaimToken", () => ({ getOrCreateAnonClaimToken: () => "anon-test" }));

interface TestApp { app: Express; setUser: (id: string | null) => void }

async function makeTestApp(): Promise<TestApp> {
  const router = (await import("./meImports")).default;
  const app = express();
  app.use(express.json());
  let userId: string | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) req.user = { id: userId, email: null, firstName: null, lastName: null, profileImageUrl: null };
    const noop = () => undefined;
    // @ts-expect-error test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", router);
  return { app, setUser: (id) => { userId = id; } };
}

let testApp: TestApp;
let dbSnapshot: Map<string, Set<unknown>>;
beforeAll(async () => { testApp = await makeTestApp(); });
beforeEach(async () => { dbSnapshot = (await import("../lib/testDb")).snapshotTestDb(); });
afterEach(async () => { (await import("../lib/testDb")).cleanupNewRows(dbSnapshot); });

describe("GET /api/me/quiz-results", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).get("/api/me/quiz-results")).status).toBe(401);
  });

  it("returns only live derived quiz results owned by the member", async () => {
    const { db, importedSourcesTable } = await import("../lib/testDb");
    await db.insert(importedSourcesTable).values([
      { userId: "quiz-history-owner", source: "quiz", parsedSummary: { slug: "love-pace", archetypeKey: "steady", archetype: "Steady", dimensions: ["intimacy.pace"] }, learningConfirmed: true, echoUseAllowed: false, matchingUseAllowed: false, deletedAt: null },
      { userId: "quiz-history-owner", source: "quiz", parsedSummary: { slug: "conflict-instinct", archetypeKey: "repairer", archetype: "Repairer", dimensions: ["conflict.repair"] }, learningConfirmed: false, deletedAt: new Date() },
      { userId: "somebody-else", source: "quiz", parsedSummary: { slug: "private", archetypeKey: "private", archetype: "Private", dimensions: [] }, deletedAt: null },
      { userId: "quiz-history-owner", source: "hinge", parsedSummary: { slug: "not-a-quiz", archetypeKey: "x", archetype: "X" }, deletedAt: null },
    ]);
    testApp.setUser("quiz-history-owner");
    const response = await request(testApp.app).get("/api/me/quiz-results");
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([expect.objectContaining({ slug: "love-pace", archetypeName: "Steady", learningConfirmed: true, dimensions: ["intimacy.pace"], takenAt: expect.any(String) })]);
    expect(JSON.stringify(response.body)).not.toContain("Private");
    expect(JSON.stringify(response.body)).not.toContain("not-a-quiz");
  });
});
