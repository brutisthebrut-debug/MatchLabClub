import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import type { AuthUser } from "@workspace/api-zod";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, eq: fake.eq, and: fake.and, desc: fake.desc };
});

async function makeApp(): Promise<{ app: Express; setUser: (id: string | null) => void }> {
  const router = (await import("./communication")).default;
  const app = express();
  app.use(express.json());
  let id: string | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (id) req.user = { id, email: null, firstName: null, lastName: null, profileImageUrl: null } satisfies AuthUser;
    const noop = () => undefined;
    // @ts-expect-error test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", router);
  return { app, setUser: (next) => { id = next; } };
}

const style = {
  input: { answers: [0, 1, 2, 3, 0, 1] },
  result: {
    styleKey: "secureBuilder",
    name: "Secure Builder",
    tagline: "You move toward connection with steady interest and room to learn.",
    strengths: ["Clear communication", "Comfort with uncertainty"],
    activationPattern: "You invest steadily when interest is mutual and visible.",
    whatHelps: "Keep checking that effort and curiosity move in both directions.",
    nextExperiment: "Create one pause and notice whether the other person moves toward you.",
  },
  generatedBy: "deterministic",
  confidence: 100,
};

let testApp: Awaited<ReturnType<typeof makeApp>>;
let snapshot: Map<string, Set<unknown>>;
beforeAll(async () => { testApp = await makeApp(); });
beforeEach(async () => { snapshot = (await import("../lib/testDb")).snapshotTestDb(); });
afterEach(async () => { (await import("../lib/testDb")).cleanupNewRows(snapshot); });

describe("saved Communication records", () => {
  it("requires authentication for reads and writes", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).get("/api/me/communication")).status).toBe(401);
    expect((await request(testApp.app).put("/api/me/communication/connection_style").send(style)).status).toBe(401);
  });

  it("validates, saves, updates, and owner-scopes a full lens result", async () => {
    testApp.setUser("communication-a");
    const saved = await request(testApp.app).put("/api/me/communication/connection_style").send(style);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ lens: "connection_style", confidence: 100, result: { name: "Secure Builder" } });

    const invalid = await request(testApp.app).put("/api/me/communication/connection_style").send({ ...style, input: { answers: [9] } });
    expect(invalid.status).toBe(400);

    testApp.setUser("communication-b");
    expect((await request(testApp.app).get("/api/me/communication")).body.records).toEqual([]);
  });

  it("removes the derived learning and pauses candidacy when its source is deleted", async () => {
    const { db, matchPoolMembershipTable, mirrorLearningsTable } = await import("../lib/testDb");
    testApp.setUser("communication-delete");
    await request(testApp.app).put("/api/me/communication/connection_style").send(style);
    await db.insert(matchPoolMembershipTable).values({ userId: "communication-delete", status: "ready" });
    await db.insert(mirrorLearningsTable).values({
      userId: "communication-delete", sourceType: "relationship_language", sourceRef: "connection-style",
      sourceLabel: "Connection Style", observation: "Observed", proposedLearning: "Proposed",
      status: "confirmed", confidence: 100, matchingUseApproved: true,
    });
    const response = await request(testApp.app).delete("/api/me/communication/connection_style");
    expect(response.body.deleted).toBe(true);
    expect(await db.select().from(mirrorLearningsTable)).toEqual([]);
    expect((await db.select().from(matchPoolMembershipTable))[0]).toMatchObject({
      status: "paused", pausedReason: "A matching-approved Communication source was removed.",
    });
  });
});
