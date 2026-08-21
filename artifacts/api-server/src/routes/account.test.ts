import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
  careDialectProfilesTable,
  cosmicChartsTable,
  dailySparkAnswersTable,
  dataExportTokensTable,
  flagSelectionsTable,
  importedSourcesTable,
  journeyEventsTable,
  mirrorDigestPrefsTable,
  predictionResponsesTable,
  scenarioResponsesTable,
  timeCapsulesTable,
  userVerificationsTable,
  usersTable,
  wyrAnswersTable,
  wingmanSelfRatingsTable,
} from "@workspace/db";
import accountRouter from "./account";

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    const testUserId = req.header("x-test-user-id");
    if (testUserId) {
      req.user = { id: testUserId } as NonNullable<Request["user"]>;
    }
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

describe("POST /api/me/account/delete Play privacy", () => {
  it("purges every selected Play record and its Journey instrumentation", async () => {
    const userId = `test-play-delete-${crypto.randomBytes(6).toString("hex")}`;
    const email = `${userId}@example.com`;

    await db.insert(usersTable).values({ id: userId, email });
    await Promise.all([
      db.insert(wyrAnswersTable).values({
        userId,
        promptId: "privacy-wyr",
        choice: "a",
      }),
      db.insert(dailySparkAnswersTable).values({
        userId,
        questionId: "privacy-spark",
        choice: "a",
      }),
      db.insert(flagSelectionsTable).values({
        userId,
        bringFlags: ["consistent"],
        seekFlags: ["kind"],
      }),
      db.insert(scenarioResponsesTable).values({
        userId,
        scenarioId: "privacy-scenario",
        optionId: "a",
      }),
      db.insert(predictionResponsesTable).values({
        userId,
        itemId: "privacy-prediction",
        predicted: 2,
        actual: 3,
      }),
      db.insert(timeCapsulesTable).values({
        userId,
        body: "A private future-facing note.",
      }),
      db.insert(careDialectProfilesTable).values({
        userId,
        testedGiveTop: "steadyPresence",
        testedReceiveTop: "undividedTime",
      }),
      db.insert(journeyEventsTable).values({
        userId,
        eventType: "signal_fed",
        props: { source: "daily-spark" },
      }),
      db.insert(importedSourcesTable).values({
        userId,
        source: "quiz",
        status: "complete",
        parsedSummary: { slug: "privacy-quiz" },
      }),
      db.insert(importedSourcesTable).values({
        userId,
        source: "preferences-paste",
        status: "complete",
        parsedSummary: { counts: { items: 2 } },
      }),
    ]);

    const res = await request(app)
      .post("/api/me/account/delete")
      .set("x-test-user-id", userId)
      .send({ confirmation: email });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.tables).toMatchObject({
      wyr_answers: 1,
      daily_spark_answers: 1,
      flag_selections: 1,
      scenario_responses: 1,
      prediction_responses: 1,
      time_capsules: 1,
      care_dialect_profiles: 1,
      journey_events: 1,
      imported_sources: 2,
      users: 1,
    });

    const remaining = await Promise.all([
      db
        .select()
        .from(wyrAnswersTable)
        .where(eq(wyrAnswersTable.userId, userId)),
      db
        .select()
        .from(dailySparkAnswersTable)
        .where(eq(dailySparkAnswersTable.userId, userId)),
      db
        .select()
        .from(flagSelectionsTable)
        .where(eq(flagSelectionsTable.userId, userId)),
      db
        .select()
        .from(scenarioResponsesTable)
        .where(eq(scenarioResponsesTable.userId, userId)),
      db
        .select()
        .from(predictionResponsesTable)
        .where(eq(predictionResponsesTable.userId, userId)),
      db
        .select()
        .from(timeCapsulesTable)
        .where(eq(timeCapsulesTable.userId, userId)),
      db
        .select()
        .from(careDialectProfilesTable)
        .where(eq(careDialectProfilesTable.userId, userId)),
      db
        .select()
        .from(journeyEventsTable)
        .where(eq(journeyEventsTable.userId, userId)),
      db
        .select()
        .from(importedSourcesTable)
        .where(eq(importedSourcesTable.userId, userId)),
    ]);

    expect(remaining.every((rows) => rows.length === 0)).toBe(true);
  });
});

describe("POST /api/me/account/delete registry coverage", () => {
  it("purges first-party tables that were outside the legacy delete lists", async () => {
    const userId = `test-registry-delete-${crypto.randomBytes(6).toString("hex")}`;
    const email = `${userId}@example.com`;

    await db.insert(usersTable).values({ id: userId, email });
    await Promise.all([
      db.insert(wingmanSelfRatingsTable).values({
        userId,
        warmth: 3,
        humor: 3,
        drive: 3,
        openness: 3,
        steadiness: 3,
      }),
      db.insert(cosmicChartsTable).values({
        userId,
        birthDate: "1990-01-01",
        birthPlace: "New York, NY",
        birthLat: 40.7128,
        birthLng: -74.006,
        placements: {
          mode: "sunOnly",
          sun: { sign: "Capricorn", degree: 10 },
          moon: null,
          rising: null,
          midheaven: null,
          bodies: [],
          traits: { novelty: 0.5, stability: 0.5, expression: 0.5, depth: 0.5 },
          elements: { fire: 0, earth: 1, air: 0, water: 0 },
          modalities: { cardinal: 1, fixed: 0, mutable: 0 },
        },
      }),
      db.insert(userVerificationsTable).values({ userId }),
      db.insert(mirrorDigestPrefsTable).values({ userId }),
    ]);

    const res = await request(app)
      .post("/api/me/account/delete")
      .set("x-test-user-id", userId)
      .send({ confirmation: email });

    expect(res.status).toBe(200);
    expect(res.body.tables).toMatchObject({
      wingman_self_ratings: 1,
      cosmic_charts: 1,
      user_verifications: 1,
      mirror_digest_prefs: 1,
      users: 1,
    });

    const remaining = await Promise.all([
      db
        .select()
        .from(wingmanSelfRatingsTable)
        .where(eq(wingmanSelfRatingsTable.userId, userId)),
      db
        .select()
        .from(cosmicChartsTable)
        .where(eq(cosmicChartsTable.userId, userId)),
      db
        .select()
        .from(userVerificationsTable)
        .where(eq(userVerificationsTable.userId, userId)),
      db
        .select()
        .from(mirrorDigestPrefsTable)
        .where(eq(mirrorDigestPrefsTable.userId, userId)),
    ]);
    expect(remaining.every((rows) => rows.length === 0)).toBe(true);
  });
});
