import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

// Deterministic webhook secret for the inbound tests. Set before the route
// module is imported so expectedWebhookSecret() reads it.
process.env.RECEIPTS_WEBHOOK_SECRET = "test-webhook-secret";

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
  const receiptsRouter = (await import("./receipts")).default;
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

  app.use("/api", receiptsRouter);

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
  testApp.setUser(null);
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

// The anon_claim cookie is set `secure`, which supertest drops over plain HTTP,
// so we resend the raw name=value pair by hand on follow-up requests.
function anonCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const raw = (setCookie ?? []).find((c) => c.startsWith("anon_claim="));
  return raw ? raw.split(";")[0] : "";
}

describe("GET /api/me/receipts", () => {
  it("returns an empty inbox for a brand-new anon visitor", async () => {
    const res = await request(testApp.app).get("/api/me/receipts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      handle: null,
      address: null,
      count: 0,
      recent: [],
    });
  });
});

describe("POST /api/me/receipts/activate", () => {
  it("mints a handle and address, and is idempotent", async () => {
    const first = await request(testApp.app).post("/api/me/receipts/activate");
    expect(first.status).toBe(200);
    expect(first.body.handle).toMatch(/^[a-f0-9]{12}$/);
    expect(first.body.address).toBe(`${first.body.handle}@receipts.matchlab.club`);
    expect(first.body.count).toBe(0);

    const cookie = anonCookie(first);
    const again = await request(testApp.app)
      .post("/api/me/receipts/activate")
      .set("Cookie", cookie);
    expect(again.status).toBe(200);
    // Same handle: activation does not mint a second address.
    expect(again.body.handle).toBe(first.body.handle);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter(
      (r) => r.source === "receipts",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("POST /api/me/receipts (manual)", () => {
  it("accumulates header-only entries newest-first and never stores a body", async () => {
    const first = await request(testApp.app)
      .post("/api/me/receipts")
      .send({
        entries: [
          {
            sender: "OpenTable",
            subject: "Your table for two is confirmed",
            receivedAt: "2026-05-01T19:00:00.000Z",
          },
        ],
      });
    expect(first.status).toBe(201);
    expect(first.body.count).toBe(1);
    expect(first.body.handle).toMatch(/^[a-f0-9]{12}$/);

    const cookie = anonCookie(first);
    const second = await request(testApp.app)
      .post("/api/me/receipts")
      .set("Cookie", cookie)
      .send({ entries: [{ subject: "Your subscription renews soon" }] });
    expect(second.status).toBe(201);
    expect(second.body.count).toBe(2);
    // Newest-first ordering.
    expect(second.body.recent[0].subject).toBe("Your subscription renews soon");
    expect(second.body.recent[1].sender).toBe("OpenTable");

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter(
      (r) => r.source === "receipts" && r.deletedAt == null,
    );
    // One accumulating row per owner, not one per paste.
    expect(rows).toHaveLength(1);
    const summary = rows[0].parsedSummary as Record<string, unknown>;
    const recent = summary.recent as Record<string, unknown>[];
    // Only headers are persisted: subject, sender, receivedAt. No body key.
    for (const entry of recent) {
      expect(Object.keys(entry).sort()).toEqual(["receivedAt", "sender", "subject"]);
    }
  });

  it("keys signed-in rows off the user id, not the anon cookie", async () => {
    testApp.setUser({ id: "user-receipts-1" });
    const res = await request(testApp.app)
      .post("/api/me/receipts")
      .send({ entries: [{ subject: "Flight booked" }] });
    expect(res.status).toBe(201);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter(
      (r) => r.source === "receipts",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user-receipts-1");
    expect(rows[0].anonymousClaimToken).toBeNull();
  });

  it("rejects a payload with no entries", async () => {
    const res = await request(testApp.app)
      .post("/api/me/receipts")
      .send({ entries: [] });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/receipts/inbound (webhook)", () => {
  it("rejects a missing or wrong shared secret", async () => {
    const noSecret = await request(testApp.app)
      .post("/api/receipts/inbound")
      .send({ to: "abc@receipts.matchlab.club", subject: "Hi" });
    expect(noSecret.status).toBe(401);

    const wrong = await request(testApp.app)
      .post("/api/receipts/inbound")
      .set("x-receipts-secret", "nope")
      .send({ to: "abc@receipts.matchlab.club", subject: "Hi" });
    expect(wrong.status).toBe(401);
  });

  it("accepts but does not capture an unknown handle, without leaking existence", async () => {
    const res = await request(testApp.app)
      .post("/api/receipts/inbound")
      .set("x-receipts-secret", "test-webhook-secret")
      .send({
        to: "000000000000@receipts.matchlab.club",
        from: "Someone",
        subject: "Stray confirmation",
      });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ received: false });
  });

  it("maps a known handle to its owner and accumulates one header-only entry", async () => {
    // Activate to mint a handle, then forward to it.
    const activated = await request(testApp.app).post("/api/me/receipts/activate");
    const cookie = anonCookie(activated);
    const handle: string = activated.body.handle;

    const inbound = await request(testApp.app)
      .post("/api/receipts/inbound")
      .set("x-receipts-secret", "test-webhook-secret")
      .send({
        to: `Receipts <${handle}@receipts.matchlab.club>`,
        from: "Airbnb",
        subject: "Your weekend trip is booked",
        date: "2026-05-21T14:42:00.000Z",
        // A provider may also post a body; it must be ignored, never stored.
        text: "Full reservation details and address here",
        html: "<p>secret body</p>",
      });
    expect(inbound.status).toBe(202);
    expect(inbound.body).toEqual({ received: true });

    const after = await request(testApp.app)
      .get("/api/me/receipts")
      .set("Cookie", cookie);
    expect(after.body.count).toBe(1);
    expect(after.body.recent[0].subject).toBe("Your weekend trip is booked");
    expect(after.body.recent[0].sender).toBe("Airbnb");

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter(
      (r) => r.source === "receipts" && r.deletedAt == null,
    );
    expect(rows).toHaveLength(1);
    const summary = JSON.stringify(rows[0].parsedSummary);
    // The body must never have been persisted.
    expect(summary).not.toContain("secret body");
    expect(summary).not.toContain("reservation details");
  });

  it("accumulates manual paste and a forwarded receipt into ONE row for the same owner", async () => {
    // Manual paste first mints the handle and the single accumulating row.
    const manual = await request(testApp.app)
      .post("/api/me/receipts")
      .send({ entries: [{ subject: "Dinner reservation confirmed" }] });
    const cookie = anonCookie(manual);
    const handle: string = manual.body.handle;
    expect(manual.body.count).toBe(1);

    // A forwarded email to the same handle lands in the same row, not a new one.
    const inbound = await request(testApp.app)
      .post("/api/receipts/inbound")
      .set("x-receipts-secret", "test-webhook-secret")
      .send({
        to: `${handle}@receipts.matchlab.club`,
        from: "Ticketmaster",
        subject: "Your concert tickets are ready",
      });
    expect(inbound.status).toBe(202);
    expect(inbound.body).toEqual({ received: true });

    const after = await request(testApp.app)
      .get("/api/me/receipts")
      .set("Cookie", cookie);
    expect(after.body.count).toBe(2);

    const { dumpTable } = await import("../lib/testDb");
    const rows = dumpTable("imported_sources").filter(
      (r) => r.source === "receipts" && r.deletedAt == null,
    );
    // Both paths target the SAME single row, never two competing rows.
    expect(rows).toHaveLength(1);
  });
});
