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
  const eventsRouter = (await import("./events")).default;
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

  app.use("/api", eventsRouter);

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

describe("POST /api/events", () => {
  it("records a visit for an anonymous caller and returns 202", async () => {
    const { dumpTable } = await import("../lib/testDb");
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/events")
      .send({ eventType: "visit", anonId: "anon-123", props: { path: "/pricing" } });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);

    const rows = dumpTable("journey_events");
    const mine = rows.filter((r) => r.anonId === "anon-123");
    expect(mine).toHaveLength(1);
    expect(mine[0].eventType).toBe("visit");
    expect(mine[0].userId).toBeNull();
    expect(mine[0].props).toMatchObject({ path: "/pricing" });
  });

  it("attributes the event to the session user when authenticated", async () => {
    const { dumpTable } = await import("../lib/testDb");
    testApp.setUser({ id: "user-xyz" });
    const res = await request(testApp.app)
      .post("/api/events")
      .send({ eventType: "tool_completed", props: { tool: "signal-audit" } });
    expect(res.status).toBe(202);

    const mine = dumpTable("journey_events").filter((r) => r.userId === "user-xyz");
    expect(mine).toHaveLength(1);
    expect(mine[0].eventType).toBe("tool_completed");
  });

  it("rejects a non-client event type as a no-op 202 and records nothing", async () => {
    const { dumpTable } = await import("../lib/testDb");
    testApp.setUser(null);
    const before = dumpTable("journey_events").length;
    const res = await request(testApp.app)
      .post("/api/events")
      .send({ eventType: "purchase", anonId: "anon-evil" });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(false);
    expect(dumpTable("journey_events").length).toBe(before);
  });

  it("rejects a malformed body as a no-op 202", async () => {
    const { dumpTable } = await import("../lib/testDb");
    const before = dumpTable("journey_events").length;
    const res = await request(testApp.app).post("/api/events").send({ nope: true });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(false);
    expect(dumpTable("journey_events").length).toBe(before);
  });
});

describe("recordJourneyEvent", () => {
  it("never throws on an unknown event type and records nothing", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    const { dumpTable } = await import("../lib/testDb");
    const before = dumpTable("journey_events").length;
    await expect(
      // @ts-expect-error — intentionally passing an invalid type
      recordJourneyEvent({ eventType: "not_a_real_type", anonId: "x" }),
    ).resolves.toBeUndefined();
    expect(dumpTable("journey_events").length).toBe(before);
  });

  it("records a server-side signal_fed event", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    const { dumpTable } = await import("../lib/testDb");
    await recordJourneyEvent({
      eventType: "signal_fed",
      userId: "srv-user",
      props: { source: "quiz" },
    });
    const mine = dumpTable("journey_events").filter((r) => r.userId === "srv-user");
    expect(mine).toHaveLength(1);
    expect(mine[0].eventType).toBe("signal_fed");
  });
});

describe("summarizeJourneyEvents", () => {
  it("returns every event type in counts and a recent feed of inserted events", async () => {
    const { recordJourneyEvent, summarizeJourneyEvents } = await import("../lib/journeyEvents");
    await recordJourneyEvent({ eventType: "visit", anonId: "feed-anon" });
    await recordJourneyEvent({ eventType: "readiness_gained", userId: "feed-user", props: { score: 60 } });

    const summary = await summarizeJourneyEvents(50);

    const types = summary.counts.map((c) => c.eventType).sort();
    expect(types).toEqual(
      ["match_step", "purchase", "readiness_gained", "signal_fed", "tool_completed", "visit"].sort(),
    );
    expect(summary.totals).toHaveProperty("today");
    expect(summary.totals).toHaveProperty("last7d");
    expect(summary.totals).toHaveProperty("last30d");

    const feedTypes = summary.recent.map((e) => e.eventType);
    expect(feedTypes).toContain("visit");
    expect(feedTypes).toContain("readiness_gained");
  });
});

describe("summarizeUserJourney", () => {
  it("counts only the caller's own events within the last seven days", async () => {
    const { recordJourneyEvent, summarizeUserJourney } = await import(
      "../lib/journeyEvents"
    );
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-me" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-me" });
    await recordJourneyEvent({
      eventType: "tool_completed",
      userId: "recap-me",
      props: { tool: "coach" },
    });
    await recordJourneyEvent({
      eventType: "readiness_gained",
      userId: "recap-me",
      props: { delta: 7 },
    });
    await recordJourneyEvent({
      eventType: "readiness_gained",
      userId: "recap-me",
      props: { delta: 4 },
    });
    // Another user's activity must never leak into the caller's recap.
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-other" });

    const summary = await summarizeUserJourney("recap-me");
    expect(summary.signalsFedThisWeek).toBe(2);
    expect(summary.toolsCompletedThisWeek).toBe(1);
    expect(summary.readinessGainedThisWeek).toBe(11);
    expect(summary.hasHistory).toBe(true);
  });

  it("excludes events older than the window but still reports history", async () => {
    const { recordJourneyEvent, summarizeUserJourney } = await import(
      "../lib/journeyEvents"
    );
    await recordJourneyEvent({ eventType: "signal_fed", userId: "recap-old" });

    // Evaluate the window from eight days in the future, so the just-inserted
    // event falls outside the seven-day cutoff.
    const future = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const summary = await summarizeUserJourney("recap-old", future);
    expect(summary.signalsFedThisWeek).toBe(0);
    expect(summary.readinessGainedThisWeek).toBe(0);
    expect(summary.hasHistory).toBe(true);
  });

  it("returns an empty summary for a user with no events", async () => {
    const { summarizeUserJourney } = await import("../lib/journeyEvents");
    const summary = await summarizeUserJourney("recap-nobody");
    expect(summary).toEqual({
      signalsFedThisWeek: 0,
      readinessGainedThisWeek: 0,
      toolsCompletedThisWeek: 0,
      hasHistory: false,
    });
  });
});
