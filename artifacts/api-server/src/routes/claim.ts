import { Router, type IRouter } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
} from "@workspace/db";
import { ClaimAnonymousDataBody, ClaimAnonymousDataResponse } from "@workspace/api-zod";
import {
  getAnonClaimToken,
  clearAnonClaimToken,
} from "../lib/anonClaimToken";

const router: IRouter = Router();

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
        claimed: { audits: 0, profiles: 0, messages: 0, insights: 0 },
      }),
    );
    return;
  }

  const {
    auditIds = [],
    profileIds = [],
    messageSessionIds = [],
    insightIds = [],
  } = parsed.data;

  const dedup = (xs: number[]): number[] =>
    Array.from(new Set(xs.filter((x) => Number.isInteger(x) && x > 0)));

  const a = dedup(auditIds);
  const p = dedup(profileIds);
  const m = dedup(messageSessionIds);
  const i = dedup(insightIds);

  const [audits, profiles, messages, insights] = await Promise.all([
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
  ]);

  const requested = a.length + p.length + m.length + i.length;
  const claimedTotal =
    audits.length + profiles.length + messages.length + insights.length;

  if (requested > claimedTotal) {
    req.log.warn(
      {
        userId,
        requested,
        claimed: claimedTotal,
      },
      "Anonymous claim request included IDs not owned by this browser token",
    );
  }

  req.log.info(
    {
      userId,
      claimed: {
        audits: audits.length,
        profiles: profiles.length,
        messages: messages.length,
        insights: insights.length,
      },
    },
    "Claimed anonymous data on login",
  );

  // Once everything matching this browser's token is claimed, retire the
  // cookie so it can't be reused to grab future anonymous rows.
  clearAnonClaimToken(res);

  res.json(
    ClaimAnonymousDataResponse.parse({
      claimed: {
        audits: audits.length,
        profiles: profiles.length,
        messages: messages.length,
        insights: insights.length,
      },
    }),
  );
});

export default router;
