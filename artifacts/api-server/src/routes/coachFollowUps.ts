import { Router, type IRouter } from "express";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, coachFollowUpsTable } from "@workspace/db";
import {
  RecordCoachFollowUpBody,
  RecordCoachFollowUpResponse,
} from "@workspace/api-zod";
import {
  getOrCreateAnonClaimToken,
  getAnonClaimToken,
} from "../lib/anonClaimToken";

const router: IRouter = Router();

function scope(
  userId: string | undefined,
  anonToken: string | undefined,
): SQL | undefined {
  if (userId) return eq(coachFollowUpsTable.userId, userId);
  if (anonToken) {
    return and(
      isNull(coachFollowUpsTable.userId),
      eq(coachFollowUpsTable.anonymousClaimToken, anonToken),
    );
  }
  return undefined;
}

async function loadStats(
  userId: string | undefined,
  anonToken: string | undefined,
) {
  const where = scope(userId, anonToken);
  if (!where) {
    return {
      totalPrompts: 0,
      sentCount: 0,
      notSentCount: 0,
      lastAnsweredAt: null as string | null,
      lastAnswer: null as "sent" | "not_sent" | null,
    };
  }

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'sent')::int`,
      notSent: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'not_sent')::int`,
      lastAt: sql<Date | string | null>`max(${coachFollowUpsTable.createdAt})`,
    })
    .from(coachFollowUpsTable)
    .where(where);

  let lastAnswer: "sent" | "not_sent" | null = null;
  if (agg?.lastAt) {
    const [latest] = await db
      .select({ answer: coachFollowUpsTable.answer })
      .from(coachFollowUpsTable)
      .where(where)
      .orderBy(sql`${coachFollowUpsTable.createdAt} desc`)
      .limit(1);
    if (latest?.answer === "sent" || latest?.answer === "not_sent") {
      lastAnswer = latest.answer;
    }
  }

  return {
    totalPrompts: agg?.total ?? 0,
    sentCount: agg?.sent ?? 0,
    notSentCount: agg?.notSent ?? 0,
    lastAnsweredAt: agg?.lastAt
      ? (agg.lastAt instanceof Date
          ? agg.lastAt.toISOString()
          : new Date(agg.lastAt).toISOString())
      : null,
    lastAnswer,
  };
}

router.post("/coach/follow-ups", async (req, res): Promise<void> => {
  const parsed = RecordCoachFollowUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  await db.insert(coachFollowUpsTable).values({
    userId: userId ?? null,
    anonymousClaimToken: anonToken,
    sessionId: parsed.data.sessionId ?? null,
    answer: parsed.data.answer,
  });

  const stats = await loadStats(userId, anonToken ?? undefined);
  res.json(RecordCoachFollowUpResponse.parse(stats));
});

router.get("/coach/follow-ups/stats", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const anonToken = userId ? undefined : getAnonClaimToken(req);
  const stats = await loadStats(userId, anonToken);
  res.json(RecordCoachFollowUpResponse.parse(stats));
});

export default router;
