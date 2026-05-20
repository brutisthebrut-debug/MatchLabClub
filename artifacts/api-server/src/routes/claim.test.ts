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
  coachFollowUpsTable,
  handoffTokenRedemptionsTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import claimRouter from "./claim";
import { ANON_CLAIM_COOKIE } from "../lib/anonClaimToken";
import {
  signHandoffToken,
  verifyHandoffToken,
} from "../lib/handoffToken";

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
  ownedFollowUpId: number;
  otherUsersAuditId: number;
  otherUsersFollowUpId: number;
  strangerAnonAuditId: number;
  strangerAnonFollowUpId: number;
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

  const [ownedFollowUp] = await db
    .insert(coachFollowUpsTable)
    .values({
      answer: "Try opening with a question about her photo.",
      anonymousClaimToken: token,
    })
    .returning({ id: coachFollowUpsTable.id });

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

  const [otherUsersFollowUp] = await db
    .insert(coachFollowUpsTable)
    .values({
      answer: "Already-owned follow-up answer.",
      userId: OTHER_USER_ID,
      anonymousClaimToken: null,
    })
    .returning({ id: coachFollowUpsTable.id });

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

  const [strangerAnonFollowUp] = await db
    .insert(coachFollowUpsTable)
    .values({
      answer: "Stranger anon follow-up.",
      anonymousClaimToken: makeToken(),
    })
    .returning({ id: coachFollowUpsTable.id });

  return {
    ownedAuditId: ownedAudit.id,
    ownedProfileId: ownedProfile.id,
    ownedMessageId: ownedMessage.id,
    ownedInsightId: ownedInsight.id,
    ownedFollowUpId: ownedFollowUp.id,
    otherUsersAuditId: otherUsersAudit.id,
    otherUsersFollowUpId: otherUsersFollowUp.id,
    strangerAnonAuditId: strangerAnonAudit.id,
    strangerAnonFollowUpId: strangerAnonFollowUp.id,
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
  await db
    .delete(coachFollowUpsTable)
    .where(
      inArray(coachFollowUpsTable.id, [
        ids.ownedFollowUpId,
        ids.otherUsersFollowUpId,
        ids.strangerAnonFollowUpId,
      ]),
    );
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
          followUpIds: [ids.ownedFollowUpId],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        claimed: {
          audits: 1,
          profiles: 1,
          messages: 1,
          insights: 1,
          followUps: 1,
        },
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

      const [followUp] = await db
        .select()
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.id, ids.ownedFollowUpId));
      expect(followUp.userId).toBe(TEST_USER_ID);
      expect(followUp.anonymousClaimToken).toBeNull();

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

  it("claims follow-ups matching the caller's token and ignores foreign ones", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous")
        .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
        .send({
          followUpIds: [
            ids.ownedFollowUpId,
            ids.strangerAnonFollowUpId,
            ids.otherUsersFollowUpId,
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.claimed.followUps).toBe(1);

      const [owned] = await db
        .select()
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.id, ids.ownedFollowUpId));
      expect(owned.userId).toBe(TEST_USER_ID);
      expect(owned.anonymousClaimToken).toBeNull();

      const [stranger] = await db
        .select()
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.id, ids.strangerAnonFollowUpId));
      expect(stranger.userId).toBeNull();
      expect(stranger.anonymousClaimToken).not.toBe(token);

      const [other] = await db
        .select()
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.id, ids.otherUsersFollowUpId));
      expect(other.userId).toBe(OTHER_USER_ID);
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
        claimed: {
          audits: 0,
          profiles: 0,
          messages: 0,
          insights: 0,
          followUps: 0,
        },
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

describe("handoff token sign/verify", () => {
  it("round-trips a valid token", () => {
    const anon = crypto.randomBytes(32).toString("hex");
    const issued = signHandoffToken(anon);
    const verified = verifyHandoffToken(issued.token);
    expect(verified?.anonToken).toBe(anon);
    expect(verified?.jti).toBe(issued.jti);
    expect(verified?.jti).toMatch(/^[a-f0-9]{32}$/);
  });

  it("mints a fresh jti for every issued token", () => {
    const anon = crypto.randomBytes(32).toString("hex");
    const a = signHandoffToken(anon);
    const b = signHandoffToken(anon);
    expect(a.jti).not.toBe(b.jti);
    expect(a.token).not.toBe(b.token);
  });

  it("rejects an expired token", () => {
    const anon = crypto.randomBytes(32).toString("hex");
    const issued = signHandoffToken(anon, -1);
    expect(verifyHandoffToken(issued.token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const anon = crypto.randomBytes(32).toString("hex");
    const issued = signHandoffToken(anon);
    const [body, sig] = issued.token.split(".");
    // Flip a character in the body — signature should no longer verify.
    const tamperedBody =
      body!.slice(0, -1) + (body!.slice(-1) === "A" ? "B" : "A");
    expect(verifyHandoffToken(`${tamperedBody}.${sig}`)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyHandoffToken("")).toBeNull();
    expect(verifyHandoffToken("not-a-token")).toBeNull();
    expect(verifyHandoffToken(undefined)).toBeNull();
    expect(verifyHandoffToken(123)).toBeNull();
  });
});

describe("POST /api/claim-anonymous/handoff/issue", () => {
  it("returns a signed token derived from the anon cookie", async () => {
    const token = makeToken();
    const res = await request(testApp.app)
      .post("/api/claim-anonymous/handoff/issue")
      .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
      .send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.handoff).toBe("string");
    expect(typeof res.body.expiresAt).toBe("string");
    expect(verifyHandoffToken(res.body.handoff)?.anonToken).toBe(token);
  });

  it("rejects callers without an anon cookie", async () => {
    const res = await request(testApp.app)
      .post("/api/claim-anonymous/handoff/issue")
      .send({});
    expect(res.status).toBe(400);
  });

  it("does not require authentication", async () => {
    testApp.setUser(null);
    const token = makeToken();
    const res = await request(testApp.app)
      .post("/api/claim-anonymous/handoff/issue")
      .set("Cookie", [`${ANON_CLAIM_COOKIE}=${token}`])
      .send({});
    expect(res.status).toBe(200);
  });
});

describe("POST /api/claim-anonymous/handoff/redeem", () => {
  let token: string;
  let ids: SeedIds;

  beforeEach(async () => {
    token = makeToken();
    ids = await seed(token);
  });

  it("returns 401 when unauthenticated", async () => {
    testApp.setUser(null);
    try {
      const handoff = signHandoffToken(token).token;
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({ handoff, auditIds: [ids.ownedAuditId] });
      expect(res.status).toBe(401);

      const [row] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.ownedAuditId));
      expect(row.userId).toBeNull();
    } finally {
      await cleanup(ids);
    }
  });

  it("claims rows matching the signed token WITHOUT a browser cookie", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const handoff = signHandoffToken(token).token;
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        // intentionally no Cookie header — this is the cross-device case
        .send({
          handoff,
          auditIds: [ids.ownedAuditId],
          profileIds: [ids.ownedProfileId],
          messageSessionIds: [ids.ownedMessageId],
          insightIds: [ids.ownedInsightId],
          followUpIds: [ids.ownedFollowUpId],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        claimed: {
          audits: 1,
          profiles: 1,
          messages: 1,
          insights: 1,
          followUps: 1,
        },
      });

      const [audit] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.ownedAuditId));
      expect(audit.userId).toBe(TEST_USER_ID);
      expect(audit.anonymousClaimToken).toBeNull();

      const [followUp] = await db
        .select()
        .from(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.id, ids.ownedFollowUpId));
      expect(followUp.userId).toBe(TEST_USER_ID);
      expect(followUp.anonymousClaimToken).toBeNull();
    } finally {
      await cleanup(ids);
    }
  });

  it("rejects an expired handoff token", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const handoff = signHandoffToken(token, -1).token;
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({ handoff, auditIds: [ids.ownedAuditId] });

      expect(res.status).toBe(400);

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

  it("never claims rows tagged with a different anonymous token", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      // Sign a handoff for token A but try to claim a row tagged with token B.
      const handoff = signHandoffToken(token).token;
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({
          handoff,
          auditIds: [ids.strangerAnonAuditId, ids.ownedAuditId],
        });

      expect(res.status).toBe(200);
      expect(res.body.claimed.audits).toBe(1);

      const [stranger] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ids.strangerAnonAuditId));
      expect(stranger.userId).toBeNull();
      expect(stranger.anonymousClaimToken).not.toBe(token);
    } finally {
      await cleanup(ids);
    }
  });

  it("never touches rows already owned by another user", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const handoff = signHandoffToken(token).token;
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({
          handoff,
          auditIds: [ids.otherUsersAuditId, ids.ownedAuditId],
        });
      expect(res.status).toBe(200);
      expect(res.body.claimed.audits).toBe(1);

      const [other] = await db
        .select()
        .from(auditsTable)
        .where(
          and(
            eq(auditsTable.id, ids.otherUsersAuditId),
            eq(auditsTable.userId, OTHER_USER_ID),
          ),
        );
      expect(other?.userId).toBe(OTHER_USER_ID);
    } finally {
      await cleanup(ids);
    }
  });

  it("rejects a replayed handoff token even if the original browser created new rows", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    const issued = signHandoffToken(token);
    let replayAuditId: number | null = null;
    try {
      // First redemption: succeeds and claims the seeded audit.
      const first = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({ handoff: issued.token, auditIds: [ids.ownedAuditId] });
      expect(first.status).toBe(200);
      expect(first.body.claimed.audits).toBe(1);

      // The original browser, still anonymous, creates a brand-new row under
      // the same anon token. A leaked handoff link must NOT be able to grab it.
      const [newRow] = await db
        .insert(auditsTable)
        .values({
          firstName: "Replay",
          age: 33,
          gender: "x",
          datingGoal: "find a relationship",
          bio: "post-claim bio",
          anonymousClaimToken: token,
        })
        .returning({ id: auditsTable.id });
      replayAuditId = newRow.id;

      // Second redemption with the same handoff token must be rejected.
      const second = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({ handoff: issued.token, auditIds: [replayAuditId] });
      expect(second.status).toBe(400);
      expect(second.body.error).toMatch(/already been used/i);

      const [stillAnon] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, replayAuditId));
      expect(stillAnon.userId).toBeNull();
      expect(stillAnon.anonymousClaimToken).toBe(token);
    } finally {
      if (replayAuditId !== null) {
        await db.delete(auditsTable).where(eq(auditsTable.id, replayAuditId));
      }
      await db
        .delete(handoffTokenRedemptionsTable)
        .where(eq(handoffTokenRedemptionsTable.jti, issued.jti));
      await cleanup(ids);
    }
  });

  it("returns a styled HTML expired page for browser navigations (invalid token)", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .set("Accept", "text/html")
        .send({ handoff: "not-a-real-token", auditIds: [ids.ownedAuditId] });

      expect(res.status).toBe(410);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.text).toMatch(/hand-?off link/i);
      expect(res.text).toMatch(/Link expired/);
      expect(res.text).toMatch(/Back to Next Level Dating Club/);
    } finally {
      await cleanup(ids);
    }
  });

  it("preserves JSON response for non-browser clients (invalid token)", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    try {
      const res = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .set("Accept", "application/json")
        .send({ handoff: "not-a-real-token", auditIds: [ids.ownedAuditId] });

      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body.error).toMatch(/invalid or expired/i);
    } finally {
      await cleanup(ids);
    }
  });

  it("returns a styled HTML expired page for browser navigations on replay", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    const issued = signHandoffToken(token);
    try {
      const first = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .send({ handoff: issued.token, auditIds: [ids.ownedAuditId] });
      expect(first.status).toBe(200);

      const second = await request(testApp.app)
        .post("/api/claim-anonymous/handoff/redeem")
        .set("Accept", "text/html")
        .send({ handoff: issued.token, auditIds: [ids.ownedAuditId] });
      expect(second.status).toBe(410);
      expect(second.headers["content-type"]).toMatch(/text\/html/);
      expect(second.text).toMatch(/hand-?off link/i);
    } finally {
      await db
        .delete(handoffTokenRedemptionsTable)
        .where(eq(handoffTokenRedemptionsTable.jti, issued.jti));
      await cleanup(ids);
    }
  });
});
