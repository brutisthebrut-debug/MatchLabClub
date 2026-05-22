import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  coachFollowUpsTable,
  handoffTokenRedemptionsTable,
  lifePulsesTable,
  journalEntriesTable,
  postDateNotesTable,
} from "@workspace/db";
import {
  ClaimAnonymousDataBody,
  ClaimAnonymousDataResponse,
  IssueAnonymousClaimHandoffResponse,
  RedeemAnonymousClaimHandoffBody,
  RedeemAnonymousClaimHandoffResponse,
  GetAnonymousClaimHandoffStatusBody,
  GetAnonymousClaimHandoffStatusResponse,
} from "@workspace/api-zod";
import {
  getAnonClaimToken,
  clearAnonClaimToken,
} from "../lib/anonClaimToken";
import { signHandoffToken, verifyHandoffToken } from "../lib/handoffToken";
import { originFor, sendExpiredLink } from "../lib/expiredLinkPage";
import {
  checkHandoffRateLimit,
  handoffRateLimitKey,
} from "../lib/handoffRateLimit";

function sendExpiredHandoff(
  req: Request,
  res: Response,
  jsonError: string,
): void {
  sendExpiredLink(req, res, {
    pageTitle: "Handoff link expired — Next Level Dating Club",
    heading: "This hand-off link can&rsquo;t be used anymore",
    bodyParagraphs: [
      "&ldquo;Continue on another device&rdquo; links are single-use and only live for about 15 minutes for your security. This one has either already been used, expired, or we don&rsquo;t recognize it.",
      "No worries &mdash; head back to the original device and tap &ldquo;Continue on another device&rdquo; again to get a fresh link.",
    ],
    ctaLabel: "Back to Next Level Dating Club",
    ctaUrl: `${originFor(req)}/`,
    jsonError,
    jsonStatus: 400,
  });
}

const router: IRouter = Router();

interface ClaimIds {
  auditIds?: number[];
  profileIds?: number[];
  messageSessionIds?: number[];
  insightIds?: number[];
  followUpIds?: number[];
  journalEntryIds?: number[];
  postDateNoteIds?: number[];
}

interface ClaimedCounts {
  audits: number;
  profiles: number;
  messages: number;
  insights: number;
  followUps: number;
  journalEntries: number;
  postDateNotes: number;
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
  const j = dedup(ids.journalEntryIds);
  const pd = dedup(ids.postDateNoteIds);

  const [audits, profiles, messages, insights, followUps, journalEntries, postDateNotes] = await Promise.all([
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
    j.length
      ? db
          .update(journalEntriesTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(journalEntriesTable.id, j),
              isNull(journalEntriesTable.userId),
              eq(journalEntriesTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: journalEntriesTable.id })
      : Promise.resolve([]),
    pd.length
      ? db
          .update(postDateNotesTable)
          .set({ userId, anonymousClaimToken: null })
          .where(
            and(
              inArray(postDateNotesTable.id, pd),
              isNull(postDateNotesTable.userId),
              eq(postDateNotesTable.anonymousClaimToken, anonToken),
            ),
          )
          .returning({ id: postDateNotesTable.id })
      : Promise.resolve([]),
  ]);

  // Life pulses are not tracked by ID on the client (they're auto-collected
  // background signals), so claim them in bulk by anon token instead of by
  // explicit ID list. The token check is the same IDOR-safe filter used above.
  await db
    .update(lifePulsesTable)
    .set({ userId, anonymousClaimToken: null })
    .where(
      and(
        isNull(lifePulsesTable.userId),
        eq(lifePulsesTable.anonymousClaimToken, anonToken),
      ),
    );

  return {
    audits: audits.length,
    profiles: profiles.length,
    messages: messages.length,
    insights: insights.length,
    followUps: followUps.length,
    journalEntries: journalEntries.length,
    postDateNotes: postDateNotes.length,
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
    dedup(ids.followUpIds).length +
    dedup(ids.journalEntryIds).length +
    dedup(ids.postDateNoteIds).length;
  const claimed =
    counts.audits +
    counts.profiles +
    counts.messages +
    counts.insights +
    counts.followUps +
    counts.journalEntries +
    counts.postDateNotes;
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

/**
 * POST /api/claim-anonymous
 *
 * Reassigns anonymous rows (audits, profiles, message sessions, email insights,
 * follow-ups) to the authenticated user, scoped to the `anon_claim` cookie
 * present in the request.
 *
 * ## Orphan risk & intended behavior
 *
 * Every piece of anonymous data is tagged with an `anonymous_claim_token`
 * derived from the `anon_claim` cookie. If that cookie is cleared before the
 * user signs in (e.g. "Clear browsing data", private-browsing session ending,
 * or switching devices without using the handoff flow), the rows cannot be
 * matched and remain unclaimed indefinitely (`user_id = null`,
 * `anonymous_claim_token` still set).
 *
 * **Intended behavior:**
 * - Rows are never auto-deleted; they remain in the DB and can be manually
 *   reassigned by a founder/admin via a direct SQL UPDATE.
 * - The frontend detects this specific case (insight IDs were in localStorage
 *   but the server returned 0 claimed) and stores a flag in sessionStorage.
 *   The Email Insights page reads that flag and shows a user-facing notice
 *   pointing to the support email so a manual recovery can be initiated.
 * - No grace-period auto-claim is performed server-side because unclaimed
 *   rows with a token set cannot be safely attributed to a different user
 *   without the matching token. Attributing based solely on recency would risk
 *   incorrectly merging data from two different anonymous sessions.
 *
 * For users who switch devices intentionally, the cross-device handoff flow
 * (`POST /api/claim-anonymous/handoff/issue` +
 *  `POST /api/claim-anonymous/handoff/redeem`) is the correct recovery path.
 */
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
          journalEntries: 0,
          postDateNotes: 0,
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

router.post("/claim-anonymous/handoff/issue", async (req, res): Promise<void> => {
  const anonToken = getAnonClaimToken(req);
  if (!anonToken) {
    res.status(400).json({
      error: "This browser has no anonymous data to hand off",
    });
    return;
  }

  const rlKey = handoffRateLimitKey(req.ip, anonToken);
  if (!(await checkHandoffRateLimit(rlKey))) {
    res.status(429).json({
      error:
        "Too many handoff link requests. Please wait a minute before trying again.",
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
  "/claim-anonymous/handoff/status",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = GetAnonymousClaimHandoffStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const verified = verifyHandoffToken(parsed.data.handoff);
    if (!verified) {
      // Either malformed/wrong-signature (refuse) or genuinely expired. We
      // can't distinguish the two without re-decoding unsigned payload, and
      // we don't want to leak "valid signature but expired" vs "forged" —
      // both 400 with a generic message.
      res.status(400).json({ error: "Invalid or expired handoff token" });
      return;
    }
    const existing = await db
      .select({ jti: handoffTokenRedemptionsTable.jti })
      .from(handoffTokenRedemptionsTable)
      .where(eq(handoffTokenRedemptionsTable.jti, verified.jti))
      .limit(1);
    res.json(
      GetAnonymousClaimHandoffStatusResponse.parse({
        redeemed: existing.length > 0,
        expired: verified.expiresAt.getTime() <= Date.now(),
        expiresAt: verified.expiresAt.toISOString(),
      }),
    );
  },
);

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
    const verified = verifyHandoffToken(parsed.data.handoff);
    if (!verified) {
      sendExpiredHandoff(req, res, "Invalid or expired handoff token");
      return;
    }

    // Record the jti so this handoff link can never be redeemed twice.
    // ON CONFLICT DO NOTHING means a replay attempt produces zero inserted
    // rows — we treat that as "already redeemed" and bail out before
    // touching any anonymous rows. Doing this BEFORE the claim UPDATE
    // also makes the check atomic against concurrent redeem attempts.
    const inserted = await db
      .insert(handoffTokenRedemptionsTable)
      .values({
        jti: verified.jti,
        expiresAt: verified.expiresAt,
      })
      .onConflictDoNothing({ target: handoffTokenRedemptionsTable.jti })
      .returning({ jti: handoffTokenRedemptionsTable.jti });
    if (inserted.length === 0) {
      req.log.warn(
        { userId: req.user.id, jti: verified.jti },
        "Rejected replay of already-redeemed handoff token",
      );
      sendExpiredHandoff(req, res, "This handoff link has already been used");
      return;
    }

    const userId = req.user.id;
    const counts = await claimByAnonToken(
      userId,
      verified.anonToken,
      parsed.data,
    );
    logIfShortfall(req, userId, parsed.data, counts, "handoff");

    res.json(RedeemAnonymousClaimHandoffResponse.parse({ claimed: counts }));
  },
);

export default router;
