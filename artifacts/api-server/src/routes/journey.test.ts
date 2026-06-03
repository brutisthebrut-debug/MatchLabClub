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
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });

  app.use("/api", journeyRouter);

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

let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
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
    await recordJourneyEvent({
      eventType: "tool_completed",
      userId: "recap-route-me",
      props: { tool: "coach" },
    });
    await recordJourneyEvent({
      eventType: "readiness_gained",
      userId: "recap-route-me",
      props: { delta: 9 },
    });

    testApp.setUser({ id: "recap-route-me" });
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      signalsFedThisWeek: 2,
      toolsCompletedThisWeek: 1,
      readinessGainedThisWeek: 9,
      hasHistory: true,
    });
    // Derived counts only: no raw event props ever leave the endpoint.
    expect(res.body).not.toHaveProperty("props");
    expect(res.body).not.toHaveProperty("events");
  });

  it("never leaks another user's events into the caller's recap", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    // Other user is busy, caller has done nothing.
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-other" });
    await recordJourneyEvent({ eventType: "tool_completed", userId: "recap-route-other" });
    await recordJourneyEvent({
      eventType: "readiness_gained",
      userId: "recap-route-other",
      props: { delta: 12 },
    });

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
    const COUNT = 600; // exceeds the old 500-row cap that silently undercounted
    for (let i = 0; i < COUNT; i++) {
      await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-route-heavy" });
    }

    testApp.setUser({ id: "recap-route-heavy" });
    const res = await request(testApp.app).get("/api/me/journey/summary");
    expect(res.status).toBe(200);
    expect(res.body.signalsFedThisWeek).toBe(COUNT);
    expect(res.body.hasHistory).toBe(true);
  });
});
