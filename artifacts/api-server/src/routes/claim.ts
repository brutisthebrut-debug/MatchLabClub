import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  coachFollowUpsTable,
} from "@workspace/db";
import {
  ClaimAnonymousDataBody,
  ClaimAnonymousDataResponse,
  IssueAnonymousClaimHandoffResponse,
  RedeemAnonymousClaimHandoffBody,
  RedeemAnonymousClaimHandoffResponse,
} from "@workspace/api-zod";
import {
  getAnonClaimToken,
  clearAnonClaimToken,
} from "../lib/anonClaimToken";
import { signHandoffToken, verifyHandoffToken } from "../lib/handoffToken";

const router: IRouter = Router();

interface ClaimIds {
  auditIds?: number[];
  profileIds?: number[];
  messageSessionIds?: number[];
  insightIds?: number[];
  followUpIds?: number[];
}

interface ClaimedCounts {
  audits: number;
  profiles: number;
  messages: number;
  insights: number;
  followUps: number;
}

function dedup(xs: number[] | undefined): number[] {
  return Array.from(
    new Set((xs ?? []).filter((x) => Number.isInteger(x) && x > 0)),
  );
}

/**
 * Reassign rows whose `anonymous_claim_token` matches `anonToken` (and whose
 * `user_id` is still null) to `userId`. Returns per-table counts of rows
 * actually claimed. This is the shared core used by both the cookie-scoped
 * claim path and the signed cross-device handoff path — keeping them on one
 * implementation guarantees both paths enforce the same anonymous-token
 * scoping and the same IDOR-safe filters.
 */
async function claimByAnonToken(
  userId: string,
  anonToken: string,
  ids: ClaimIds,
): Promise<ClaimedCounts> {
  const a = dedup(ids.auditIds);
  const p = dedup(ids.profileIds);
  const m = dedup(ids.messageSessionIds);
  const i = dedup(ids.insightIds);
  const f = dedup(ids.followUpIds);

  const [audits, profiles, messages, insights, followUps] = await Promise.all([
    a.length
      ? db
          .update(auditsTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(auditsTable.id, a),
              isNull(auditsTable.userId),
              eq(auditsTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: auditsTable.id })
      : Promise.resolve([]),
    p.length
      ? db
          .update(profilesTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(profilesTable.id, p),
              isNull(profilesTable.userId),
              eq(profilesTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: profilesTable.id })
      : Promise.resolve([]),
    m.length
      ? db
          .update(messageCoachingSessionsTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(messageCoachingSessionsTable.id, m),
              isNull(messageCoachingSessionsTable.userId),
              eq(messageCoachingSessionsTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: messageCoachingSessionsTable.id })
      : Promise.resolve([]),
    i.length
      ? db
          .update(emailInsightsTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(emailInsightsTable.id, i),
              isNull(emailInsightsTable.userId),
              eq(emailInsightsTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: emailInsightsTable.id })
      : Promise.resolve([]),
    f.length
      ? db
          .update(coachFollowUpsTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(coachFollowUpsTable.id, f),
              isNull(coachFollowUpsTable.userId),
              eq(coachFollowUpsTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: coachFollowUpsTable.id })
      : Promise.resolve([]),
  ]);

  return {
    audits: audits.length,
    profiles: profiles.length,
    messages: messages.length,
    insights: insights.length,
    followUps: followUps.length,
  };
}

function logIfShortfall(
  req: Request,
  userId: string,
  ids: ClaimIds,
  counts: ClaimedCounts,
  via: "cookie" | "handoff",
): void {
  const requested =
    dedup(ids.auditIds).length +
    dedup(ids.profileIds).length +
    dedup(ids.messageSessionIds).length +
    dedup(ids.insightIds).length +
    dedup(ids.followUpIds).length;
  const claimed =
    counts.audits +
    counts.profiles +
    counts.messages +
    counts.insights +
    counts.followUps;
  if (requested > claimed) {
    req.log.warn(
      { userId, requested, claimed, via },
      "Anonymous claim request included IDs not owned by this token",
    );
  }
  req.log.info(
    { userId, claimed: counts, via },
    "Claimed anonymous data on login",
  );
}

router.post("/claim-anonymous", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ClaimAnonymousDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user.id;
  const anonToken = getAnonClaimToken(req);

  // Without a matching anonymous-browser token, there is nothing this caller
  // can legitimately claim — refuse silently rather than risk IDOR.
  if (!anonToken) {
    res.json(
      ClaimAnonymousDataResponse.parse({
        claimed: {
          audits: 0,
          profiles: 0,
          messages: 0,
          insights: 0,
          followUps: 0,
        },
      }),
    );
    return;
  }

  const counts = await claimByAnonToken(userId, anonToken, parsed.data);
  logIfShortfall(req, userId, parsed.data, counts, "cookie");

  // Once everything matching this browser's token is claimed, retire the
  // cookie so it can't be reused to grab future anonymous rows.
  clearAnonClaimToken(res);

  res.json(ClaimAnonymousDataResponse.parse({ claimed: counts }));
});

router.post("/claim-anonymous/handoff/issue", (req, res): void => {
  const anonToken = getAnonClaimToken(req);
  if (!anonToken) {
    res.status(400).json({
      error: "This browser has no anonymous data to hand off",
    });
    return;
  }
  const issued = signHandoffToken(anonToken);
  res.json(
    IssueAnonymousClaimHandoffResponse.parse({
      handoff: issued.token,
      expiresAt: issued.expiresAt,
    }),
  );
});

router.post(
  "/claim-anonymous/handoff/redeem",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const parsed = RedeemAnonymousClaimHandoffBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const anonToken = verifyHandoffToken(parsed.data.handoff);
    if (!anonToken) {
      res.status(400).json({ error: "Invalid or expired handoff token" });
      return;
    }

    const userId = req.user.id;
    const counts = await claimByAnonToken(userId, anonToken, parsed.data);
    logIfShortfall(req, userId, parsed.data, counts, "handoff");

    res.json(RedeemAnonymousClaimHandoffResponse.parse({ claimed: counts }));
  },
);

export default router;
