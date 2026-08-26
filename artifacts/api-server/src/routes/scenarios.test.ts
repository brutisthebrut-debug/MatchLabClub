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
  const scenariosRouter = (await import("./scenarios")).default;
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

  app.use("/api", scenariosRouter);

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

const USER_A = `test-scenario-user-a-${crypto.randomBytes(6).toString("hex")}`;
const USER_B = `test-scenario-user-b-${crypto.randomBytes(6).toString("hex")}`;

describe("POST /api/me/scenarios", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q1", optionId: "a" });
    expect(res.status).toBe(401);
  });

  it("rejects invalid bodies with 400", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "" });
    expect(res.status).toBe(400);
  });

  it("records an answer scoped to the authenticated user", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q1", optionId: "playful" });
    expect(res.status).toBe(201);
    expect(res.body.scenarioId).toBe("q1");
    expect(res.body.optionId).toBe("playful");
    expect(res.body.echoUseAllowed).toBe(false);
    expect(res.body.learningConfirmed).toBe(false);
    expect(res.body.matchingUseAllowed).toBe(false);
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("answering the same question again updates the optionId in place (deduped)", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q-dedupe", optionId: "first" });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q-dedupe", optionId: "second" });

    const res = await request(testApp.app).get("/api/me/scenarios");
    expect(res.status).toBe(200);
    const forQuestion = res.body.filter(
      (r: { scenarioId: string }) => r.scenarioId === "q-dedupe",
    );
    expect(forQuestion).toHaveLength(1);
    expect(forQuestion[0].optionId).toBe("second");
  });
});

describe("GET /api/me/scenarios", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/scenarios");
    expect(res.status).toBe(401);
  });

  it("only returns answers owned by the requesting user", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "qa", optionId: "a" });

    testApp.setUser({ id: USER_B });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "qb", optionId: "b" });

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get("/api/me/scenarios");
    expect(res.status).toBe(200);
    for (const r of res.body) {
      expect(r.scenarioId).not.toBe("qb");
    }
    expect(res.body.some((r: { scenarioId: string }) => r.scenarioId === "qa")).toBe(true);
  });
});


describe("PATCH /api/me/scenarios/:scenarioId/permissions", () => {
  it("rejects unauthenticated callers with 401", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .patch("/api/me/scenarios/q1/permissions")
      .send({ matchingUse: true });
    expect(res.status).toBe(401);
  });

  it("requires at least one explicit permission change", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q-empty-patch", optionId: "a" });

    const res = await request(testApp.app)
      .patch("/api/me/scenarios/q-empty-patch/permissions")
      .send({});
    expect(res.status).toBe(400);
  });

  it("updates independent permissions without changing the saved answer", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q-permissions", optionId: "curious" });

    const res = await request(testApp.app)
      .patch("/api/me/scenarios/q-permissions/permissions")
      .send({ learningConfirmed: true, matchingUse: true });
    expect(res.status).toBe(200);
    expect(res.body.optionId).toBe("curious");
    expect(res.body.echoUseAllowed).toBe(false);
    expect(res.body.learningConfirmed).toBe(true);
    expect(res.body.matchingUseAllowed).toBe(true);
  });

  it("does not let another member update an owned answer", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/scenarios")
      .send({ scenarioId: "q-owned", optionId: "a" });

    testApp.setUser({ id: USER_B });
    const res = await request(testApp.app)
      .patch("/api/me/scenarios/q-owned/permissions")
      .send({ matchingUse: true });
    expect(res.status).toBe(404);
  });
});
