import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import claimRouter from "./claim";
import { ANON_CLAIM_COOKIE } from "../lib/anonClaimToken";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
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
    // Provide a minimal req.log so the route's structured logging works.
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });

  app.use("/api", claimRouter);

  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;

beforeAll(() => {
  testApp = makeTestApp();
});

afterAll(async () => {
  await pool.end();
});

/**
 * All test rows use this prefix on `anonymousClaimToken` so we can safely
 * clean up after ourselves without touching production-shaped data.
 */
function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const TEST_USER_ID = `test-user-${crypto.randomBytes(6).toString("hex")}`;
const OTHER_USER_ID = `other-user-${crypto.randomBytes(6).toString("hex")}`;

interface SeedIds {
  ownedAuditId: number;
  ownedProfileId: number;
  ownedMessageId: number;
  ownedInsightId: number;
  otherUsersAuditId: number;
  strangerAnonAuditId: number;
}

async function seed(token: string): Promise<SeedIds> {
  const [ownedAudit] = await db
    .insert(auditsTable)
    .values({
      firstName: "Test",
      age: 30,
      gender: "x",
      datingGoal: "find a relationship",
      bio: "test bio",
      anonymousClaimToken: token,
    })
    .returning({ id: auditsTable.id });

  const [ownedProfile] = await db
    .insert(profilesTable)
    .values({
      platform: "Hinge",
      bio: "their bio",
      anonymousClaimToken: token,
    })
    .returning({ id: profilesTable.id });

  const [ownedMessage] = await db
    .insert(messageCoachingSessionsTable)
    .values({
      matchName: "Sam",
      conversationContext: "context",
      yourLastMessage: "hey",
      anonymousClaimToken: token,
    })
    .returning({ id: messageCoachingSessionsTable.id });

  const [ownedInsight] = await db
    .insert(emailInsightsTable)
    .values({
      sourceLabel: "inbox",
      pastedContent: "blah",
      anonymousClaimToken: token,
    })
    .returning({ id: emailInsightsTable.id });

  // Row already owned by a different user — must NEVER be claimed.
  const [otherUsersAudit] = await db
    .insert(auditsTable)
    .values({
      firstName: "OtherUser",
      age: 31,
      gender: "x",
      datingGoal: "casual",
      bio: "owned bio",
      userId: OTHER_USER_ID,
      anonymousClaimToken: null,
    })
    .returning({ id: auditsTable.id });

  // Row created by a different anonymous browser (different token).
  // The caller doesn't have this token, so it must be ignored.
  const [strangerAnonAudit] = await db
    .insert(auditsTable)
    .values({
      firstName: "Stranger",
      age: 32,
      gender: "x",
      datingGoal: "friendship",
      bio: "stranger bio",
      anonymousClaimToken: makeToken(),
    })
    .returning({ id: auditsTable.id });

  return {
    ownedAuditId: ownedAudit.id,
    ownedProfileId: ownedProfile.id,
    ownedMessageId: ownedMessage.id,
    ownedInsightId: ownedInsight.id,
    otherUsersAuditId: otherUsersAudit.id,
    strangerAnonAuditId: strangerAnonAudit.id,
  };
}

async function cleanup(ids: SeedIds): Promise<void> {
  await db
    .delete(auditsTable)
    .where(
      inArray(auditsTable.id, [
        ids.ownedAuditId,
        ids.otherUsersAuditId,
        ids.strangerAnonAuditId,
      ]),
    );
  await db.delete(profilesTable).where(eq(profilesTable.id, ids.ownedProfileId));
  await db
    .delete(messageCoachingSessionsTable)
    .where(eq(messageCoachingSessionsTable.id, ids.ownedMessageId));
  await db
    .delete(emailInsightsTable)
    .where(eq(emailInsightsTable.id, ids.ownedInsightId));
}

describe("POST /api/claim-anonymous", () => {
  let token: string;
  let ids: SeedIds;

  beforeEach(async () => {
    token = makeToken();
    ids = await seed(token);
  });

  // afterEach cleanup is invoked per-test via try/finally so failures still tidy up.

  it("returns 401 when unauthenticated", async () => {
    testApp.setUser(null);
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
        .send({ auditIds: [ids.ownedAuditId] });

      expect(res.status).toBe(401);

      const [row] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.ownedAuditId));
      expect(row.userId).toBeNull();
      expect(row.anonymousClaimToken).toBe(token);
    } finally {
      await cleanup(ids);
    }
  });

  it("reassigns matching anonymous rows to the caller across all four tables", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
        .send({
          auditIds: [ids.ownedAuditId],
          profileIds: [ids.ownedProfileId],
          messageSessionIds: [ids.ownedMessageId],
          insightIds: [ids.ownedInsightId],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        claimed: { audits: 1, profiles: 1, messages: 1, insights: 1 },
      });

      const [audit] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.ownedAuditId));
      expect(audit.userId).toBe(TEST_USER_ID);
      expect(audit.anonymousClaimToken).toBeNull();

      const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, ids.ownedProfileId));
      expect(profile.userId).toBe(TEST_USER_ID);
      expect(profile.anonymousClaimToken).toBeNull();

      const [msg] = await db
        .select()
        .from(messageCoachingSessionsTable)
        .where(eq(messageCoachingSessionsTable.id, ids.ownedMessageId));
      expect(msg.userId).toBe(TEST_USER_ID);

      const [insight] = await db
        .select()
        .from(emailInsightsTable)
        .where(eq(emailInsightsTable.id, ids.ownedInsightId));
      expect(insight.userId).toBe(TEST_USER_ID);

      // anon_claim cookie should be cleared after a successful claim
      const setCookie = res.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
      expect(cookieHeader).toMatch(new RegExp(`${ANON_CLAIM_COOKIE}=;`));
    } finally {
      await cleanup(ids);
    }
  });

  it("never touches rows already owned by another user", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
        .send({ auditIds: [ids.otherUsersAuditId, ids.ownedAuditId] });

      expect(res.status).toBe(200);
      expect(res.body.claimed.audits).toBe(1);

      const [otherRow] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.otherUsersAuditId));
      expect(otherRow.userId).toBe(OTHER_USER_ID);
      expect(otherRow.anonymousClaimToken).toBeNull();

      const [ownRow] = await db
        .select()
        .from(auditsTable)
        .where(
          and(eq(auditsTable.id, ids.ownedAuditId), eq(auditsTable.userId, TEST_USER_ID)),
        );
      expect(ownRow?.userId).toBe(TEST_USER_ID);
    } finally {
      await cleanup(ids);
    }
  });

  it("ignores ids the caller doesn't own (no privilege escalation via id guessing)", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
        .send({
          auditIds: [ids.strangerAnonAuditId, ids.ownedAuditId],
        });

      expect(res.status).toBe(200);
      // Only the row matching this browser's token is claimed.
      expect(res.body.claimed.audits).toBe(1);

      const [strangerRow] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.strangerAnonAuditId));
      expect(strangerRow.userId).toBeNull();
      expect(strangerRow.anonymousClaimToken).not.toBeNull();
      expect(strangerRow.anonymousClaimToken).not.toBe(token);
    } finally {
      await cleanup(ids);
    }
  });

  it("claims nothing (but still returns 200) when the caller has no anon cookie", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        // no Cookie header
        .send({ auditIds: [ids.ownedAuditId] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        claimed: { audits: 0, profiles: 0, messages: 0, insights: 0 },
      });

      const [row] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.ownedAuditId));
      expect(row.userId).toBeNull();
      expect(row.anonymousClaimToken).toBe(token);
    } finally {
      await cleanup(ids);
    }
  });
});
