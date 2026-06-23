import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";
import crypto from "crypto";
import { eq, or, inArray } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  userReportsTable,
  userBlocksTable,
  behavioralGrowthEventsTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import accountRouter from "./account";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
  const app = express();
  app.use(express.json());
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
  app.use("/api", accountRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const USER = `acct-safety-${suffix}`;
const OTHER = `acct-other-${suffix}`;
const ALL = [USER, OTHER];

async function cleanup(): Promise<void> {
  await db
    .delete(userBlocksTable)
    .where(
      or(
        inArray(userBlocksTable.blockerUserId, ALL),
        inArray(userBlocksTable.blockedUserId, ALL),
      ),
    );
  await db
    .delete(userReportsTable)
    .where(
      or(
        inArray(userReportsTable.reporterUserId, ALL),
        inArray(userReportsTable.reportedUserId, ALL),
      ),
    );
  await db
    .delete(behavioralGrowthEventsTable)
    .where(inArray(behavioralGrowthEventsTable.userId, ALL));
  await db.delete(usersTable).where(inArray(usersTable.id, ALL));
}

beforeAll(() => {
  testApp = makeTestApp();
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("DELETE /api/account purges safety records", () => {
  it("removes the user's reports and blocks in both directions", async () => {
    await db.insert(usersTable).values({ id: USER, email: null });

    // Report the user filed, and a report filed against the user.
    await db.insert(userReportsTable).values([
      { reporterUserId: USER, reportedUserId: OTHER, reason: "harassment" },
      { reporterUserId: OTHER, reportedUserId: USER, reason: "scam" },
    ]);
    // A block the user created, and a block created against the user.
    await db.insert(userBlocksTable).values([
      { blockerUserId: USER, blockedUserId: OTHER, reason: "harassment" },
      { blockerUserId: OTHER, blockedUserId: USER, reason: "other" },
    ]);

    testApp.setUser({ id: USER });
    const res = await request(testApp.app).delete("/api/account");
    expect(res.status).toBe(200);

    const reportsLeft = await db
      .select({ id: userReportsTable.id })
      .from(userReportsTable)
      .where(
        or(
          eq(userReportsTable.reporterUserId, USER),
          eq(userReportsTable.reportedUserId, USER),
        ),
      );
    const blocksLeft = await db
      .select({ id: userBlocksTable.id })
      .from(userBlocksTable)
      .where(
        or(
          eq(userBlocksTable.blockerUserId, USER),
          eq(userBlocksTable.blockedUserId, USER),
        ),
      );

    expect(reportsLeft.length).toBe(0);
    expect(blocksLeft.length).toBe(0);
  });
});

describe("POST /api/me/account/delete purges safety records", () => {
  it("removes the user's reports and blocks in both directions", async () => {
    const email = `${USER}@example.com`;
    await db.insert(usersTable).values({ id: USER, email });

    await db.insert(userReportsTable).values([
      { reporterUserId: USER, reportedUserId: OTHER, reason: "harassment" },
      { reporterUserId: OTHER, reportedUserId: USER, reason: "scam" },
    ]);
    await db.insert(userBlocksTable).values([
      { blockerUserId: USER, blockedUserId: OTHER, reason: "harassment" },
      { blockerUserId: OTHER, blockedUserId: USER, reason: "other" },
    ]);

    testApp.setUser({ id: USER });
    const res = await request(testApp.app)
      .post("/api/me/account/delete")
      .send({ confirmation: email });
    expect(res.status).toBe(200);

    const reportsLeft = await db
      .select({ id: userReportsTable.id })
      .from(userReportsTable)
      .where(
        or(
          eq(userReportsTable.reporterUserId, USER),
          eq(userReportsTable.reportedUserId, USER),
        ),
      );
    const blocksLeft = await db
      .select({ id: userBlocksTable.id })
      .from(userBlocksTable)
      .where(
        or(
          eq(userBlocksTable.blockerUserId, USER),
          eq(userBlocksTable.blockedUserId, USER),
        ),
      );

    expect(reportsLeft.length).toBe(0);
    expect(blocksLeft.length).toBe(0);
  });
});

// Regression guard for the dual GDPR delete-path parity rule: first-party
// signal tables have no FK cascade on user_id, so BOTH the DELETE /account and
// the confirmation POST /me/account/delete paths must hard-delete them or they
// orphan. The POST case here fails if the confirmation path drops the mirror.
describe("first-party progress signal purge parity", () => {
  it("DELETE /api/account removes behavioral growth events", async () => {
    await db.insert(usersTable).values({ id: USER, email: null });
    await db.insert(behavioralGrowthEventsTable).values([
      { userId: USER, type: "experiment_tried" },
      { userId: USER, type: "pattern_broken" },
    ]);

    testApp.setUser({ id: USER });
    const res = await request(testApp.app).delete("/api/account");
    expect(res.status).toBe(200);

    const left = await db
      .select({ id: behavioralGrowthEventsTable.id })
      .from(behavioralGrowthEventsTable)
      .where(eq(behavioralGrowthEventsTable.userId, USER));
    expect(left.length).toBe(0);
  });

  it("POST /api/me/account/delete removes behavioral growth events", async () => {
    const email = `${USER}@example.com`;
    await db.insert(usersTable).values({ id: USER, email });
    await db.insert(behavioralGrowthEventsTable).values([
      { userId: USER, type: "experiment_tried" },
      { userId: USER, type: "commitment_kept" },
    ]);

    testApp.setUser({ id: USER });
    const res = await request(testApp.app)
      .post("/api/me/account/delete")
      .send({ confirmation: email });
    expect(res.status).toBe(200);

    const left = await db
      .select({ id: behavioralGrowthEventsTable.id })
      .from(behavioralGrowthEventsTable)
      .where(eq(behavioralGrowthEventsTable.userId, USER));
    expect(left.length).toBe(0);
  });
});
