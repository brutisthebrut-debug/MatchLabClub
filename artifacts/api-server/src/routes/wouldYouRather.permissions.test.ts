import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, and: fake.and, desc: fake.desc, eq: fake.eq };
});

interface TestApp { app: Express; setUser: (id: string | null) => void }

async function makeTestApp(): Promise<TestApp> {
  const router = (await import("./wouldYouRather")).default;
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

describe("Would You Rather permission boundary", () => {
  it("stores new answers with every downstream permission closed", async () => {
    testApp.setUser("wyr-owner");
    const created = await request(testApp.app).post("/api/me/would-you-rather").send({ promptId: "pace", choice: "a" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      promptId: "pace",
      choice: "a",
      echoUseAllowed: false,
      learningConfirmed: false,
      matchingUseAllowed: false,
    });
  });

  it("updates the three permissions independently without changing the answer", async () => {
    testApp.setUser("wyr-owner");
    await request(testApp.app).post("/api/me/would-you-rather").send({ promptId: "repair", choice: "b" });
    const updated = await request(testApp.app)
      .patch("/api/me/would-you-rather/repair/permissions")
      .send({ learningConfirmed: true, matchingUse: true });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      promptId: "repair",
      choice: "b",
      echoUseAllowed: false,
      learningConfirmed: true,
      matchingUseAllowed: true,
    });
  });

  it("cannot update another member's answer", async () => {
    testApp.setUser("wyr-owner");
    await request(testApp.app).post("/api/me/would-you-rather").send({ promptId: "private", choice: "a" });
    testApp.setUser("wyr-other");
    const response = await request(testApp.app)
      .patch("/api/me/would-you-rather/private/permissions")
      .send({ matchingUse: true });
    expect(response.status).toBe(404);
  });
});
