import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  usersTable,
  userBlocksTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import matchingRouter from "./matching";

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
  app.use("/api", matchingRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `block-a-${suffix}`;
const USER_B = `block-b-${suffix}`;
const ALL_USERS = [USER_A, USER_B];


async function grantPlan(
  userId: string,
  tier: "member" | "insight" | "match",
): Promise<void> {
  await db
    .insert(usersTable)
    .values({ id: userId, tier, tierGrantedAt: new Date() })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { tier, tierGrantedAt: new Date() },
    });
}
async function seedMember(
  userId: string,
  opts: {
    age: number;
    gender: string;
    genderPreference: string;
    cityHint: string;
  },
): Promise<void> {
  await db
    .insert(matchPoolMembershipTable)
    .values({ userId, status: "ready" })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: { status: "ready" },
    });
  await db
    .insert(matchPreferencesTable)
    .values({
      userId,
      ageMin: 18,
      ageMax: 99,
      genderPreference: opts.genderPreference,
      cityHint: opts.cityHint,
    })
    .onConflictDoUpdate({
      target: matchPreferencesTable.userId,
      set: {
        ageMin: 18,
        ageMax: 99,
        genderPreference: opts.genderPreference,
        cityHint: opts.cityHint,
      },
    });
  await db.insert(auditsTable).values({
    userId,
    firstName: "Test",
    age: opts.age,
    gender: opts.gender,
    datingGoal: "relationship",
    bio: "A real, thoughtful bio used for the block enforcement test fixture.",
    status: "complete",
    readinessScore: 80,
    reportGeneratedAt: new Date(),
  });
}

async function cleanup(): Promise<void> {
  await db.delete(auditsTable).where(inArray(auditsTable.userId, ALL_USERS));
  await db
    .delete(matchPreferencesTable)
    .where(inArray(matchPreferencesTable.userId, ALL_USERS));
  await db
    .delete(matchPoolMembershipTable)
    .where(inArray(matchPoolMembershipTable.userId, ALL_USERS));
  for (const u of ALL_USERS) {
    await db.delete(matchProposalsTable).where(eq(matchProposalsTable.userId, u));
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.proposedToUserId, u));
    await db
      .delete(userBlocksTable)
      .where(eq(userBlocksTable.blockerUserId, u));
    await db
      .delete(userBlocksTable)
      .where(eq(userBlocksTable.blockedUserId, u));
  }
  await db.delete(usersTable).where(inArray(usersTable.id, ALL_USERS));
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

describe("matching respects symmetric blocks", () => {
  it("never proposes a member the caller has blocked", async () => {
    await grantPlan(USER_A, "match");
    await seedMember(USER_A, {
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    // A blocks B before any proposal exists.
    await db
      .insert(userBlocksTable)
      .values({ blockerUserId: USER_A, blockedUserId: USER_B });

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/matching/discover");
    expect(res.status).toBe(200);
    const internalToB = res.body.filter(
      (p: { source: string; proposedToUserId: string }) =>
        p.source === "internal" && p.proposedToUserId === USER_B,
    );
    expect(internalToB.length).toBe(0);
  });

  it("excludes a member who has blocked the caller (reverse direction)", async () => {
    await grantPlan(USER_A, "match");
    await seedMember(USER_A, {
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    // B blocks A; A must still not be proposed B.
    await db
      .insert(userBlocksTable)
      .values({ blockerUserId: USER_B, blockedUserId: USER_A });

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/matching/discover");
    expect(res.status).toBe(200);
    const internalToB = res.body.filter(
      (p: { source: string; proposedToUserId: string }) =>
        p.source === "internal" && p.proposedToUserId === USER_B,
    );
    expect(internalToB.length).toBe(0);
  });
});
