import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import {
  db,
  pool,
  dataExportTokensTable,
  usersTable,
} from "@workspace/db";
import accountRouter from "./account";

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", accountRouter);
  return app;
}

let app: Express;

beforeAll(() => {
  app = makeTestApp();
});

afterAll(async () => {
  await pool.end();
});

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const DOWNLOAD_PATH = "/api/account/export/download";

const EXPIRED_HEADING_RE = /can(?:&rsquo;|')t be used anymore/;
const ACCOUNT_LINK_RE = /href="[^"]*\/account"/;

describe("GET /api/account/export/download/:token", () => {
  describe("malformed token", () => {
    it("returns 410 HTML expired page when Accept: text/html", async () => {
      const res = await request(app)
        .get(`${DOWNLOAD_PATH}/not-a-real-token!!!`)
        .set("Accept", "text/html");

      expect(res.status).toBe(410);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toMatch(EXPIRED_HEADING_RE);
      expect(res.text).toMatch(ACCOUNT_LINK_RE);
    });

    it("returns 404 JSON when Accept is not text/html", async () => {
      const res = await request(app)
        .get(`${DOWNLOAD_PATH}/not-a-real-token!!!`)
        .set("Accept", "application/json");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Invalid or expired link." });
    });
  });

  describe("missing or used token row", () => {
    it("returns 410 HTML expired page when Accept: text/html", async () => {
      // A well-formed hex token that simply isn't in the database.
      const orphan = makeToken();
      const res = await request(app)
        .get(`${DOWNLOAD_PATH}/${orphan}`)
        .set("Accept", "text/html");

      expect(res.status).toBe(410);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toMatch(EXPIRED_HEADING_RE);
      expect(res.text).toMatch(ACCOUNT_LINK_RE);
    });

    it("returns 404 JSON for a missing row without Accept: text/html", async () => {
      const orphan = makeToken();
      const res = await request(app)
        .get(`${DOWNLOAD_PATH}/${orphan}`)
        .set("Accept", "application/json");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Invalid or expired link." });
    });

    it("returns 404 JSON when the token has already been used", async () => {
      const userId = `test-acct-${crypto.randomBytes(6).toString("hex")}`;
      const token = makeToken();
      try {
        await db.insert(usersTable).values({ id: userId, email: null });
        await db.insert(dataExportTokensTable).values({
          token,
          userId,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: new Date(Date.now() - 1_000),
        });

        const res = await request(app)
          .get(`${DOWNLOAD_PATH}/${token}`)
          .set("Accept", "application/json");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Invalid or expired link." });
      } finally {
        // FK cascade also wipes the token row.
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    });
  });

  describe("token row exists but the user payload is missing", () => {
    // Reaches the third sendExpiredExport branch — the UPDATE finds and
    // marks the token used, but buildExportPayload returns null because
    // no user row exists for the recorded user_id. Normally the FK cascade
    // prevents this, so we briefly disable replication triggers to insert
    // a token with a dangling user_id.
    async function seedDanglingToken(token: string, userId: string) {
      await db.execute(sql`SET session_replication_role = 'replica'`);
      try {
        await db.insert(dataExportTokensTable).values({
          token,
          userId,
          expiresAt: new Date(Date.now() + 60_000),
        });
      } finally {
        await db.execute(sql`SET session_replication_role = 'origin'`);
      }
    }

    let token: string;
    let userId: string;

    beforeEach(async () => {
      token = makeToken();
      userId = `ghost-acct-${crypto.randomBytes(6).toString("hex")}`;
      await seedDanglingToken(token, userId);
    });

    it("returns 410 HTML expired page when Accept: text/html", async () => {
      try {
        const res = await request(app)
          .get(`${DOWNLOAD_PATH}/${token}`)
          .set("Accept", "text/html");

        expect(res.status).toBe(410);
        expect(res.headers["content-type"]).toMatch(/text\/html/);
        expect(res.text).toMatch(EXPIRED_HEADING_RE);
        expect(res.text).toMatch(ACCOUNT_LINK_RE);
      } finally {
        await db
          .delete(dataExportTokensTable)
          .where(eq(dataExportTokensTable.token, token));
      }
    });

    it("returns 404 JSON without Accept: text/html", async () => {
      try {
        const res = await request(app)
          .get(`${DOWNLOAD_PATH}/${token}`)
          .set("Accept", "application/json");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Invalid or expired link." });
      } finally {
        await db
          .delete(dataExportTokensTable)
          .where(eq(dataExportTokensTable.token, token));
      }
    });
  });
});
