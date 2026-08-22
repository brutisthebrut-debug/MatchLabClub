import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
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
  setUser: (id: string | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const importsRouter = (await import("./imports")).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  let userId: string | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) {
      req.user = {
        id: userId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
    }
    const noop = () => undefined;
    // @ts-expect-error test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", importsRouter);
  return { app, setUser: (id) => { userId = id; } };
}

let testApp: TestApp;
let snapshot: Map<string, Set<unknown>>;

beforeAll(async () => {
  testApp = await makeTestApp();
});

beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  snapshot = snapshotTestDb();
  testApp.setUser(null);
});

afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(snapshot);
});

async function insertSource(userId: string) {
  const { db, importedSourcesTable } = await import("../lib/testDb");
  const [row] = await db
    .insert(importedSourcesTable)
    .values({
      userId,
      source: "calendar-ics",
      status: "complete",
      parsedSummary: { counts: { events: 4 } },
    })
    .returning();
  return row!;
}

describe("PATCH /api/imports/:id/permissions", () => {
  it("keeps storage, Echo, confirmed learning, and matching independent", async () => {
    const row = await insertSource("permission-owner");
    testApp.setUser("permission-owner");

    const matching = await request(testApp.app)
      .patch(`/api/imports/${row.id}/permissions`)
      .send({ matchingUse: true });
    expect(matching.status).toBe(200);
    expect(matching.body.permissions).toEqual({
      storage: "saved",
      echoUse: false,
      learningConfirmed: false,
      matchingUse: true,
    });

    const learning = await request(testApp.app)
      .patch(`/api/imports/${row.id}/permissions`)
      .send({ learningConfirmed: true });
    expect(learning.status).toBe(200);
    expect(learning.body.permissions).toEqual({
      storage: "saved",
      echoUse: false,
      learningConfirmed: true,
      matchingUse: true,
    });

    const echo = await request(testApp.app)
      .patch(`/api/imports/${row.id}/permissions`)
      .send({ echoUse: true });
    expect(echo.status).toBe(200);
    expect(echo.body.permissions).toEqual({
      storage: "saved",
      echoUse: true,
      learningConfirmed: true,
      matchingUse: true,
    });
  });

  it("rejects an empty patch and does not expose another member's row", async () => {
    const row = await insertSource("permission-owner-two");
    testApp.setUser("permission-owner-two");
    const empty = await request(testApp.app)
      .patch(`/api/imports/${row.id}/permissions`)
      .send({});
    expect(empty.status).toBe(400);

    testApp.setUser("someone-else");
    const other = await request(testApp.app)
      .patch(`/api/imports/${row.id}/permissions`)
      .send({ matchingUse: true });
    expect(other.status).toBe(404);
  });
});
