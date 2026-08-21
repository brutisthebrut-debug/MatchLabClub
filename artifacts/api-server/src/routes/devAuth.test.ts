import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import express, { type Express } from "express";
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

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ALLOW_DEV_AUTH = process.env.ALLOW_DEV_AUTH;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Minimal req.log so the route's structured logging works.
  app.use((req, _res, next) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  return app;
}

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "development";
  process.env.ALLOW_DEV_AUTH = "true";
  const { default: devAuthRouter } = await import("./devAuth");
  app = makeApp();
  app.use("/api", devAuthRouter);
});

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  process.env.ALLOW_DEV_AUTH = ORIGINAL_ALLOW_DEV_AUTH;
});

beforeEach(async () => {
  process.env.NODE_ENV = "development";
  process.env.ALLOW_DEV_AUTH = "true";
  const { resetTestDb } = await import("../lib/testDb");
  resetTestDb();
});

describe("dev test-user preview", () => {
  it("serves the dev index page in development", async () => {
    const res = await request(app).get("/api/dev");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Test user preview");
  });

  it("logs in as the power user and sets a session cookie", async () => {
    const res = await request(app).get("/api/dev/login?state=power");
    expect(res.status).toBe(302);
    expect(res.headers["location"]).toBe("/");
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toMatch(/^sid=/);

    const { dumpTable } = await import("../lib/testDb");
    // The power user row exists and a session was created for it.
    const users = dumpTable("users");
    expect(users.some((u) => u.id === "dev-test-power")).toBe(true);
    expect(dumpTable("sessions").length).toBe(1);
    // Signals were seeded across the registry lanes.
    expect(dumpTable("wellness_answers").length).toBeGreaterThan(0);
    expect(dumpTable("compatibility_reads").length).toBe(5);
    expect(dumpTable("journal_entries").length).toBe(10);
    expect(dumpTable("dating_wins").length).toBe(5);
    expect(dumpTable("life_pulses").length).toBe(7);
  });

  it("logs in as the new user with no seeded signals", async () => {
    const res = await request(app).get("/api/dev/login?state=new");
    expect(res.status).toBe(302);

    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("users").some((u) => u.id === "dev-test-new")).toBe(true);
    expect(dumpTable("wellness_answers").length).toBe(0);
    expect(dumpTable("compatibility_reads").length).toBe(0);
    expect(dumpTable("journal_entries").length).toBe(0);
  });

  it("re-seeding is idempotent: power then new leaves the new user empty", async () => {
    await request(app).get("/api/dev/login?state=power");
    await request(app).get("/api/dev/login?state=new");
    const { dumpTable } = await import("../lib/testDb");
    // power user's signals remain (different user id)...
    expect(dumpTable("journal_entries").length).toBe(10);
    // ...and the new user has none of their own.
    const newUserJournals = dumpTable("journal_entries").filter(
      (r) => r.userId === "dev-test-new",
    );
    expect(newUserJournals.length).toBe(0);
  });

  it("defaults to the power state when state is missing or unknown", async () => {
    const res = await request(app).get("/api/dev/login");
    expect(res.status).toBe(302);
    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("users").some((u) => u.id === "dev-test-power")).toBe(true);
  });

  it("ignores an unsafe returnTo and falls back to /", async () => {
    const res = await request(app).get(
      "/api/dev/login?state=new&returnTo=//evil.example.com",
    );
    expect(res.status).toBe(302);
    expect(res.headers["location"]).toBe("/");
  });

  it("404s every dev route unless development auth is explicitly enabled", async () => {
    delete process.env.ALLOW_DEV_AUTH;
    const index = await request(app).get("/api/dev");
    expect(index.status).toBe(404);
    const login = await request(app).get("/api/dev/login?state=power");
    expect(login.status).toBe(404);
    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("users").length).toBe(0);
    expect(dumpTable("sessions").length).toBe(0);
  });
  it("404s every dev route in production", async () => {
    process.env.NODE_ENV = "production";
    const index = await request(app).get("/api/dev");
    expect(index.status).toBe(404);
    const login = await request(app).get("/api/dev/login?state=power");
    expect(login.status).toBe(404);
    // Nothing was seeded and no session was created.
    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("users").length).toBe(0);
    expect(dumpTable("sessions").length).toBe(0);
  });
});
