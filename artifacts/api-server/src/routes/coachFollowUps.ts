import { Router, type IRouter } from "express";
import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, coachFollowUpsTable } from "@workspace/db";
import {
  RecordCoachFollowUpBody,
  RecordCoachFollowUpResponse,
  GetCoachFollowUpStatsResponse,
  GetCoachFollowUpTimelineResponse,
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
      snoozeCount: 0,
      dismissCount: 0,
      lastAnsweredAt: null as string | null,
      lastAnswer: null as "sent" | "not_sent" | null,
    };
  }

  const [agg] = await db
    .select({
      total: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} in ('sent', 'not_sent'))::int`,
      sent: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'sent')::int`,
      notSent: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'not_sent')::int`,
      snoozed: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'snoozed')::int`,
      dismissed: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'dismissed')::int`,
      lastAt: sql<Date | string | null>`max(${coachFollowUpsTable.createdAt}) filter (where ${coachFollowUpsTable.answer} in ('sent', 'not_sent'))`,
    })
    .from(coachFollowUpsTable)
    .where(where);

  let lastAnswer: "sent" | "not_sent" | null = null;
  if (agg?.lastAt) {
    const [latest] = await db
      .select({ answer: coachFollowUpsTable.answer })
      .from(coachFollowUpsTable)
      .where(
        and(
          where,
          inArray(coachFollowUpsTable.answer, ["sent", "not_sent"]),
        ),
      )
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
    snoozeCount: agg?.snoozed ?? 0,
    dismissCount: agg?.dismissed ?? 0,
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

  const [inserted] = await db
    .insert(coachFollowUpsTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      sessionId: parsed.data.sessionId ?? null,
      answer: parsed.data.answer,
    })
    .returning({ id: coachFollowUpsTable.id });

  const stats = await loadStats(userId, anonToken ?? undefined);
  res.json(
    RecordCoachFollowUpResponse.parse({
      followUpId: inserted!.id,
      ...stats,
    }),
  );
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfIsoWeekUtc(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday-anchored
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

async function loadTimeline(
  userId: string | undefined,
  anonToken: string | undefined,
  weeks: number,
) {
  const now = new Date();
  const currentWeekStart = startOfIsoWeekUtc(now);
  const oldestStart = new Date(currentWeekStart.getTime() - (weeks - 1) * WEEK_MS);

  const buckets: {
    weekStart: string;
    sentCount: number;
    notSentCount: number;
    snoozeCount: number;
    dismissCount: number;
    total: number;
    sendThroughRate: number | null;
  }[] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = new Date(oldestStart.getTime() + i * WEEK_MS);
    buckets.push({
      weekStart: ws.toISOString().slice(0, 10),
      sentCount: 0,
      notSentCount: 0,
      snoozeCount: 0,
      dismissCount: 0,
      total: 0,
      sendThroughRate: null,
    });
  }

  const where = scope(userId, anonToken);
  if (!where) return { buckets };

  const rows = await db
    .select({
      weekStart: sql<Date>`date_trunc('week', ${coachFollowUpsTable.createdAt})`,
      answer: coachFollowUpsTable.answer,
      count: sql<number>`count(*)::int`,
    })
    .from(coachFollowUpsTable)
    .where(
      and(
        where,
        inArray(coachFollowUpsTable.answer, ["sent", "not_sent", "snoozed", "dismissed"]),
        sql`${coachFollowUpsTable.createdAt} >= ${oldestStart.toISOString()}`,
      ),
    )
    .groupBy(
      sql`date_trunc('week', ${coachFollowUpsTable.createdAt})`,
      coachFollowUpsTable.answer,
    );

  const byKey = new Map(buckets.map((b) => [b.weekStart, b]));
  for (const row of rows) {
    const wsDate = row.weekStart instanceof Date
      ? row.weekStart
      : new Date(row.weekStart);
    const key = wsDate.toISOString().slice(0, 10);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (row.answer === "sent") bucket.sentCount += row.count;
    else if (row.answer === "not_sent") bucket.notSentCount += row.count;
    else if (row.answer === "snoozed") bucket.snoozeCount += row.count;
    else if (row.answer === "dismissed") bucket.dismissCount += row.count;
  }
  for (const b of buckets) {
    b.total = b.sentCount + b.notSentCount;
    b.sendThroughRate = b.total > 0 ? b.sentCount / b.total : null;
  }
  return { buckets };
}

router.get("/coach/follow-ups/timeline", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const anonToken = userId ? undefined : getAnonClaimToken(req);
  const timeline = await loadTimeline(userId, anonToken, 8);
  res.json(GetCoachFollowUpTimelineResponse.parse(timeline));
});

router.get("/coach/follow-ups/stats", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const anonToken = userId ? undefined : getAnonClaimToken(req);
  const stats = await loadStats(userId, anonToken);
  res.json(GetCoachFollowUpStatsResponse.parse(stats));
});

export default router;
