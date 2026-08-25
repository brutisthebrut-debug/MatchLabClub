import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const journeyRouter = (await import("./journey")).default;
  const app = express();
  app.use(express.json());
  let currentUser: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      req.user = {
        id: currentUser.id,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
    }
    const noop = () => undefined;
    // @ts-expect-error test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", journeyRouter);
  return { app, setUser: (user) => { currentUser = user; } };
}

let testApp: TestApp;
let dbSnapshot: Map<string, Set<unknown>>;
beforeAll(async () => { testApp = await makeTestApp(); });
beforeEach(async () => {
  dbSnapshot = (await import("../lib/testDb")).snapshotTestDb();
});
afterEach(async () => {
  (await import("../lib/testDb")).cleanupNewRows(dbSnapshot);
});

describe("GET /api/me/journey/summary", () => {
  it("returns 401 for an anonymous caller and reads no events", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it("returns the signed-in caller's own derived weekly recap", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-me" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-me" });
    await recordJourneyEvent({ eventType: "tool_completed", userId: "recap-route-me", props: { tool: "coach" } });
    await recordJourneyEvent({ eventType: "readiness_gained", userId: "recap-route-me", props: { delta: 9 } });
    testApp.setUser({ id: "recap-route-me" });
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      signalsFedThisWeek: 2,
      toolsCompletedThisWeek: 1,
      readinessGainedThisWeek: 9,
      hasHistory: true,
    });
    expect(res.body).not.toHaveProperty("props");
    expect(res.body).not.toHaveProperty("events");
  });

  it("never leaks another user's events into the caller's recap", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-other" });
    await recordJourneyEvent({ eventType: "tool_completed", userId: "recap-route-other" });
    await recordJourneyEvent({ eventType: "readiness_gained", userId: "recap-route-other", props: { delta: 12 } });
    testApp.setUser({ id: "recap-route-isolated" });
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      signalsFedThisWeek: 0,
      toolsCompletedThisWeek: 0,
      readinessGainedThisWeek: 0,
      hasHistory: false,
    });
  });

  it("counts every event in the week with no row cap for a high-activity user", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    const count = 600;
    for (let i = 0; i < count; i++) {
      await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-heavy" });
    }
    testApp.setUser({ id: "recap-route-heavy" });
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(200);
    expect(res.body.signalsFedThisWeek).toBe(count);
    expect(res.body.hasHistory).toBe(true);
  });
});

describe("GET /api/me/journey/record", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).get("/api/me/journey/record")).status).toBe(401);
  });

  it("combines only the member's active reflections and date notes", async () => {
    const { db, datingWinsTable, journalEntriesTable, journeyExperimentsTable, postDateNotesTable } = await import("../lib/testDb");
    testApp.setUser({ id: "journey-owner" });
    await db.insert(journalEntriesTable).values([
      { userId: "journey-owner", prompt: "What changed?", body: "I named what I needed.", tags: ["reflection"], mood: 4, deletedAt: null, updatedAt: new Date() },
      { userId: "journey-owner", prompt: null, body: "Deleted thought", tags: [], mood: null, deletedAt: new Date(), updatedAt: new Date() },
      { userId: "somebody-else", prompt: null, body: "Private other-member entry", tags: [], mood: null, deletedAt: null, updatedAt: new Date() },
    ]);
    await db.insert(postDateNotesTable).values({
      userId: "journey-owner",
      personLabel: "Sam",
      summary: "Conversation felt mutual.",
      whatWentWell: "We stayed curious.",
      whatDidnt: "",
      followUpPlanned: true,
      outcome: "another_date",
      dateAt: null,
      deletedAt: null,
      updatedAt: new Date(),
    });
    await db.insert(datingWinsTable).values({ userId: "journey-owner", category: "personal-win", body: "I asked for what I wanted.", deletedAt: null, updatedAt: new Date() });
    await db.insert(datingWinsTable).values({ userId: "somebody-else", category: "personal-win", body: "Private other-member win", deletedAt: null, updatedAt: new Date() });
    await db.insert(journeyExperimentsTable).values({ userId: "journey-owner", title: "Leave room", description: "Stop at 80 percent.", status: "planned", result: "", deletedAt: null, updatedAt: new Date() });
    await db.insert(journeyExperimentsTable).values({ userId: "somebody-else", title: "Private experiment", description: "Not yours", status: "planned", result: "", deletedAt: null, updatedAt: new Date() });

    const response = await request(testApp.app).get("/api/me/journey/record");
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ total: 4, reflections: 1, dates: 1, wins: 1, experiments: 1 });
    expect(response.body.records.map((row: { kind: string }) => row.kind).sort()).toEqual(["date", "experiment", "reflection", "win"]);
    expect(JSON.stringify(response.body)).not.toContain("Deleted thought");
    expect(JSON.stringify(response.body)).not.toContain("Private other-member entry");
    expect(JSON.stringify(response.body)).not.toContain("Private other-member win");
    expect(JSON.stringify(response.body)).not.toContain("Private experiment");
    expect(response.body.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: { type: "journal_entry", id: expect.any(Number), label: "Journal" }, href: expect.stringMatching(/^\/journey\?reflection=/), details: expect.objectContaining({ prompt: "What changed?", mood: 4 }) }),
      expect.objectContaining({ title: "Date with Sam", href: expect.stringMatching(/^\/journey\?date=/), details: expect.objectContaining({ personLabel: "Sam", dateAt: null }) }),
      expect.objectContaining({ source: { type: "dating_win", id: expect.any(Number), label: "Win" }, href: expect.stringMatching(/^\/journey\?win=/), details: { category: "personal-win" } }),
      expect.objectContaining({ source: { type: "journey_experiment", id: expect.any(Number), label: "Experiment" }, href: expect.stringMatching(/^\/journey\?experiment=/), details: expect.objectContaining({ status: "planned" }) }),
    ]));
  });

  it("returns only the member's removed moments in the recoverable trash view", async () => {
    const { db, datingWinsTable, journalEntriesTable, journeyExperimentsTable, postDateNotesTable } = await import("../lib/testDb");
    testApp.setUser({ id: "journey-trash-owner" });
    await db.insert(journalEntriesTable).values([
      { userId: "journey-trash-owner", prompt: "Keep", body: "Active thought", tags: [], deletedAt: null, updatedAt: new Date() },
      { userId: "journey-trash-owner", prompt: "Restore", body: "Removed thought", tags: [], deletedAt: new Date(), updatedAt: new Date() },
      { userId: "another-owner", prompt: "Private", body: "Other removed thought", tags: [], deletedAt: new Date(), updatedAt: new Date() },
    ]);
    await db.insert(postDateNotesTable).values({ userId: "journey-trash-owner", summary: "Removed date", whatWentWell: "", whatDidnt: "", deletedAt: new Date(), updatedAt: new Date() });
    await db.insert(datingWinsTable).values({ userId: "journey-trash-owner", category: "great-convo", body: "Removed win", deletedAt: new Date(), updatedAt: new Date() });
    await db.insert(journeyExperimentsTable).values({ userId: "journey-trash-owner", title: "Removed experiment", description: "Try it", status: "tried", result: "Learned", deletedAt: new Date(), updatedAt: new Date() });

    const response = await request(testApp.app).get("/api/me/journey/record?view=trash");
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ total: 4, reflections: 1, dates: 1, wins: 1, experiments: 1 });
    expect(JSON.stringify(response.body)).toContain("Removed thought");
    expect(JSON.stringify(response.body)).toContain("Removed date");
    expect(JSON.stringify(response.body)).toContain("Removed win");
    expect(JSON.stringify(response.body)).toContain("Removed experiment");
    expect(JSON.stringify(response.body)).not.toContain("Active thought");
    expect(JSON.stringify(response.body)).not.toContain("Other removed thought");
  });

  it("rejects unknown Journey views", async () => {
    testApp.setUser({ id: "journey-owner" });
    expect((await request(testApp.app).get("/api/me/journey/record?view=everything")).status).toBe(400);
  });
});
