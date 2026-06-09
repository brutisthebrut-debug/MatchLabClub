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
  usersTable,
  matchConnectionsTable,
  connectionMessagesTable,
  matchPoolMembershipTable,
  userBlocksTable,
  userReportsTable,
  orderConnectionPair,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import connectionsRouter from "./connections";

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
  app.use("/api", connectionsRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `conn-a-${suffix}`;
const USER_B = `conn-b-${suffix}`;
const ALL_USERS = [USER_A, USER_B];

async function makeConnection(): Promise<string> {
  const { userLowId, userHighId } = orderConnectionPair(USER_A, USER_B);
  const [row] = await db
    .insert(matchConnectionsTable)
    .values({ userLowId, userHighId, status: "active" })
    .returning();
  return row!.id;
}

async function cleanup(): Promise<void> {
  for (const u of ALL_USERS) {
    await db.delete(auditsTable).where(eq(auditsTable.userId, u));
    await db.delete(usersTable).where(eq(usersTable.id, u));
    await db
      .delete(matchPoolMembershipTable)
      .where(eq(matchPoolMembershipTable.userId, u));
    await db
      .delete(userBlocksTable)
      .where(eq(userBlocksTable.blockerUserId, u));
    await db
      .delete(userBlocksTable)
      .where(eq(userBlocksTable.blockedUserId, u));
    await db
      .delete(userReportsTable)
      .where(eq(userReportsTable.reporterUserId, u));
    await db
      .delete(userReportsTable)
      .where(eq(userReportsTable.reportedUserId, u));
  }
  const conns = await db
    .select({ id: matchConnectionsTable.id })
    .from(matchConnectionsTable)
    .where(
      inArray(matchConnectionsTable.userLowId, ALL_USERS),
    );
  const ids = conns.map((c) => c.id);
  if (ids.length > 0) {
    await db
      .delete(connectionMessagesTable)
      .where(inArray(connectionMessagesTable.connectionId, ids));
  }
  await db
    .delete(matchConnectionsTable)
    .where(inArray(matchConnectionsTable.userLowId, ALL_USERS));
  await db
    .delete(matchConnectionsTable)
    .where(inArray(matchConnectionsTable.userHighId, ALL_USERS));
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

describe("connection messaging", () => {
  it("requires auth on the connection list", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/connections");
    expect(res.status).toBe(401);
  });

  it("never leaks a connection the caller is not part of", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: `conn-outsider-${suffix}` });
    const res = await request(testApp.app).get(`/api/me/connections/${id}`);
    expect(res.status).toBe(404);
  });

  it("delivers a message and tracks unread, then read clears it", async () => {
    const id = await makeConnection();

    testApp.setUser({ id: USER_A });
    const sent = await request(testApp.app)
      .post(`/api/me/connections/${id}/messages`)
      .send({ body: "Hi there, good to match with you." });
    expect(sent.status).toBe(201);
    expect(sent.body.mine).toBe(true);

    // B sees one unread.
    testApp.setUser({ id: USER_B });
    const list = await request(testApp.app).get("/api/me/connections");
    expect(list.status).toBe(200);
    const row = list.body.find((c: { id: string }) => c.id === id);
    expect(row.unreadCount).toBe(1);
    expect(row.lastMessagePreview).toContain("good to match");

    // From B's side the message is not "mine".
    const thread = await request(testApp.app).get(
      `/api/me/connections/${id}/messages`,
    );
    expect(thread.body[0].mine).toBe(false);

    // B reads; unread clears.
    const read = await request(testApp.app).post(
      `/api/me/connections/${id}/read`,
    );
    expect(read.status).toBe(200);
    const list2 = await request(testApp.app).get("/api/me/connections");
    const row2 = list2.body.find((c: { id: string }) => c.id === id);
    expect(row2.unreadCount).toBe(0);
  });

  it("rejects a blank message body", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post(`/api/me/connections/${id}/messages`)
      .send({ body: "   " });
    expect(res.status).toBe(400);
  });

  it("unmatch closes the thread and blocks further sends", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const closed = await request(testApp.app).post(
      `/api/me/connections/${id}/unmatch`,
    );
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("closed");
    expect(closed.body.closedReason).toBe("unmatch");
    expect(closed.body.closedByYou).toBe(true);

    const blocked = await request(testApp.app)
      .post(`/api/me/connections/${id}/messages`)
      .send({ body: "Still there?" });
    expect(blocked.status).toBe(409);

    // The other side also cannot send into a closed thread.
    testApp.setUser({ id: USER_B });
    const blockedB = await request(testApp.app)
      .post(`/api/me/connections/${id}/messages`)
      .send({ body: "Hello?" });
    expect(blockedB.status).toBe(409);
  });

  it("a block between the pair hard-gates sending", async () => {
    const id = await makeConnection();
    await db
      .insert(userBlocksTable)
      .values({ blockerUserId: USER_B, blockedUserId: USER_A });
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post(`/api/me/connections/${id}/messages`)
      .send({ body: "Hi" });
    expect(res.status).toBe(409);
  });

  it("report files a member report and closes the thread", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post(`/api/me/connections/${id}/report`)
      .send({ reason: "harassment", note: "Inappropriate messages." });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("closed");
    expect(res.body.closedReason).toBe("report");

    const reports = await db
      .select()
      .from(userReportsTable)
      .where(eq(userReportsTable.reporterUserId, USER_A));
    expect(reports.length).toBe(1);
    expect(reports[0]!.reportedUserId).toBe(USER_B);

    // Reporting also blocks: the reporter is now block-paired with the
    // counterpart, so the matching engine can never re-pair or reopen them.
    const blocks = await db
      .select()
      .from(userBlocksTable)
      .where(eq(userBlocksTable.blockerUserId, USER_A));
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.blockedUserId).toBe(USER_B);
  });
});

describe("reveal card consent gate", () => {
  it("hides name and photos until the counterpart opts in", async () => {
    const id = await makeConnection();
    await db.insert(usersTable).values({ id: USER_B, firstName: "Robin" });
    await db.insert(auditsTable).values({
      userId: USER_B,
      firstName: "Robin",
      age: 30,
      gender: "nonbinary",
      datingGoal: "relationship",
      bio: "A real, thoughtful bio used for the reveal card test fixture.",
      status: "complete",
      readinessScore: 70,
      reportGeneratedAt: new Date(),
    });

    // Reveal off (no membership row / consent false): card is anonymous.
    testApp.setUser({ id: USER_A });
    const hidden = await request(testApp.app).get(
      `/api/me/connections/${id}/profile`,
    );
    expect(hidden.status).toBe(200);
    expect(hidden.body.revealed).toBe(false);
    expect(hidden.body.displayName).toBeNull();
    expect(hidden.body.photos).toEqual([]);
    expect(typeof hidden.body.readinessSummary).toBe("string");

    // Counterpart turns reveal consent on.
    await db
      .insert(matchPoolMembershipTable)
      .values({ userId: USER_B, status: "ready", revealConsent: true })
      .onConflictDoUpdate({
        target: matchPoolMembershipTable.userId,
        set: { revealConsent: true },
      });
    const shown = await request(testApp.app).get(
      `/api/me/connections/${id}/profile`,
    );
    expect(shown.status).toBe(200);
    expect(shown.body.revealed).toBe(true);
    expect(shown.body.displayName).toBe("Robin");
  });
});
