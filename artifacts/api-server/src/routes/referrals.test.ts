import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, usersTable, matchPoolMembershipTable, referralsTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import referralsRouter from "./referrals";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
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
  app.use("/api", referralsRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const INVITER_ID = `test-ref-inviter-${suffix}`;
const READY_INVITEE_ID = `test-ref-ready-${suffix}`;
const BUILDING_INVITEE_ID = `test-ref-building-${suffix}`;
const JOINED_INVITEE_ID = `test-ref-joined-${suffix}`;
const allUserIds = [INVITER_ID, READY_INVITEE_ID, BUILDING_INVITEE_ID, JOINED_INVITEE_ID];

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

async function cleanup(): Promise<void> {
  // Remove referral rows first. inviter_user_id is NOT NULL with an
  // onDelete: "set null" FK, so deleting an inviter user before its referral
  // rows would violate the not-null constraint. Production account deletion
  // already clears these rows explicitly (account.ts), so this mirrors that.
  await db.delete(referralsTable).where(inArray(referralsTable.inviterUserId, allUserIds));
  await db.delete(matchPoolMembershipTable).where(inArray(matchPoolMembershipTable.userId, allUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, allUserIds));
}

describe("GET /me/referrals", () => {
  it("returns 401 for an anonymous request", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/referrals");
    expect(res.status).toBe(401);
  });

  it("returns an empty reflection when no one has been invited", async () => {
    await db.insert(usersTable).values({ id: INVITER_ID, firstName: "Sam" });
    testApp.setUser({ id: INVITER_ID });

    const res = await request(testApp.app).get("/api/me/referrals");
    expect(res.status).toBe(200);
    expect(res.body.refCode).toBe(`user-${INVITER_ID}`);
    expect(res.body.sharePath).toBe("/quizzes");
    expect(res.body.summary).toEqual({ joined: 0, inPool: 0, ready: 0 });
    expect(res.body.invitees).toEqual([]);
  });

  it("reflects invitees with pool status, summary counts, and no email leak", async () => {
    await db.insert(usersTable).values([
      { id: INVITER_ID, firstName: "Sam" },
      {
        id: READY_INVITEE_ID,
        email: "ready@example.com",
        firstName: "Riley",
        invitedByUserId: INVITER_ID,
        invitedAt: new Date("2026-01-03T00:00:00Z"),
      },
      {
        id: BUILDING_INVITEE_ID,
        email: "building@example.com",
        firstName: "Bo",
        invitedByUserId: INVITER_ID,
        invitedAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        // No firstName, so the placeholder display name should be used.
        id: JOINED_INVITEE_ID,
        email: "joined@example.com",
        invitedByUserId: INVITER_ID,
        invitedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    await db.insert(matchPoolMembershipTable).values([
      { userId: READY_INVITEE_ID, status: "ready" },
      { userId: BUILDING_INVITEE_ID, status: "building" },
    ]);
    testApp.setUser({ id: INVITER_ID });

    const res = await request(testApp.app).get("/api/me/referrals");
    expect(res.status).toBe(200);

    // joined = 3, inPool = ready + building = 2, ready = 1.
    expect(res.body.summary).toEqual({ joined: 3, inPool: 2, ready: 1 });

    // Newest first by invitedAt.
    expect(res.body.invitees).toHaveLength(3);
    expect(res.body.invitees[0]).toMatchObject({ displayName: "Riley", status: "ready" });
    expect(res.body.invitees[1]).toMatchObject({ displayName: "Bo", status: "building" });
    expect(res.body.invitees[2]).toMatchObject({ displayName: "A new member", status: "joined" });

    // Privacy: no email or other private field is ever surfaced.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("@example.com");
    for (const invitee of res.body.invitees) {
      expect(invitee).not.toHaveProperty("email");
      expect(invitee).not.toHaveProperty("id");
    }
  });

  it("keeps exactly one referral row per invitee even on repeated inserts (idempotency)", async () => {
    await db.insert(usersTable).values([
      { id: INVITER_ID, firstName: "Sam" },
      { id: READY_INVITEE_ID, firstName: "Riley", invitedByUserId: INVITER_ID },
    ]);

    // Two attributed inserts for the same invitee model a returning user
    // logging in twice (or two sign-in upserts racing). The unique index plus
    // onConflictDoNothing must collapse them to a single row so founder-side
    // attribution counts stay correct.
    const insertOnce = () =>
      db
        .insert(referralsTable)
        .values({
          inviterUserId: INVITER_ID,
          inviteeUserId: READY_INVITEE_ID,
          refCode: `user-${INVITER_ID}`,
          signedUpAt: new Date(),
        })
        .onConflictDoNothing({ target: referralsTable.inviteeUserId });
    await insertOnce();
    await insertOnce();

    const rows = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.inviteeUserId, READY_INVITEE_ID));
    expect(rows).toHaveLength(1);
  });
});
