import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { eq } from "../lib/testDb";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return {
    ...actual,
    eq: fake.eq,
    ne: fake.ne,
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
  const trustLedgerRouter = (await import("./trustLedger")).default;
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

  app.use("/api", trustLedgerRouter);

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

describe("trust ledger boot guard", () => {
  it("registers a purge handler for every first-party signal source", async () => {
    // Importing the module runs the boot-time guard that throws if any
    // first-party SIGNAL_REGISTRY lane lacks a purge handler. A new lane added
    // without a handler crashes the real server at start (the unit suite would
    // otherwise stay green), so importing it here keeps that failure in CI.
    await expect(import("./trustLedger")).resolves.toBeDefined();
  });
});

describe("DELETE /api/me/trust-ledger/:id", () => {
  it("returns 401 for an anonymous caller and deletes nothing", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).delete("/api/me/trust-ledger/wyr");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 for an unknown signal source id", async () => {
    testApp.setUser({ id: "ledger-unknown" });
    const res = await request(testApp.app).delete("/api/me/trust-ledger/not-a-real-source");
    expect(res.status).toBe(404);
  });

  it("purges only the caller's would-you-rather answers", async () => {
    const { db, wyrAnswersTable } = await import("../lib/testDb");
    await db.insert(wyrAnswersTable).values([
      { userId: "ledger-wyr-me", promptId: "p1", choice: "a" },
      { userId: "ledger-wyr-me", promptId: "p2", choice: "b" },
      { userId: "ledger-wyr-other", promptId: "p1", choice: "a" },
    ]);

    testApp.setUser({ id: "ledger-wyr-me" });
    const res = await request(testApp.app).delete("/api/me/trust-ledger/wyr");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, id: "wyr", removed: 2 });

    const mine = await db
      .select({ id: wyrAnswersTable.id })
      .from(wyrAnswersTable)
      .where(eq(wyrAnswersTable.userId, "ledger-wyr-me"));
    expect(mine.length).toBe(0);
    const others = await db
      .select({ id: wyrAnswersTable.id })
      .from(wyrAnswersTable)
      .where(eq(wyrAnswersTable.userId, "ledger-wyr-other"));
    expect(others.length).toBe(1);
  });

  it("purges the full wingman footprint across all three tables", async () => {
    const {
      db,
      wingmanInvitesTable,
      wingmanAnswersTable,
      wingmanSelfRatingsTable,
    } = await import("../lib/testDb");
    await db.insert(wingmanInvitesTable).values({ userId: "ledger-wm-me", friendLabel: "A" });
    await db.insert(wingmanAnswersTable).values({
      inviteId: 1,
      userId: "ledger-wm-me",
      warmth: 4,
      humor: 4,
      drive: 4,
      openness: 4,
      steadiness: 4,
    });
    await db.insert(wingmanSelfRatingsTable).values({
      userId: "ledger-wm-me",
      warmth: 3,
      humor: 3,
      drive: 3,
      openness: 3,
      steadiness: 3,
    });

    testApp.setUser({ id: "ledger-wm-me" });
    const res = await request(testApp.app).delete("/api/me/trust-ledger/externalCalibration");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, id: "externalCalibration", removed: 3 });

    for (const table of [wingmanInvitesTable, wingmanAnswersTable, wingmanSelfRatingsTable]) {
      const left = await db
        .select({ userId: table.userId })
        .from(table)
        .where(eq(table.userId, "ledger-wm-me"));
      expect(left.length).toBe(0);
    }
  });

  it("purging the calendar lane drops every source and disconnects the live connector", async () => {
    const { db, importedSourcesTable, connectorConnectionsTable } = await import(
      "../lib/testDb"
    );
    await db.insert(importedSourcesTable).values([
      { userId: "ledger-cal-me", source: "calendar-ics", parsedSummary: {} },
      { userId: "ledger-cal-me", source: "google-calendar", parsedSummary: {} },
      { userId: "ledger-cal-other", source: "google-calendar", parsedSummary: {} },
    ]);
    await db.insert(connectorConnectionsTable).values([
      {
        userId: "ledger-cal-me",
        provider: "google-calendar",
        laneId: "calendar",
        source: "google-calendar",
        status: "connected",
        disconnectedAt: null,
      },
      {
        userId: "ledger-cal-other",
        provider: "google-calendar",
        laneId: "calendar",
        source: "google-calendar",
        status: "connected",
        disconnectedAt: null,
      },
    ]);

    testApp.setUser({ id: "ledger-cal-me" });
    const res = await request(testApp.app).delete("/api/me/trust-ledger/calendar");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, id: "calendar", removed: 2 });

    const mineSources = await db
      .select({ id: importedSourcesTable.id })
      .from(importedSourcesTable)
      .where(eq(importedSourcesTable.userId, "ledger-cal-me"));
    expect(mineSources.length).toBe(0);

    const [mineConn] = await db
      .select({ status: connectorConnectionsTable.status })
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.userId, "ledger-cal-me"));
    expect(mineConn?.status).toBe("disconnected");

    // Another user's connector and rows are untouched.
    const [otherConn] = await db
      .select({ status: connectorConnectionsTable.status })
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.userId, "ledger-cal-other"));
    expect(otherConn?.status).toBe("connected");
    const otherSources = await db
      .select({ id: importedSourcesTable.id })
      .from(importedSourcesTable)
      .where(eq(importedSourcesTable.userId, "ledger-cal-other"));
    expect(otherSources.length).toBe(1);
  });

  it("treats consistency as derived: nothing stored, nothing to purge", async () => {
    testApp.setUser({ id: "ledger-consistency" });
    const res = await request(testApp.app).delete("/api/me/trust-ledger/consistency");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, id: "consistency", removed: 0 });
  });
});
