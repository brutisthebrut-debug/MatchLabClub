import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import type { AuthUser } from "@workspace/api-zod";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, eq: fake.eq, and: fake.and, desc: fake.desc };
});
vi.mock("./mirror", () => ({
  default: express.Router(),
  loadMirrorPortrait: vi.fn(async () => ({
    known: [
      {
        key: "communication",
        label: "How you communicate",
        insight: "You tend to name what you need directly.",
        confidence: 78,
      },
    ],
  })),
}));

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const router = (await import("./mirrorLearnings")).default;
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
    // @ts-expect-error test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", router);
  return { app, setUser: (user) => { currentUser = user; } };
}

let testApp: TestApp;
let dbSnapshot: Map<string, Set<unknown>>;

beforeAll(async () => { testApp = await makeTestApp(); });
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

describe("Mirror learning lifecycle", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    expect((await request(testApp.app).get("/api/me/mirror-learnings")).status).toBe(401);
    expect((await request(testApp.app).post("/api/me/mirror-learnings/sync")).status).toBe(401);
  });

  it("turns a real portrait theme into an owner-scoped proposal", async () => {
    testApp.setUser({ id: "learning-a" });
    const sync = await request(testApp.app).post("/api/me/mirror-learnings/sync");
    expect(sync.status).toBe(200);
    expect(sync.body.learnings).toHaveLength(1);
    expect(sync.body.learnings[0]).toMatchObject({
      status: "proposed",
      matchingUseApproved: false,
      confidence: 78,
      source: { type: "mirror_portrait", ref: "communication" },
    });

    testApp.setUser({ id: "learning-b" });
    const other = await request(testApp.app).get("/api/me/mirror-learnings");
    expect(other.body.learnings).toEqual([]);
  });

  it("keeps confirmation and matching use as separate decisions", async () => {
    testApp.setUser({ id: "learning-confirm" });
    const sync = await request(testApp.app).post("/api/me/mirror-learnings/sync");
    const id = sync.body.learnings[0].id;

    const premature = await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "set_matching", approved: true });
    expect(premature.status).toBe(409);

    const confirmed = await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "confirm" });
    expect(confirmed.body.status).toBe("confirmed");
    expect(confirmed.body.matchingUseApproved).toBe(false);

    const approved = await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "set_matching", approved: true });
    expect(approved.body.matchingUseApproved).toBe(true);
  });

  it("returns a correction to proposed and pauses active candidacy", async () => {
    const { db, matchPoolMembershipTable } = await import("../lib/testDb");
    testApp.setUser({ id: "learning-revise" });
    await db.insert(matchPoolMembershipTable).values({
      userId: "learning-revise",
      status: "ready",
      pausedReason: null,
    });
    const sync = await request(testApp.app).post("/api/me/mirror-learnings/sync");
    const id = sync.body.learnings[0].id;
    await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "confirm" });
    await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "set_matching", approved: true });

    const revised = await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "revise", learning: "I communicate directly once trust is established." });
    expect(revised.body).toMatchObject({
      status: "proposed",
      memberLearning: null,
      matchingUseApproved: false,
      proposedLearning: "I communicate directly once trust is established.",
    });

    const membership = await db.select().from(matchPoolMembershipTable);
    expect(membership[0]).toMatchObject({
      status: "paused",
      pausedReason: "A matching-approved Mirror learning needs review.",
    });
  });

  it("dismisses without turning an observation into durable truth", async () => {
    testApp.setUser({ id: "learning-dismiss" });
    const sync = await request(testApp.app).post("/api/me/mirror-learnings/sync");
    const id = sync.body.learnings[0].id;
    const dismissed = await request(testApp.app)
      .patch(`/api/me/mirror-learnings/${id}`)
      .send({ action: "dismiss" });
    expect(dismissed.body).toMatchObject({
      status: "dismissed",
      memberLearning: null,
      matchingUseApproved: false,
    });
  });

  it("derives a Care Dialect proposal from the saved server record", async () => {
    const { db, careDialectProfilesTable } = await import("../lib/testDb");
    testApp.setUser({ id: "learning-care" });
    await db.insert(careDialectProfilesTable).values({
      userId: "learning-care",
      testedGiveTop: "helpingHands",
      testedGiveDist: { helpingHands: 0.6 },
      testedReceiveTop: "undividedTime",
      testedReceiveDist: { undividedTime: 0.8 },
    });
    const response = await request(testApp.app)
      .post("/api/me/mirror-learnings/communication")
      .send({ source: "care_dialect" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "proposed",
      matchingUseApproved: false,
      confidence: 70,
      source: {
        type: "relationship_language",
        ref: "care-dialect",
      },
    });
    expect(response.body.proposedLearning).toMatch(/helping hands/i);
    expect(response.body.proposedLearning).toMatch(/undivided time/i);
  });

  it("derives standards only from the member's saved flag selection", async () => {
    const { db, flagSelectionsTable } = await import("../lib/testDb");
    testApp.setUser({ id: "learning-standards" });
    const empty = await request(testApp.app)
      .post("/api/me/mirror-learnings/communication")
      .send({ source: "standards" });
    expect(empty.status).toBe(422);

    await db.insert(flagSelectionsTable).values({
      userId: "learning-standards",
      bringFlags: ["communicates-openly"],
      seekFlags: ["respects-boundaries"],
    });
    const response = await request(testApp.app)
      .post("/api/me/mirror-learnings/communication")
      .send({ source: "standards" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      confidence: 100,
      source: { ref: "relationship-standards" },
    });
    expect(response.body.observation).toMatch(/communicates openly/i);
  });

  it("derives a review proposal from a saved Connection Style source", async () => {
    const { db, communicationRecordsTable } = await import("../lib/testDb");
    testApp.setUser({ id: "learning-style" });
    await db.insert(communicationRecordsTable).values({
      userId: "learning-style",
      lens: "connection_style",
      input: { answers: [0, 1, 2, 3, 0, 1] },
      result: { name: "Secure Builder", activationPattern: "You invest steadily when interest is mutual." },
      generatedBy: "deterministic",
      confidence: 100,
    });
    const response = await request(testApp.app)
      .post("/api/me/mirror-learnings/communication")
      .send({ source: "connection_style" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "proposed",
      matchingUseApproved: false,
      source: { ref: "connection-style", type: "relationship_language" },
    });
    expect(response.body.proposedLearning).toMatch(/Secure Builder/);
  });
});
