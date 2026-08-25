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
  const router = (await import("./datingWins")).default;
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

describe("dating win lifecycle", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).post("/api/me/dating-wins").send({ category: "personal-win", body: "Nope" })).status).toBe(401);
  });

  it("creates, edits, removes, and restores only the owner's durable win", async () => {
    testApp.setUser({ id: "wins-owner" });
    const created = await request(testApp.app).post("/api/me/dating-wins").send({ category: "personal-win", body: "I asked clearly." });
    expect(created.status).toBe(201);

    const updated = await request(testApp.app).patch(`/api/me/dating-wins/${created.body.id}`).send({ category: "sent-it", body: "I sent the clear message." });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ category: "sent-it", body: "I sent the clear message." });

    expect((await request(testApp.app).delete(`/api/me/dating-wins/${created.body.id}`)).status).toBe(204);
    expect((await request(testApp.app).get("/api/me/dating-wins")).body).toEqual([]);

    const restored = await request(testApp.app).post(`/api/me/dating-wins/${created.body.id}/restore`);
    expect(restored.status).toBe(200);
    expect((await request(testApp.app).get("/api/me/dating-wins")).body).toEqual([expect.objectContaining({ id: created.body.id })]);

    testApp.setUser({ id: "not-the-owner" });
    expect((await request(testApp.app).patch(`/api/me/dating-wins/${created.body.id}`).send({ category: "personal-win", body: "Takeover" })).status).toBe(404);
    expect((await request(testApp.app).delete(`/api/me/dating-wins/${created.body.id}`)).status).toBe(404);
  });

  it("rejects invalid categories and empty wins", async () => {
    testApp.setUser({ id: "wins-validation" });
    expect((await request(testApp.app).post("/api/me/dating-wins").send({ category: "fake", body: "Something" })).status).toBe(400);
    expect((await request(testApp.app).post("/api/me/dating-wins").send({ category: "personal-win", body: "" })).status).toBe(400);
  });
});
