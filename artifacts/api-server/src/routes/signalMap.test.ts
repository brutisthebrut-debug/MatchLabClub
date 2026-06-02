import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";

// The route depends on matching internals (readiness) that pull in heavy DB
// machinery. We stub that module so this test isolates the route's own logic:
// auth gating and map shaping. The real readiness math is covered by the
// matching/readiness tests, and the derivation by signalMap.test.ts.
const computeReadiness = vi.fn();
vi.mock("./matching", () => ({
  computeReadiness: (...args: unknown[]) => computeReadiness(...args),
}));

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const signalMapRouter = (await import("./signalMap")).default;
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

  app.use("/api", signalMapRouter);
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

beforeEach(() => {
  computeReadiness.mockReset();
  computeReadiness.mockResolvedValue({ score: 0, breakdown: {}, weights: {} });
});

describe("GET /api/me/signal-map", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/signal-map");
    expect(res.status).toBe(401);
  });

  it("returns the full lane map for an authenticated caller", async () => {
    computeReadiness.mockResolvedValue({
      score: 30,
      breakdown: { wellness: 80, compass: 40 },
      weights: {},
    });
    testApp.setUser({ id: "map-user" });

    const res = await request(testApp.app).get("/api/me/signal-map");
    expect(res.status).toBe(200);
    expect(res.body.densityPercent).toBe(30);
    expect(res.body.totalLanes).toBe(res.body.lanes.length);
    expect(res.body.lanesActive).toBe(2);
    const active = res.body.lanes
      .filter((l: { hasSignal: boolean }) => l.hasSignal)
      .map((l: { id: string }) => l.id);
    expect(active).toEqual(expect.arrayContaining(["wellness", "compass"]));
  });
});
