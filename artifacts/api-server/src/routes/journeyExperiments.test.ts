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
  const router = (await import("./journeyExperiments")).default;
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

describe("Journey experiment lifecycle", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).post("/api/me/journey/experiments").send({ title: "Try", description: "", status: "planned", result: "" })).status).toBe(401);
  });

  it("creates, updates, soft-removes, and restores the owner's experiment", async () => {
    testApp.setUser({ id: "experiment-owner" });
    const created = await request(testApp.app).post("/api/me/journey/experiments").send({ title: "Leave more room", description: "Stop at 80 percent.", status: "planned", result: "" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: "Leave more room", status: "planned", triedAt: null });

    const updated = await request(testApp.app).patch(`/api/me/journey/experiments/${created.body.id}`).send({ title: "Leave more room", description: "Stop at 80 percent.", status: "tried", result: "They asked a follow-up." });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ status: "tried", result: "They asked a follow-up." });
    expect(updated.body.triedAt).toEqual(expect.any(String));

    expect((await request(testApp.app).delete(`/api/me/journey/experiments/${created.body.id}`)).status).toBe(204);
    expect((await request(testApp.app).get("/api/me/journey/experiments")).body).toEqual([]);
    expect((await request(testApp.app).get("/api/me/journey/experiments?view=trash")).body).toEqual([expect.objectContaining({ id: created.body.id })]);
    expect((await request(testApp.app).post(`/api/me/journey/experiments/${created.body.id}/restore`)).status).toBe(200);

    testApp.setUser({ id: "not-the-owner" });
    expect((await request(testApp.app).patch(`/api/me/journey/experiments/${created.body.id}`).send({ title: "Takeover", description: "", status: "planned", result: "" })).status).toBe(404);
    expect((await request(testApp.app).delete(`/api/me/journey/experiments/${created.body.id}`)).status).toBe(404);
  });

  it("records readiness exactly once when a plan is first tried", async () => {
    const { db, behavioralGrowthEventsTable } = await import("../lib/testDb");
    testApp.setUser({ id: "experiment-readiness" });
    const created = await request(testApp.app).post("/api/me/journey/experiments").send({ title: "Ask directly", description: "", status: "planned", result: "" });
    await request(testApp.app).patch(`/api/me/journey/experiments/${created.body.id}`).send({ title: "Ask directly", description: "", status: "tried", result: "Clearer" });
    await request(testApp.app).patch(`/api/me/journey/experiments/${created.body.id}`).send({ title: "Ask directly", description: "", status: "helped", result: "Still clearer" });
    const events = (await db.select().from(behavioralGrowthEventsTable)).filter((row) => row.userId === "experiment-readiness");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "experiment_tried" });
  });

  it("validates content and views", async () => {
    testApp.setUser({ id: "experiment-validation" });
    expect((await request(testApp.app).post("/api/me/journey/experiments").send({ title: "", description: "", status: "planned", result: "" })).status).toBe(400);
    expect((await request(testApp.app).get("/api/me/journey/experiments?view=everything")).status).toBe(400);
  });
});
