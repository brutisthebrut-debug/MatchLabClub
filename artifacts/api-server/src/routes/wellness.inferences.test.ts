import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

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

import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const wellnessRouter = (await import("./wellness")).default;
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

  app.use("/api", wellnessRouter);

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

const USER = `test-infer-user-${crypto.randomBytes(6).toString("hex")}`;

// The user's own line carries a physical signal ("gym"). The conversation
// context is the counterpart's words and carries a financial signal ("budget",
// "saving") that appears NOWHERE in the user's own message.
const OWN_LINE = "I finally got back to the gym this week and it felt amazing.";
const COUNTERPART_LINE =
  "She told me she is on a tight budget and saving hard for a house deposit.";

describe("POST /api/me/wellness/inferences/generate — counterpart-leak guard", () => {
  it("never turns the counterpart's conversation context into a candidate", async () => {
    const { db, messageCoachingSessionsTable } = await import("../lib/testDb");
    await db.insert(messageCoachingSessionsTable).values({
      userId: USER,
      matchName: "Sam",
      conversationContext: COUNTERPART_LINE,
      yourLastMessage: OWN_LINE,
    });

    testApp.setUser({ id: USER });
    const res = await request(testApp.app).post("/api/me/wellness/inferences/generate").send({});

    expect(res.status).toBe(200);
    const inferences = res.body.inferences as Array<{
      dimension: string;
      suggestedAnswer: string;
      sourceKind: string;
    }>;
    expect(Array.isArray(inferences)).toBe(true);
    expect(inferences.length).toBeGreaterThan(0);

    // The user's own line is fair game: it should surface a physical candidate.
    const dims = inferences.map((c) => c.dimension);
    expect(dims).toContain("physical");

    // The counterpart's financial signal must NOT have been read.
    expect(dims).not.toContain("financial");

    // And no candidate text may echo the counterpart's words.
    for (const c of inferences) {
      expect(c.sourceKind).toBe("coach");
      const answer = c.suggestedAnswer.toLowerCase();
      expect(answer).not.toContain("budget");
      expect(answer).not.toContain("saving");
      expect(answer).not.toContain("house deposit");
    }
  });

  it("returns 401 for anonymous callers", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/me/wellness/inferences/generate").send({});
    expect(res.status).toBe(401);
  });
});

describe("wellness permission separation", () => {
  const USER_ID = `test-wellness-permissions-${crypto.randomBytes(6).toString("hex")}`;
  const answerBody = {
    questionId: "values.permission-test",
    dimension: "values",
    category: "priorities",
    questionText: "What matters most to you?",
    answer: "Kindness and honesty.",
  };

  it("saves new answers for coaching only unless matching use is explicit", async () => {
    testApp.setUser({ id: USER_ID });

    const created = await request(testApp.app)
      .post("/api/wellness/answers")
      .send(answerBody);
    expect(created.status).toBe(201);
    expect(created.body.consentLevel).toBe("coaching");

    const updated = await request(testApp.app)
      .patch(`/api/wellness/answers/${created.body.id}`)
      .send({ consentLevel: "matching" });
    expect(updated.status).toBe(200);
    expect(updated.body.consentLevel).toBe("matching");
  });

  it("honors an explicit matching scope on capture", async () => {
    testApp.setUser({ id: USER_ID });
    const created = await request(testApp.app)
      .post("/api/wellness/answers")
      .send({
        ...answerBody,
        questionId: "values.explicit-matching-test",
        consentLevel: "matching",
      });

    expect(created.status).toBe(201);
    expect(created.body.consentLevel).toBe("matching");
  });

  it("keeps confirmed learning coaching-only until matching is separately allowed", async () => {
    const { db, wellnessAnswersTable, wellnessInferencesTable } = await import(
      "../lib/testDb"
    );
    const [inference] = await db
      .insert(wellnessInferencesTable)
      .values({
        userId: USER_ID,
        dimension: "emotional",
        inferredQuestionId: "inferred:emotional:permission-test",
        questionText: "How do you recover after conflict?",
        suggestedAnswer: "I need a short pause before repairing.",
        sourceKind: "journal",
        rationale: "A repeated self-described pattern.",
        mode: "deterministic",
        status: "pending",
      })
      .returning();

    testApp.setUser({ id: USER_ID });
    const confirmed = await request(testApp.app)
      .post(`/api/me/wellness/inferences/${inference!.id}/confirm`)
      .send({});

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.answer.consentLevel).toBe("coaching");

    const answers = await db.select().from(wellnessAnswersTable);
    const stored = answers.find(
      (row) =>
        row.userId === USER_ID &&
        row.questionId === "inferred:emotional:permission-test",
    );
    expect(stored?.consentLevel).toBe("coaching");
  });
});
