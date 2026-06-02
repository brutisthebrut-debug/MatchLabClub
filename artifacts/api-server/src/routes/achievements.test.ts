import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
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

// The route depends on matching internals (readiness, threshold, activity days)
// that pull in heavy DB machinery. We stub that module so this test isolates the
// route's own logic: auth gating, lane derivation, and board shaping. The real
// readiness math is covered by the matching/readiness tests.
const computeReadiness = vi.fn();
const readinessThreshold = vi.fn();
const loadActivityDays = vi.fn();
vi.mock("./matching", () => ({
  computeReadiness: (...args: unknown[]) => computeReadiness(...args),
  readinessThreshold: (...args: unknown[]) => readinessThreshold(...args),
  loadActivityDays: (...args: unknown[]) => loadActivityDays(...args),
  todayUtc: () => "2026-05-31",
}));

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const achievementsRouter = (await import("./achievements")).default;
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

  app.use("/api", achievementsRouter);
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
  computeReadiness.mockReset();
  readinessThreshold.mockReset();
  loadActivityDays.mockReset();
  readinessThreshold.mockResolvedValue(60);
  loadActivityDays.mockResolvedValue([]);
  computeReadiness.mockResolvedValue({
    score: 0,
    breakdown: {},
    weights: {},
  });
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

describe("GET /api/me/achievements", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/achievements");
    expect(res.status).toBe(401);
  });

  it("returns the full board for an authenticated caller", async () => {
    testApp.setUser({ id: "ach-user" });
    const res = await request(testApp.app).get("/api/me/achievements");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.achievements)).toBe(true);
    expect(res.body.totalCount).toBe(res.body.achievements.length);
    expect(res.body.totalCount).toBeGreaterThan(0);
    expect(res.body.unlockedCount).toBe(0);
  });

  it("derives lanesMapped and signal totals into real unlocks", async () => {
    const { recordJourneyEvent } = await import("../lib/journeyEvents");
    // Three signals fed and one tool completed, all-time, for this user.
    await recordJourneyEvent({ eventType: "signal_fed", userId: "lanes-user" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "lanes-user" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "lanes-user" });
    await recordJourneyEvent({
      eventType: "tool_completed",
      userId: "lanes-user",
    });
    // A different user's events must not leak into the totals.
    await recordJourneyEvent({ eventType: "signal_fed", userId: "other-user" });

    computeReadiness.mockResolvedValue({
      score: 30,
      breakdown: { wellness: 50, compass: 20, hingeImport: 0 },
      weights: {},
    });

    testApp.setUser({ id: "lanes-user" });
    const res = await request(testApp.app).get("/api/me/achievements");
    expect(res.status).toBe(200);

    const get = (id: string) =>
      res.body.achievements.find(
        (a: { id: string }) => a.id === id,
      ) as { unlocked: boolean; progress: number; target: number };

    // 3 signals fed -> first-signal unlocked, signal-10 at 3/10.
    expect(get("first-signal").unlocked).toBe(true);
    expect(get("signal-10").progress).toBe(3);
    // 2 lanes with coverage > 0 -> lanes-3 at 2/3, still locked.
    expect(get("lanes-3").progress).toBe(2);
    expect(get("lanes-3").unlocked).toBe(false);
    // readiness 30 -> ready-25 unlocked, match-ready (target 60) locked.
    expect(get("ready-25").unlocked).toBe(true);
    expect(get("match-ready").target).toBe(60);
    expect(get("match-ready").unlocked).toBe(false);
  });
});

describe("countUserJourneyTotals", () => {
  it("counts only the caller's signal_fed and tool_completed events", async () => {
    const { recordJourneyEvent, countUserJourneyTotals } = await import(
      "../lib/journeyEvents"
    );
    await recordJourneyEvent({ eventType: "signal_fed", userId: "totals-user" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "totals-user" });
    await recordJourneyEvent({
      eventType: "tool_completed",
      userId: "totals-user",
    });
    await recordJourneyEvent({ eventType: "visit", userId: "totals-user" });
    await recordJourneyEvent({ eventType: "signal_fed", userId: "someone-else" });

    const totals = await countUserJourneyTotals("totals-user");
    expect(totals.signalsFed).toBe(2);
    expect(totals.toolsCompleted).toBe(1);
  });

  it("returns zeros for an empty user id", async () => {
    const { countUserJourneyTotals } = await import("../lib/journeyEvents");
    expect(await countUserJourneyTotals("")).toEqual({
      signalsFed: 0,
      toolsCompleted: 0,
    });
  });

  it("counts all-time totals with no row cap for a high-activity user", async () => {
    const { recordJourneyEvent, countUserJourneyTotals } = await import(
      "../lib/journeyEvents"
    );
    // Well past any first-page row cap: the count must reflect every event, not
    // just an arbitrary first slice, or unlocks would silently stall.
    const SIGNALS = 5200;
    for (let i = 0; i < SIGNALS; i++) {
      await recordJourneyEvent({ eventType: "signal_fed", userId: "whale" });
    }
    await recordJourneyEvent({ eventType: "tool_completed", userId: "whale" });

    const totals = await countUserJourneyTotals("whale");
    expect(totals.signalsFed).toBe(SIGNALS);
    expect(totals.toolsCompleted).toBe(1);
  });
});
