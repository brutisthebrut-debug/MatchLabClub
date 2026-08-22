import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

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
  const meImportsRouter = (await import("./meImports")).default;
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

  app.use("/api", meImportsRouter);

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

// Scoped cleanup: snapshot row ids before each test, then delete only the rows
// this test inserted. See `TESTING.md`.
let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
  testApp.setUser(null);
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

// Extract the `anon_claim` cookie from a response so it can be forwarded on a
// follow-up request. The cookie is set `secure`, which supertest's agent drops
// over plain HTTP, so we resend the raw name=value pair by hand.
function anonCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const raw = (setCookie ?? []).find((c) => c.startsWith("anon_claim="));
  return raw ? raw.split(";")[0] : "";
}

const VALID = {
  slug: "love-pace",
  answers: [1, 1, 1, 1, 1],
};

describe("POST /api/me/quiz-result", () => {
  it("stores a derived-only signal and stamps the anon claim cookie for anon users", async () => {
    const res = await request(testApp.app).post("/api/me/quiz-result").send(VALID);

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("love-pace");
    expect(res.body.archetypeKey).toBe("steady");
    expect(res.body.archetypeName).toBe("The Steady");
    expect(res.body.dimensions).toEqual([
      "intimacy.pace",
      "communication.tempo",
      "affection.style",
    ]);
    expect(res.body.distinctQuizzes).toBe(1);
    expect(res.body.status).toBe("complete");

    const cookieHeader = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookieHeader).toMatch(/anon_claim=/);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter((r) => r.source === "quiz");
    expect(rows).toHaveLength(1);
    const summary = rows[0].parsedSummary as Record<string, unknown>;
    // Derived signal only: which quiz, which archetype, which dimensions. The raw
    // answer choices are never persisted, so the stored summary has no answer keys.
    expect(summary).toEqual({
      slug: "love-pace",
      archetypeKey: "steady",
      archetype: "The Steady",
      dimensions: [
        "intimacy.pace",
        "communication.tempo",
        "affection.style",
      ],
      counts: { quizzes: 1 },
    });
    expect(rows[0].userId).toBeNull();
    expect(rows[0].anonymousClaimToken).not.toBeNull();
    expect(rows[0].echoUseAllowed).toBe(false);
    expect(rows[0].learningConfirmed).toBe(false);
    expect(rows[0].matchingUseAllowed).toBe(false);
  });

  it("keys signed-in rows off the user id, not the anon cookie", async () => {
    testApp.setUser({ id: "user-123" });
    const res = await request(testApp.app).post("/api/me/quiz-result").send(VALID);

    expect(res.status).toBe(201);
    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter((r) => r.source === "quiz");
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user-123");
    expect(rows[0].anonymousClaimToken).toBeNull();
  });

  it("dedupes retakes of the same quiz so the distinct count does not inflate", async () => {
    const first = await request(testApp.app).post("/api/me/quiz-result").send(VALID);
    expect(first.body.distinctQuizzes).toBe(1);
    const cookie = anonCookie(first);

    // Retake the same slug with answers that score a different archetype: the prior row is soft-
    // deleted and the count stays at one distinct quiz.
    const retake = await request(testApp.app)
      .post("/api/me/quiz-result")
      .set("Cookie", cookie)
      .send({ slug: "love-pace", answers: [0, 0, 0, 0, 0] });
    expect(retake.body.distinctQuizzes).toBe(1);

    const { dumpTable } = await import("../lib/testDb");
    const live = dumpTable("imported_sources").filter(
      (r) => r.source === "quiz" && r.deletedAt == null,
    );
    expect(live).toHaveLength(1);
    expect((live[0].parsedSummary as Record<string, unknown>).archetype).toBe(
      "The Freefaller",
    );
  });

  it("counts distinct quizzes across different slugs", async () => {
    const first = await request(testApp.app).post("/api/me/quiz-result").send(VALID);
    const cookie = anonCookie(first);

    const second = await request(testApp.app)
      .post("/api/me/quiz-result")
      .set("Cookie", cookie)
      .send({ slug: "conflict-instinct", answers: [0, 0, 0, 0, 0, 0] });

    expect(second.status).toBe(201);
    expect(second.body.distinctQuizzes).toBe(2);
  });

  it("derives identity on the server and ignores forged result fields", async () => {
    const res = await request(testApp.app)
      .post("/api/me/quiz-result")
      .send({
        ...VALID,
        archetypeKey: "freefaller",
        archetypeName: "A forged result",
        dimensions: ["forged.dimension"],
      });

    expect(res.status).toBe(201);
    expect(res.body.archetypeKey).toBe("steady");
    expect(res.body.archetypeName).toBe("The Steady");
    expect(res.body.dimensions).not.toContain("forged.dimension");
  });

  it("rejects unknown quizzes and incomplete or out-of-range answers", async () => {
    const unknown = await request(testApp.app)
      .post("/api/me/quiz-result")
      .send({ slug: "made-up-quiz", answers: [0] });
    expect(unknown.status).toBe(400);

    const incomplete = await request(testApp.app)
      .post("/api/me/quiz-result")
      .send({ slug: "love-pace", answers: [1, 1] });
    expect(incomplete.status).toBe(400);

    const outOfRange = await request(testApp.app)
      .post("/api/me/quiz-result")
      .send({ slug: "love-pace", answers: [1, 1, 99, 1, 1] });
    expect(outOfRange.status).toBe(400);
  });

  it("rejects an empty slug with a 400", async () => {
    const res = await request(testApp.app)
      .post("/api/me/quiz-result")
      .send({ slug: "", answers: [1, 1, 1, 1, 1] });
    expect(res.status).toBe(400);
  });
});
