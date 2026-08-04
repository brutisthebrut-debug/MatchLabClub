import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
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

vi.mock("../lib/aiService", () => ({
  generate: vi.fn(),
}));

import type { AuthUser } from "@workspace/api-zod";
import { generate } from "../lib/aiService";

const generateMock = vi.mocked(generate);

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const safetyRouter = (await import("./safety")).default;
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

  app.use("/api", safetyRouter);

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
  generateMock.mockReset();
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const suffix = crypto.randomBytes(6).toString("hex");
const USER_A = `safety-a-${suffix}`;
const USER_B = `safety-b-${suffix}`;

describe("POST /api/me/safety/report", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "harassment" });
    expect(res.status).toBe(401);
  });

  it("400s when reporting yourself", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_A, reason: "harassment" });
    expect(res.status).toBe(400);
  });

  it("400s on an unknown reason", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "not-a-real-reason" });
    expect(res.status).toBe(400);
  });

  it("files a report and returns its id", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reportedUserId: USER_B, reason: "scam", context: "match" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.reportId).toBe("number");
  });

  it("400s on a member report with no reported member", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/report")
      .send({ reason: "harassment" });
    expect(res.status).toBe(400);
  });

  it("files an off-platform conversation report with no reportedUserId", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app).post("/api/me/safety/report").send({
      subjectType: "off_platform",
      reason: "scam",
      context: "conversation",
      externalApp: "Hinge",
      externalLabel: "Alex",
      note: "Coach flagged an elevated romance-scam pattern.",
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.reportId).toBe("number");
  });

  it("stores off-platform reports with no platform member, app, and label", async () => {
    testApp.setUser({ id: USER_A });
    const { dumpTable } = await import("../lib/testDb");
    await request(testApp.app).post("/api/me/safety/report").send({
      subjectType: "off_platform",
      reason: "scam",
      externalApp: "Tinder",
      externalLabel: "Jordan",
    });
    const rows = (
      dumpTable("user_reports") as Array<{
        reporterUserId: string;
        reportedUserId: string | null;
        subjectType: string;
        externalApp: string | null;
        externalLabel: string | null;
        context: string | null;
      }>
    ).filter(
      (r) => r.reporterUserId === USER_A && r.subjectType === "off_platform",
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const last = rows[rows.length - 1];
    expect(last.reportedUserId).toBeNull();
    expect(last.externalApp).toBe("Tinder");
    expect(last.externalLabel).toBe("Jordan");
    // Context defaults to "conversation" for off-platform reports.
    expect(last.context).toBe("conversation");
  });
});

describe("safety block / list / unblock", () => {
  it("401s for an anonymous caller blocking", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });
    expect(res.status).toBe(401);
  });

  it("400s when blocking yourself", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_A });
    expect(res.status).toBe(400);
  });

  it("blocks, lists, and is idempotent", async () => {
    testApp.setUser({ id: USER_A });
    const first = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B, reason: "harassment" });
    expect(first.status).toBe(201);
    expect(first.body.blockedUserId).toBe(USER_B);

    // Blocking again must not create a duplicate row.
    const second = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });
    expect(second.status).toBe(201);

    const list = await request(testApp.app).get("/api/me/safety/block");
    expect(list.status).toBe(200);
    const mine = list.body.blocks.filter(
      (b: { blockedUserId: string }) => b.blockedUserId === USER_B,
    );
    expect(mine.length).toBe(1);
  });

  it("closes a live connection and removes both proposal directions", async () => {
    const {
      db,
      dumpTable,
      matchConnectionsTable,
      matchProposalsTable,
      orderConnectionPair,
    } = await import("../lib/testDb");
    const pair = orderConnectionPair(USER_A, USER_B);
    await db.insert(matchConnectionsTable).values({
      userLowId: pair.userLowId,
      userHighId: pair.userHighId,
      status: "active",
    });
    await db.insert(matchProposalsTable).values([
      {
        userId: USER_A,
        proposedToUserId: USER_B,
        source: "internal",
        compatibilityScore: 80,
        status: "mutual_yes",
      },
      {
        userId: USER_B,
        proposedToUserId: USER_A,
        source: "internal",
        compatibilityScore: 80,
        status: "mutual_yes",
      },
    ]);

    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B, reason: "harassment" });
    expect(res.status).toBe(201);

    const [connection] = dumpTable("match_connections");
    expect(connection?.status).toBe("closed");
    expect(connection?.closedReason).toBe("block");
    expect(connection?.closedByUserId).toBe(USER_A);
    expect(dumpTable("match_proposals")).toHaveLength(0);
  });

  it("unblocks and is idempotent for a non-existent block", async () => {
    testApp.setUser({ id: USER_A });
    await request(testApp.app)
      .post("/api/me/safety/block")
      .send({ blockedUserId: USER_B });

    const undo = await request(testApp.app).delete(
      `/api/me/safety/block/${USER_B}`,
    );
    expect(undo.status).toBe(200);
    expect(undo.body.ok).toBe(true);

    const list = await request(testApp.app).get("/api/me/safety/block");
    const mine = list.body.blocks.filter(
      (b: { blockedUserId: string }) => b.blockedUserId === USER_B,
    );
    expect(mine.length).toBe(0);

    // Undoing again on an already-removed block still returns ok.
    const again = await request(testApp.app).delete(
      `/api/me/safety/block/${USER_B}`,
    );
    expect(again.status).toBe(200);
    expect(again.body.ok).toBe(true);
  });
});

describe("POST /api/me/safety/message-check", () => {
  it("401s for an anonymous caller", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({ draft: "Hey, want to grab coffee this weekend?" });
    expect(res.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("400s when the draft is missing", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns a clean read on a normal draft without touching the deep lane", async () => {
    testApp.setUser({ id: USER_A });
    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({ draft: "Excited for Saturday. What time works for you?" });
    expect(res.status).toBe(200);
    expect(res.body.risk).toBe("none");
    expect(Array.isArray(res.body.signals)).toBe(true);
    expect(typeof res.body.advice).toBe("string");
    // A clean draft never reaches Claude, so it never burns a credit.
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("flags an elevated risk on a financial draft and falls back to the deterministic baseline", async () => {
    testApp.setUser({ id: USER_A });
    generateMock.mockResolvedValue({
      output: "",
      isFallback: true,
      validated: false,
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);

    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({
        draft:
          "Okay, I will send the gift card and wire transfer the money tonight.",
      });
    expect(res.status).toBe(200);
    expect(res.body.risk).toBe("elevated");
    expect(res.body.signals.length).toBeGreaterThan(0);
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("refines the read with the deep lane when consent is on", async () => {
    testApp.setUser({ id: USER_A });
    generateMock.mockResolvedValue({
      output: JSON.stringify({
        risk: "elevated",
        signals: ["They are pushing you to move money before you have met."],
        advice:
          "Hold off on sending anything. Suggest a quick video call first, and never send money to someone you have not met in person.",
      }),
      isFallback: false,
      validated: true,
    } as Awaited<ReturnType<typeof generate>>);

    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({
        draft: "Sure, I can send you the bitcoin you asked for.",
        conversationContext: "Them: I need you to invest in crypto with me.",
      });
    expect(res.status).toBe(200);
    expect(res.body.risk).toBe("elevated");
    expect(res.body.advice).toContain("video call");
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the deterministic baseline when the deep lane throws", async () => {
    testApp.setUser({ id: USER_A });
    generateMock.mockRejectedValue(new Error("provider exploded"));

    const res = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({ draft: "I will wire the money through western union now." });
    expect(res.status).toBe(200);
    expect(res.body.risk).toBe("elevated");
  });

  it("never uses an em dash in the deterministic advice", async () => {
    testApp.setUser({ id: USER_A });
    const clean = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({ draft: "Looking forward to meeting you for dinner." });
    expect(clean.body.advice).not.toContain("\u2014");

    generateMock.mockResolvedValue({
      output: "",
      isFallback: true,
      validated: false,
      fallbackReason: "consent_required",
    } as Awaited<ReturnType<typeof generate>>);
    const flagged = await request(testApp.app)
      .post("/api/me/safety/message-check")
      .send({ draft: "I will send the gift card now." });
    expect(flagged.body.advice).not.toContain("\u2014");
  });
});
