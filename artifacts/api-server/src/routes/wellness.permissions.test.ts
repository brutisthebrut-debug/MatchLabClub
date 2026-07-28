import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";

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

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const wellnessRouter = (await import("./wellness")).default;
  const app = express();
  app.use(express.json());

  let currentUser: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      req.user = {
        id: currentUser.id,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
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
let dbSnapshot: Map<string, Set<unknown>>;

beforeAll(async () => {
  testApp = await makeTestApp();
});
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const answerInput = {
  questionId: "values.example",
  dimension: "values",
  questionText: "What matters most?",
  answer: "Being direct and kind.",
};

describe("wellness purpose permissions", () => {
  it("saves source material without silently granting any downstream use", async () => {
    testApp.setUser({ id: "permissions-create" });
    const res = await request(testApp.app)
      .post("/api/wellness/answers")
      .send({ ...answerInput, consentLevel: "all" });

    expect(res.status).toBe(201);
    expect(res.body.consentLevel).toBe("coaching");
    expect(res.body.permissions).toEqual({
      echo: false,
      mirror: false,
      matching: false,
      research: false,
    });
  });

  it("requires Mirror confirmation before matching use and audits explicit grants", async () => {
    const { db, wellnessAnswersTable, dumpTable } = await import(
      "../lib/testDb"
    );
    const [answer] = await db
      .insert(wellnessAnswersTable)
      .values({ userId: "permissions-grant", ...answerInput })
      .returning();
    testApp.setUser({ id: "permissions-grant" });

    const blocked = await request(testApp.app)
      .patch(`/api/wellness/answers/${answer!.id}/permissions`)
      .send({ matching: true });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toContain("Mirror");

    const granted = await request(testApp.app)
      .patch(`/api/wellness/answers/${answer!.id}/permissions`)
      .send({ echo: true, mirror: true, matching: true });
    expect(granted.status).toBe(200);
    expect(granted.body.permissions).toEqual({
      echo: true,
      mirror: true,
      matching: true,
      research: false,
    });

    const events = dumpTable("data_permission_events");
    expect(events).toHaveLength(3);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "echo",
          granted: true,
          actorType: "member",
        }),
        expect.objectContaining({
          purpose: "mirror",
          granted: true,
          actorType: "member",
        }),
        expect.objectContaining({
          purpose: "matching",
          granted: true,
          actorType: "member",
        }),
      ]),
    );
  });

  it("cascades matching off when Mirror is revoked", async () => {
    const { db, wellnessAnswersTable, dumpTable } = await import(
      "../lib/testDb"
    );
    const [answer] = await db
      .insert(wellnessAnswersTable)
      .values({
        userId: "permissions-revoke",
        ...answerInput,
        mirrorConfirmed: true,
        matchingUseApproved: true,
      })
      .returning();
    testApp.setUser({ id: "permissions-revoke" });

    const res = await request(testApp.app)
      .patch(`/api/wellness/answers/${answer!.id}/permissions`)
      .send({ mirror: false });
    expect(res.status).toBe(200);
    expect(res.body.permissions.mirror).toBe(false);
    expect(res.body.permissions.matching).toBe(false);

    const events = dumpTable("data_permission_events");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "mirror",
          actorType: "member",
          granted: false,
        }),
        expect.objectContaining({
          purpose: "matching",
          actorType: "system",
          reason: "matching_revoked_with_mirror",
          granted: false,
        }),
      ]),
    );
  });

  it("invalidates every prior approval when answer content changes", async () => {
    const { db, wellnessAnswersTable, dumpTable } = await import(
      "../lib/testDb"
    );
    const [answer] = await db
      .insert(wellnessAnswersTable)
      .values({
        userId: "permissions-edit",
        ...answerInput,
        echoUseApproved: true,
        mirrorConfirmed: true,
        matchingUseApproved: true,
        researchUseApproved: true,
      })
      .returning();
    testApp.setUser({ id: "permissions-edit" });

    const res = await request(testApp.app)
      .patch(`/api/wellness/answers/${answer!.id}`)
      .send({ answer: "Being direct, kind, and willing to repair." });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual({
      echo: false,
      mirror: false,
      matching: false,
      research: false,
    });
    expect(dumpTable("data_permission_events")).toHaveLength(4);
  });

  it("purges the permission trail when the member deletes the source", async () => {
    const {
      db,
      dataPermissionEventsTable,
      wellnessAnswersTable,
      dumpTable,
    } = await import("../lib/testDb");
    const [answer] = await db
      .insert(wellnessAnswersTable)
      .values({
        userId: "permissions-delete",
        ...answerInput,
        mirrorConfirmed: true,
      })
      .returning();
    await db.insert(dataPermissionEventsTable).values({
      userId: "permissions-delete",
      resourceType: "wellness_answer",
      resourceId: String(answer!.id),
      purpose: "mirror",
      granted: true,
      actorType: "member",
    });
    testApp.setUser({ id: "permissions-delete" });

    const res = await request(testApp.app).delete(
      `/api/wellness/answers/${answer!.id}`,
    );
    expect(res.status).toBe(200);
    expect(dumpTable("data_permission_events")).toHaveLength(0);
    expect(dumpTable("wellness_answers")[0]).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        mirrorConfirmed: false,
      }),
    );
  });
});
