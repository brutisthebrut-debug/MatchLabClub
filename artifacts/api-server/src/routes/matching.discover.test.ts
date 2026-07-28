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
import { eq, inArray, or } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  matchConnectionsTable,
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
const USER_A = `disc-a-${suffix}`;
const USER_B = `disc-b-${suffix}`;
const USER_C = `disc-c-${suffix}`;
const ALL_USERS = [USER_A, USER_B, USER_C];

async function seedMember(
  userId: string,
  opts: {
    status: string;
    age: number;
    gender: string;
    genderPreference: string;
    cityHint: string;
  },
): Promise<void> {
  await db
    .insert(matchPoolMembershipTable)
    .values({ userId, status: opts.status })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: { status: opts.status },
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
  // A completed audit gives the engine real demographics plus signal coverage,
  // so the readiness gate and gender/age gates have data to work with.
  await db.insert(auditsTable).values({
    userId,
    firstName: "Test",
    age: opts.age,
    gender: opts.gender,
    datingGoal: "relationship",
    bio: "A real, thoughtful bio used for the discover route test fixture.",
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
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, u));
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.proposedToUserId, u));
  }
  await db
    .delete(matchConnectionsTable)
    .where(
      or(
        inArray(matchConnectionsTable.userLowId, ALL_USERS),
        inArray(matchConnectionsTable.userHighId, ALL_USERS),
      ),
    );
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

describe("POST /me/matching/discover", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/me/matching/discover");
    expect(res.status).toBe(401);
  });

  it("422s when the caller is not in the pool", async () => {
    testApp.setUser({ id: USER_A });
    await db
      .insert(matchPoolMembershipTable)
      .values({ userId: USER_A, status: "off" })
      .onConflictDoUpdate({
        target: matchPoolMembershipTable.userId,
        set: { status: "off" },
      });
    const res = await request(testApp.app).post("/api/me/matching/discover");
    expect(res.status).toBe(422);
    await db
      .delete(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, USER_A));
  });

  it("creates mutual internal proposals and is idempotent", async () => {
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    testApp.setUser({ id: USER_A });
    const first = await request(testApp.app).post("/api/me/matching/discover");
    expect(first.status).toBe(200);
    expect(Array.isArray(first.body)).toBe(true);
    // Scope to the A->B pair: the pool is a shared table and sibling test files
    // seed their own ready members, which can legitimately match these fixtures
    // when no radius is set. Idempotency is a property of the pair, guarded by
    // the partial unique index, so a pair-scoped count stays deterministic.
    const internalForA = first.body.filter(
      (p: { source: string; proposedToUserId: string }) =>
        p.source === "internal" && p.proposedToUserId === USER_B,
    );
    expect(internalForA.length).toBe(1);

    // The mirror row exists for B too.
    const bRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_B));
    const bToA = bRows.filter((r) => r.proposedToUserId === USER_A);
    expect(bToA.length).toBe(1);

    // Running again must not duplicate the pair.
    const second = await request(testApp.app).post("/api/me/matching/discover");
    expect(second.status).toBe(200);
    const internalAfter = second.body.filter(
      (p: { source: string; proposedToUserId: string }) =>
        p.source === "internal" && p.proposedToUserId === USER_B,
    );
    expect(internalAfter.length).toBe(1);
  });

  it("flips both rows to mutual_yes when both members say yes", async () => {
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/matching/discover");

    const aRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const bRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_B));
    // Pick the A<->B pair explicitly; sibling files can add unrelated rows.
    const aProposal = aRows.find((r) => r.proposedToUserId === USER_B)!;
    const bProposal = bRows.find((r) => r.proposedToUserId === USER_A)!;

    // A says yes first: stays user_yes, no match yet.
    testApp.setUser({ id: USER_A });
    const aYes = await request(testApp.app)
      .put(`/api/me/matching/proposals/${aProposal.id}/response`)
      .send({ interested: true });
    expect(aYes.status).toBe(200);
    expect(aYes.body.status).toBe("user_yes");

    // B says yes: both flip to mutual_yes.
    testApp.setUser({ id: USER_B });
    const bYes = await request(testApp.app)
      .put(`/api/me/matching/proposals/${bProposal.id}/response`)
      .send({ interested: true });
    expect(bYes.status).toBe(200);
    expect(bYes.body.status).toBe("mutual_yes");

    const aAfter = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.id, aProposal.id));
    expect(aAfter[0]?.status).toBe("mutual_yes");

    const connections = await db
      .select()
      .from(matchConnectionsTable)
      .where(
        or(
          eq(matchConnectionsTable.userLowId, USER_A),
          eq(matchConnectionsTable.userHighId, USER_A),
        ),
      );
    expect(
      connections.some(
        (connection) =>
          connection.status === "active" &&
          [connection.userLowId, connection.userHighId].includes(USER_B),
      ),
    ).toBe(true);
  });

  it("keeps a decline terminal and expires the mirrored proposal", async () => {
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/matching/discover");
    const aProposals = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const aProposal = aProposals.find(
      (proposal) => proposal.proposedToUserId === USER_B,
    );

    const declined = await request(testApp.app)
      .put(`/api/me/matching/proposals/${aProposal!.id}/response`)
      .send({ interested: false });
    expect(declined.status).toBe(200);
    expect(declined.body.status).toBe("user_no");

    const rows = (
      await db
        .select()
        .from(matchProposalsTable)
        .where(inArray(matchProposalsTable.userId, [USER_A, USER_B]))
    ).filter(
      (row) =>
        [USER_A, USER_B].includes(row.userId) &&
        row.proposedToUserId != null &&
        [USER_A, USER_B].includes(row.proposedToUserId),
    );
    expect(rows.find((row) => row.userId === USER_A)?.status).toBe("user_no");
    expect(rows.find((row) => row.userId === USER_B)?.status).toBe("expired");
  });

  it("withdraws unfinished proposals when either member pauses the pool", async () => {
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/matching/discover");
    const aProposals = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const aProposal = aProposals.find(
      (proposal) => proposal.proposedToUserId === USER_B,
    );
    await request(testApp.app)
      .put(`/api/me/matching/proposals/${aProposal!.id}/response`)
      .send({ interested: true });

    testApp.setUser({ id: USER_B });
    const paused = await request(testApp.app)
      .put("/api/me/matching/pool-membership")
      .send({ status: "paused", pausedReason: "Taking a break" });
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe("paused");

    const rows = (
      await db
        .select()
        .from(matchProposalsTable)
        .where(inArray(matchProposalsTable.userId, [USER_A, USER_B]))
    ).filter(
      (row) =>
        [USER_A, USER_B].includes(row.userId) &&
        row.proposedToUserId != null &&
        [USER_A, USER_B].includes(row.proposedToUserId),
    );
    expect(rows.filter((row) => row.status === "expired")).toHaveLength(2);

    const connections = await db
      .select()
      .from(matchConnectionsTable)
      .where(
        or(
          eq(matchConnectionsTable.userLowId, USER_A),
          eq(matchConnectionsTable.userHighId, USER_A),
        ),
      );
    expect(connections).toHaveLength(0);
  });

  it("never silently reopens a connection either member already closed", async () => {
    await seedMember(USER_A, {
      status: "ready",
      age: 30,
      gender: "woman",
      genderPreference: "men",
      cityHint: "Austin",
    });
    await seedMember(USER_B, {
      status: "ready",
      age: 32,
      gender: "man",
      genderPreference: "women",
      cityHint: "Austin",
    });

    testApp.setUser({ id: USER_A });
    await request(testApp.app).post("/api/me/matching/discover");
    const aRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_A));
    const bRows = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, USER_B));
    const aProposal = aRows.find(
      (proposal) => proposal.proposedToUserId === USER_B,
    )!;
    const bProposal = bRows.find(
      (proposal) => proposal.proposedToUserId === USER_A,
    )!;
    const [userLowId, userHighId] = [USER_A, USER_B].sort();
    const [closedConnection] = await db
      .insert(matchConnectionsTable)
      .values({
        userLowId,
        userHighId,
        status: "closed",
        closedReason: "unmatch",
        closedByUserId: USER_A,
      })
      .returning();

    const aYes = await request(testApp.app)
      .put(`/api/me/matching/proposals/${aProposal.id}/response`)
      .send({ interested: true });
    expect(aYes.body.status).toBe("user_yes");

    testApp.setUser({ id: USER_B });
    const bYes = await request(testApp.app)
      .put(`/api/me/matching/proposals/${bProposal.id}/response`)
      .send({ interested: true });
    expect(bYes.status).toBe(200);
    expect(bYes.body.status).toBe("completed");

    const [after] = await db
      .select()
      .from(matchConnectionsTable)
      .where(eq(matchConnectionsTable.id, closedConnection!.id));
    expect(after?.status).toBe("closed");
    expect(after?.closedReason).toBe("unmatch");
  });
});
