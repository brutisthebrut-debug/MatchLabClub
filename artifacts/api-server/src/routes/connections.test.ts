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
  matchProposalsTable,
  matchPreferencesTable,
  userBlocksTable,
  userReportsTable,
  postDateNotesTable,
  wellnessInferencesTable,
  journeyEventsTable,
  orderConnectionPair,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import connectionsRouter from "./connections";
import postDateNotesRouter from "./postDateNotes";

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
  app.use("/api", postDateNotesRouter);
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
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.userId, u));
    await db
      .delete(matchProposalsTable)
      .where(eq(matchProposalsTable.proposedToUserId, u));
    await db
      .delete(matchPreferencesTable)
      .where(eq(matchPreferencesTable.userId, u));
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
    await db.delete(postDateNotesTable).where(eq(postDateNotesTable.userId, u));
    await db
      .delete(wellnessInferencesTable)
      .where(eq(wellnessInferencesTable.userId, u));
    await db.delete(journeyEventsTable).where(eq(journeyEventsTable.userId, u));
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

describe("compatibility score on the profile", () => {
  it("is null when no internal proposal exists for the pair", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/profile`,
    );
    expect(res.status).toBe(200);
    expect(res.body.compatibilityScore).toBeNull();
    expect(res.body.matchSummary).toBeNull();
  });

  it("surfaces the symmetric score and aggregate summary from the proposal", async () => {
    const id = await makeConnection();
    await db.insert(matchProposalsTable).values([
      {
        userId: USER_A,
        proposedToUserId: USER_B,
        source: "internal",
        compatibilityScore: 84,
        summary: "Strong overall fit, about 8 miles apart.",
        status: "mutual_yes",
      },
      {
        userId: USER_B,
        proposedToUserId: USER_A,
        source: "internal",
        compatibilityScore: 84,
        summary: "Strong overall fit, about 8 miles apart.",
        status: "mutual_yes",
      },
    ]);
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/profile`,
    );
    expect(res.status).toBe(200);
    expect(res.body.compatibilityScore).toBe(84);
    expect(res.body.matchSummary).toBe("Strong overall fit, about 8 miles apart.");
  });

  it("falls back to the counterpart's mirrored row when the viewer's is absent", async () => {
    const id = await makeConnection();
    // Only the counterpart's direction exists; the symmetric score should still
    // resolve for the viewer.
    await db.insert(matchProposalsTable).values({
      userId: USER_B,
      proposedToUserId: USER_A,
      source: "internal",
      compatibilityScore: 61,
      summary: "Promising fit, worth a real conversation.",
      status: "proposed",
    });
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/profile`,
    );
    expect(res.status).toBe(200);
    expect(res.body.compatibilityScore).toBe(61);
    expect(res.body.matchSummary).toBe("Promising fit, worth a real conversation.");
  });
});

describe("connection conversation starters", () => {
  it("requires auth", async () => {
    const id = await makeConnection();
    testApp.setUser(null);
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/starters`,
    );
    expect(res.status).toBe(401);
  });

  it("404s for someone outside the connection", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: `conn-outsider-${suffix}` });
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/starters`,
    );
    expect(res.status).toBe(404);
  });

  it("always returns three deterministic openers when the deep AI lane is off", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).get(
      `/api/me/connections/${id}/starters`,
    );
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("deterministic");
    expect(Array.isArray(res.body.starters)).toBe(true);
    expect(res.body.starters).toHaveLength(3);
    for (const s of res.body.starters) {
      expect(typeof s.text).toBe("string");
      expect(s.text.length).toBeGreaterThan(0);
      expect(typeof s.rationale).toBe("string");
      expect(s.rationale.length).toBeGreaterThan(0);
      // Voice rule: no em dashes anywhere in user-facing copy.
      expect(s.text).not.toContain("\u2014");
    }
  });
});

async function setCity(userId: string, city: string): Promise<void> {
  await db
    .insert(matchPreferencesTable)
    .values({ userId, cityHint: city })
    .onConflictDoUpdate({
      target: matchPreferencesTable.userId,
      set: { cityHint: city },
    });
}

async function setReveal(userId: string): Promise<void> {
  await db
    .insert(matchPoolMembershipTable)
    .values({ userId, status: "ready", revealConsent: true })
    .onConflictDoUpdate({
      target: matchPoolMembershipTable.userId,
      set: { revealConsent: true },
    });
}

describe("connection date ideas", () => {
  it("requires auth", async () => {
    const id = await makeConnection();
    testApp.setUser(null);
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(401);
  });

  it("404s for someone outside the connection", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: `conn-outsider-${suffix}` });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(404);
  });

  it("returns deterministic ideas with voice-safe copy when the deep AI lane is off", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("deterministic");
    expect(Array.isArray(res.body.ideas)).toBe(true);
    expect(res.body.ideas.length).toBeGreaterThanOrEqual(3);
    for (const idea of res.body.ideas) {
      expect(typeof idea.title).toBe("string");
      expect(idea.title.length).toBeGreaterThan(0);
      expect(typeof idea.description).toBe("string");
      expect(idea.description.length).toBeGreaterThan(0);
      expect(typeof idea.category).toBe("string");
      // Voice rule: no em dashes anywhere in user-facing copy.
      expect(idea.title).not.toContain("\u2014");
      expect(idea.description).not.toContain("\u2014");
    }
  });

  it("never names the counterpart city when reveal is off and the cities differ", async () => {
    const id = await makeConnection();
    await setCity(USER_A, "Seattle");
    await setCity(USER_B, "Austin");
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(200);
    // Stays on the viewer's own city, framed for both, never the counterpart's.
    expect(res.body.locationLabel).toBe("near you in Seattle");
    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain("Austin");
  });

  it("names the shared city when both gave the same place, even with reveal off", async () => {
    const id = await makeConnection();
    await setCity(USER_A, "Austin, TX");
    await setCity(USER_B, "austin");
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(200);
    expect(res.body.locationLabel).toBe("in Austin");
  });

  it("names the counterpart city once they turn reveal consent on", async () => {
    const id = await makeConnection();
    await setCity(USER_A, "Seattle");
    await setCity(USER_B, "Austin");
    await setReveal(USER_B);
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(200);
    expect(res.body.locationLabel).toBe("in Austin");
  });

  it("stays fully generic when neither person set a city", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(200);
    expect(res.body.locationLabel).toBe("near both of you");
  });

  it("409s once the thread is closed so a stale tab cannot spend a token", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: USER_A });
    const closed = await request(testApp.app).post(
      `/api/me/connections/${id}/unmatch`,
    );
    expect(closed.status).toBe(200);
    const res = await request(testApp.app).post(
      `/api/me/connections/${id}/date-ideas`,
    );
    expect(res.status).toBe(409);
  });
});


describe("connection date and private debrief lifecycle", () => {
  it("persists plan, completion, member-private debrief, and tentative Echo learning", async () => {
    const id = await makeConnection();
    const plannedAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    testApp.setUser({ id: USER_A });
    const planned = await request(testApp.app)
      .patch(`/api/me/connections/${id}/date-state`)
      .send({ action: "plan", occurredAt: plannedAt });
    expect(planned.status).toBe(200);
    expect(planned.body.dateStage).toBe("date_planned");
    expect(planned.body.datePlannedAt).toBe(plannedAt);

    testApp.setUser({ id: USER_B });
    const sharedPlan = await request(testApp.app).get(
      `/api/me/connections/${id}`,
    );
    expect(sharedPlan.body.dateStage).toBe("date_planned");

    testApp.setUser({ id: USER_A });
    const completed = await request(testApp.app)
      .patch(`/api/me/connections/${id}/date-state`)
      .send({ action: "complete" });
    expect(completed.status).toBe(200);
    expect(completed.body.dateStage).toBe("date_completed");

    const saved = await request(testApp.app).post("/api/post-date-notes").send({
      connectionId: id,
      summary: "Conversation opened up once we stopped trying to impress each other.",
      whatWentWell: "Easy conversation, I felt like myself",
      whatDidnt: "Mixed signals at the end",
      outcome: "unsure",
    });
    expect(saved.status).toBe(201);
    expect(saved.body.connectionId).toBe(id);

    const mine = await request(testApp.app).get(
      `/api/me/connections/${id}`,
    );
    expect(mine.body.dateStage).toBe("debrief_saved");
    expect(mine.body.debriefNoteId).toBe(saved.body.id);

    const [learning] = await db
      .select()
      .from(wellnessInferencesTable)
      .where(eq(wellnessInferencesTable.userId, USER_A));
    expect(learning?.status).toBe("pending");
    expect(learning?.sourceKind).toBe("post_date");
    expect(learning?.inferredQuestionId).toBe(
      `inferred:post_date:${saved.body.id}`,
    );

    testApp.setUser({ id: USER_B });
    const theirs = await request(testApp.app).get(
      `/api/me/connections/${id}`,
    );
    expect(theirs.body.dateStage).toBe("date_completed");
    expect(theirs.body.debriefNoteId).toBeNull();
  });

  it("rejects outsiders, premature debriefs, and duplicate linked debriefs", async () => {
    const id = await makeConnection();
    testApp.setUser({ id: `conn-outsider-${suffix}` });
    const outsider = await request(testApp.app)
      .patch(`/api/me/connections/${id}/date-state`)
      .send({ action: "complete" });
    expect(outsider.status).toBe(404);

    testApp.setUser({ id: USER_A });
    const premature = await request(testApp.app)
      .post("/api/post-date-notes")
      .send({ connectionId: id, summary: "Not completed yet." });
    expect(premature.status).toBe(409);

    await request(testApp.app)
      .patch(`/api/me/connections/${id}/date-state`)
      .send({ action: "complete" });
    const first = await request(testApp.app)
      .post("/api/post-date-notes")
      .send({ connectionId: id, summary: "The real debrief." });
    expect(first.status).toBe(201);
    const duplicate = await request(testApp.app)
      .post("/api/post-date-notes")
      .send({ connectionId: id, summary: "A duplicate debrief." });
    expect(duplicate.status).toBe(409);
  });
});
