import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, eq: fake.eq, and: fake.and, isNull: fake.isNull, isNotNull: fake.isNotNull, desc: fake.desc };
});

interface TestApp { app: Express; setUser: (user: { id: string } | null) => void }

async function makeTestApp(): Promise<TestApp> {
  const router = (await import("./journeyFollowUps")).default;
  const app = express();
  app.use(express.json());
  let currentUser: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) req.user = { id: currentUser.id, email: null, firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  app.use("/api", router);
  return { app, setUser: (user) => { currentUser = user; } };
}

let testApp: TestApp;
let dbSnapshot: Map<string, Set<unknown>>;
beforeAll(async () => { testApp = await makeTestApp(); });
beforeEach(async () => { dbSnapshot = (await import("../lib/testDb")).snapshotTestDb(); });
afterEach(async () => { (await import("../lib/testDb")).cleanupNewRows(dbSnapshot); });

describe("Journey follow-up lifecycle", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).get("/api/me/journey/follow-ups")).status).toBe(401);
  });

  it("creates, answers once, skips, removes, and restores an owner-linked follow-up", async () => {
    const { db, behavioralGrowthEventsTable, journalEntriesTable } = await import("../lib/testDb");
    testApp.setUser({ id: "follow-up-owner" });
    const [source] = await db.insert(journalEntriesTable).values({ userId: "follow-up-owner", prompt: "After the date", body: "It felt mutual.", tags: [], deletedAt: null, updatedAt: new Date() }).returning();
    const pending = { sourceType: "journal_entry", sourceId: source.id, sourceLabel: "Ignored client label", question: "What is clearer now?", status: "pending", answer: "" };
    const created = await request(testApp.app).post("/api/me/journey/follow-ups").send(pending);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ question: pending.question, status: "pending", source: { type: "journal_entry", id: source.id, label: "After the date" } });

    const answered = await request(testApp.app).patch(`/api/me/journey/follow-ups/${created.body.id}`).send({ ...pending, status: "answered", answer: "Consistency matters more than chemistry." });
    expect(answered.status).toBe(200);
    expect(answered.body.answeredAt).toEqual(expect.any(String));
    await request(testApp.app).patch(`/api/me/journey/follow-ups/${created.body.id}`).send({ ...pending, status: "skipped", answer: "" });
    await request(testApp.app).patch(`/api/me/journey/follow-ups/${created.body.id}`).send({ ...pending, status: "answered", answer: "Still true." });
    const events = (await db.select().from(behavioralGrowthEventsTable)).filter((row) => row.userId === "follow-up-owner" && row.type === "follow_up_logged");
    expect(events).toHaveLength(1);

    expect((await request(testApp.app).delete(`/api/me/journey/follow-ups/${created.body.id}`)).status).toBe(204);
    expect((await request(testApp.app).get("/api/me/journey/follow-ups")).body).toEqual([]);
    expect((await request(testApp.app).get("/api/me/journey/follow-ups?view=trash")).body).toEqual([expect.objectContaining({ id: created.body.id })]);
    expect((await request(testApp.app).post(`/api/me/journey/follow-ups/${created.body.id}/restore`)).status).toBe(200);
  });

  it("rejects unowned, removed, or invalid source records", async () => {
    const { db, journalEntriesTable } = await import("../lib/testDb");
    testApp.setUser({ id: "follow-up-owner-a" });
    const [other] = await db.insert(journalEntriesTable).values({ userId: "follow-up-owner-b", body: "Private", tags: [], deletedAt: null, updatedAt: new Date() }).returning();
    const response = await request(testApp.app).post("/api/me/journey/follow-ups").send({ sourceType: "journal_entry", sourceId: other.id, sourceLabel: "Private", question: "Leak?", status: "pending", answer: "" });
    expect(response.status).toBe(400);
    expect((await request(testApp.app).post("/api/me/journey/follow-ups").send({ sourceType: "journal_entry", sourceId: other.id, sourceLabel: "Private", question: "", status: "pending", answer: "" })).status).toBe(400);
  });
});
