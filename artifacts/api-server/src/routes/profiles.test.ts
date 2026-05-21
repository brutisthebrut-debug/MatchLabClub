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

import {
  CreateProfileBody,
  GetProfileResponse,
  ListProfilesResponse,
  UpdateProfileResponse,
  RewriteProfileBioResponse,
} from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const profilesRouter = (await import("./profiles")).default;
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

  app.use("/api", profilesRouter);

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

// Scoped cleanup: snapshot row ids before each test, then in afterEach
// delete only the rows this test inserted. See `TESTING.md`.
let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const USER_ID = `test-profile-user-${crypto.randomBytes(6).toString("hex")}`;

const VALID_BODY = {
  platform: "Hinge",
  bio: "Yoga teacher who loves long hikes, sourdough, and slow Sundays. Looking for curiosity over cleverness.",
  prompts: "Best travel story: getting lost in Lisbon.\nA green flag I look for: admitting you don't know something.",
  photoCount: 5,
  notes: "Main profile, switched primary photo last week.",
};

async function createProfile(
  user: { id: string } | null = { id: USER_ID },
  overrides: Partial<typeof VALID_BODY> = {},
): Promise<number> {
  testApp.setUser(user);
  const res = await request(testApp.app)
    .post("/api/profiles")
    .send({ ...VALID_BODY, ...overrides });
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("POST /api/profiles", () => {
  it("returns 400 when the body fails Zod validation", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post("/api/profiles")
      .send({ platform: "Hinge" }); // missing bio
    expect(res.status).toBe(400);
  });

  it("creates a profile scoped to the authenticated user", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/profiles").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(() => GetProfileResponse.parse(res.body)).not.toThrow();
    expect(res.body.platform).toBe("Hinge");

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("profiles");
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe(USER_ID);
    expect(rows[0].anonymousClaimToken).toBeNull();
  });

  it("creates an anonymous profile and sets the anon_claim cookie when no user is signed in", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).post("/api/profiles").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(() => GetProfileResponse.parse(res.body)).not.toThrow();

    const setCookie = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
    expect(cookieHeader).toMatch(/anon_claim=/);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("profiles");
    expect(rows[0].userId).toBeNull();
    expect(rows[0].anonymousClaimToken).not.toBeNull();
  });

  it("CreateProfileBody zod schema accepts the same body the route accepts", () => {
    expect(() => CreateProfileBody.parse(VALID_BODY)).not.toThrow();
  });
});

describe("GET /api/profiles", () => {
  it("lists profiles scoped to the caller", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const mineId = await createProfile({ id: USER_ID });
    const theirsId = await createProfile({ id: otherUserId });

    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/profiles");
    expect(res.status).toBe(200);
    expect(() => ListProfilesResponse.parse(res.body)).not.toThrow();

    const ids = res.body.map((p: { id: number }) => p.id);
    expect(ids).toContain(mineId);
    expect(ids).not.toContain(theirsId);
  });

  it("returns an empty array when an anonymous caller has no profiles", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/profiles");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});

describe("GET /api/profiles/:id", () => {
  it("returns 400 on a non-numeric id", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get("/api/profiles/not-a-number");
    expect(res.status).toBe(400);
  });

  it("returns 404 when the profile isn't owned by the caller", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createProfile({ id: otherUserId });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get(`/api/profiles/${theirsId}`);
    expect(res.status).toBe(404);
  });

  it("returns the profile in the contract shape when owned", async () => {
    const id = await createProfile({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).get(`/api/profiles/${id}`);
    expect(res.status).toBe(200);
    expect(() => GetProfileResponse.parse(res.body)).not.toThrow();
    expect(res.body.id).toBe(id);
    expect(res.body.platform).toBe("Hinge");
  });
});

describe("PATCH /api/profiles/:id", () => {
  it("returns 400 on a non-numeric id", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .patch("/api/profiles/not-a-number")
      .send({ bio: "updated" });
    expect(res.status).toBe(400);
  });

  it("returns 400 on a bad body", async () => {
    const id = await createProfile({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .patch(`/api/profiles/${id}`)
      .send({ photoCount: "not-a-number" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching someone else's profile", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createProfile({ id: otherUserId });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .patch(`/api/profiles/${theirsId}`)
      .send({ bio: "I shouldn't be able to do this." });
    expect(res.status).toBe(404);

    // Confirm the row was not actually mutated.
    const { dumpTable } = await import("../lib/testDb");
    const row = dumpTable("profiles").find((r) => r.id === theirsId);
    expect(row?.bio).toBe(VALID_BODY.bio);
  });

  it("updates the caller's own profile in the contract shape", async () => {
    const id = await createProfile({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .patch(`/api/profiles/${id}`)
      .send({ bio: "Updated bio with more specificity." });
    expect(res.status).toBe(200);
    expect(() => UpdateProfileResponse.parse(res.body)).not.toThrow();
    expect(res.body.bio).toBe("Updated bio with more specificity.");
  });
});

describe("POST /api/profiles/:id/rewrite", () => {
  it("returns 400 on a non-numeric id", async () => {
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post("/api/profiles/not-a-number/rewrite").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when the profile isn't owned by the caller", async () => {
    const otherUserId = `other-${crypto.randomBytes(4).toString("hex")}`;
    const theirsId = await createProfile({ id: otherUserId });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app)
      .post(`/api/profiles/${theirsId}/rewrite`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("returns a rewrite matching RewriteProfileBioResponse for an owned profile", async () => {
    const id = await createProfile({ id: USER_ID });
    testApp.setUser({ id: USER_ID });
    const res = await request(testApp.app).post(`/api/profiles/${id}/rewrite`).send({});
    expect(res.status).toBe(200);
    expect(() => RewriteProfileBioResponse.parse(res.body)).not.toThrow();
    expect(res.body.profileId).toBe(id);
    expect(res.body.rewrittenBio.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.rewrittenPrompts)).toBe(true);
    expect(res.body.rewrittenPrompts.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.tips)).toBe(true);
    expect(res.body.tips.length).toBeGreaterThan(0);
  });
});
