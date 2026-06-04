import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

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

import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const cosmicRouter = (await import("./cosmic")).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  let currentUser: { id: string } | null = null;

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      const user: AuthUser = {
        id: currentUser.id,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
      req.user = user;
    }
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });

  app.use("/api", cosmicRouter);

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

const USER_A = `test-cosmic-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-cosmic-user-b-${crypto.randomBytes(6).toString("hex")}`;

const FULL = {
  birthDate: "1990-07-15",
  birthTime: "14:30",
  birthPlace: "New York, NY",
  birthLat: 40.7128,
  birthLng: -74.006,
};

const SUN_ONLY = {
  birthDate: "1988-03-02",
  birthTime: null,
  birthPlace: "London, UK",
  birthLat: 51.5072,
  birthLng: -0.1276,
};

describe("POST /api/me/cosmic", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/me/cosmic").send(FULL);
    expect(res.status).toBe(401);
  });

  it("rejects invalid bodies with 400", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/cosmic")
      .send({ birthDate: "1990-07-15" });
    expect(res.status).toBe(400);
  });

  it("computes and stores a full chart for the authenticated user", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/cosmic").send(FULL);
    expect(res.status).toBe(201);
    expect(res.body.placements.mode).toBe("full");
    expect(typeof res.body.placements.sun.sign).toBe("string");
    expect(res.body.placements.rising).not.toBeNull();
    expect(res.body.reaction).toBeNull();
    expect(res.body.reading.source).toBe("deterministic");
    expect(Array.isArray(res.body.reading.lines)).toBe(true);
  });

  it("falls back to a sun-only chart when birth time is unknown", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/cosmic").send(SUN_ONLY);
    expect(res.status).toBe(201);
    expect(res.body.placements.mode).toBe("sunOnly");
    expect(res.body.placements.rising).toBeNull();
    expect(typeof res.body.placements.sun.sign).toBe("string");
  });

  it("replaces the chart in place on a second save (one birth moment per person)", async () => {
    testApp.setUser({ id: USER_B });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const second = await request(testApp.app).post("/api/me/cosmic").send(SUN_ONLY);
    expect(second.status).toBe(201);

    const list = await request(testApp.app).get("/api/me/cosmic");
    expect(list.status).toBe(200);
    expect(list.body.birthPlace).toBe(SUN_ONLY.birthPlace);
    expect(list.body.placements.mode).toBe("sunOnly");
  });
});

describe("GET /api/me/cosmic", () => {
  it("returns 401 for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/cosmic");
    expect(res.status).toBe(401);
  });

  it("returns 404 before a chart is saved", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/cosmic");
    expect(res.status).toBe(404);
  });

  it("returns only the requesting user's chart", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);

    testApp.setUser({ id: USER_B });
    await request(testApp.app).post("/api/me/cosmic").send(SUN_ONLY);

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/cosmic");
    expect(res.status).toBe(200);
    expect(res.body.birthPlace).toBe(FULL.birthPlace);
  });
});

describe("POST /api/me/cosmic/reaction", () => {
  it("rejects an invalid reaction value with 400", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const res = await request(testApp.app)
      .post("/api/me/cosmic/reaction")
      .send({ reaction: "definitely" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when reacting before a chart exists", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app)
      .post("/api/me/cosmic/reaction")
      .send({ reaction: "resonant" });
    expect(res.status).toBe(404);
  });

  it("stores a valid reaction on the user's chart", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const res = await request(testApp.app)
      .post("/api/me/cosmic/reaction")
      .send({ reaction: "resonant" });
    expect(res.status).toBe(200);
    expect(res.body.reaction).toBe("resonant");
  });
});

describe("POST /api/me/cosmic/reading", () => {
  it("returns the deterministic reading once a chart exists", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const res = await request(testApp.app).post("/api/me/cosmic/reading").send({});
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("deterministic");
    expect(res.body.deep).toBeNull();
    expect(typeof res.body.headline).toBe("string");
    expect(Array.isArray(res.body.lines)).toBe(true);
  });

  it("returns 404 before a chart is saved", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app).post("/api/me/cosmic/reading").send({});
    expect(res.status).toBe(404);
  });
});

describe("GET /api/me/cosmic/lines", () => {
  it("returns 401 for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/cosmic/lines");
    expect(res.status).toBe(401);
  });

  it("returns 404 before a chart is saved", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app).get("/api/me/cosmic/lines");
    expect(res.status).toBe(404);
  });

  it("returns full astrocartography lines for a chart with a birth time", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const res = await request(testApp.app).get("/api/me/cosmic/lines");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("full");
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.loveLineCities)).toBe(true);
    expect(res.body.relocationOpen).toBe(false);
  });

  it("reports sun-only mode with no lines when birth time is unknown", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(SUN_ONLY);
    const res = await request(testApp.app).get("/api/me/cosmic/lines");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("sunOnly");
    expect(res.body.lines).toEqual([]);
    expect(res.body.loveLineCities).toEqual([]);
  });
});

describe("POST /api/me/cosmic/relocation", () => {
  it("returns 401 for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/cosmic/relocation")
      .send({ open: true });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body with 400", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);
    const res = await request(testApp.app)
      .post("/api/me/cosmic/relocation")
      .send({ open: "yes" });
    expect(res.status).toBe(400);
  });

  it("returns 404 before a chart exists", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app)
      .post("/api/me/cosmic/relocation")
      .send({ open: true });
    expect(res.status).toBe(404);
  });

  it("toggles relocation openness and is reflected on the lines endpoint", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/cosmic").send(FULL);

    const on = await request(testApp.app)
      .post("/api/me/cosmic/relocation")
      .send({ open: true });
    expect(on.status).toBe(200);
    expect(on.body.relocationOpen).toBe(true);

    const lines = await request(testApp.app).get("/api/me/cosmic/lines");
    expect(lines.body.relocationOpen).toBe(true);

    const off = await request(testApp.app)
      .post("/api/me/cosmic/relocation")
      .send({ open: false });
    expect(off.status).toBe(200);
    expect(off.body.relocationOpen).toBe(false);
  });
});

describe("GET /api/me/cosmic/weather", () => {
  it("returns 401 for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/cosmic/weather");
    expect(res.status).toBe(401);
  });

  it("returns 404 before a chart is saved", async () => {
    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app).get("/api/me/cosmic/weather");
    expect(res.status).toBe(404);
  });

  // The happy path drives computeReadiness, which needs the full readiness
  // graph and is exercised against a real database in cosmic.weather.test.ts.
});
