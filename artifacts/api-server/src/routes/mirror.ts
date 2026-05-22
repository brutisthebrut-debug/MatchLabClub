import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  db,
  auditsTable,
  coachFollowUpsTable,
  lifePulsesTable,
  journalEntriesTable,
  postDateNotesTable,
} from "@workspace/db";
import { GetMirrorTrendsResponse } from "@workspace/api-zod";
import {
  analyzeAuditTrends,
  type AuditTrendInputAudit,
} from "../lib/aiEngine";
import { getAnonClaimToken } from "../lib/anonClaimToken";

const router: IRouter = Router();

function ownerScope(req: Request): SQL {
  if (req.user?.id) return eq(auditsTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(auditsTable.userId),
      eq(auditsTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

function activeOwnerScope(req: Request): SQL {
  return and(ownerScope(req), isNull(auditsTable.deletedAt)) as SQL;
}

function lifePulseScope(req: Request): SQL {
  if (req.user?.id) return eq(lifePulsesTable.userId, req.user.id);
  const anon = getAnonClaimToken(req);
  if (anon) {
    return and(
      isNull(lifePulsesTable.userId),
      eq(lifePulsesTable.anonymousClaimToken, anon),
    ) as SQL;
  }
  return sql`false`;
}

function followUpScope(req: Request): SQL {
  if (req.user?.id) return eq(coachFollowUpsTable.userId, req.user.id);
  const anon = getAnonClaimToken(req);
  if (anon) {
    return and(
      isNull(coachFollowUpsTable.userId),
      eq(coachFollowUpsTable.anonymousClaimToken, anon),
    ) as SQL;
  }
  return sql`false`;
}

function journalScope(req: Request): SQL {
  if (req.user?.id) return eq(journalEntriesTable.userId, req.user.id);
  const anon = getAnonClaimToken(req);
  if (anon) {
    return and(
      isNull(journalEntriesTable.userId),
      eq(journalEntriesTable.anonymousClaimToken, anon),
    ) as SQL;
  }
  return sql`false`;
}

function postDateScope(req: Request): SQL {
  if (req.user?.id) return eq(postDateNotesTable.userId, req.user.id);
  const anon = getAnonClaimToken(req);
  if (anon) {
    return and(
      isNull(postDateNotesTable.userId),
      eq(postDateNotesTable.anonymousClaimToken, anon),
    ) as SQL;
  }
  return sql`false`;
}

router.get("/mirror/trends", async (req, res): Promise<void> => {
  const auditRows = await db
    .select()
    .from(auditsTable)
    .where(activeOwnerScope(req))
    .orderBy(auditsTable.createdAt);

  const inputs: AuditTrendInputAudit[] = auditRows.map((a) => {
    const report = (a.report ?? null) as Record<string, unknown> | null;
    const strengths = Array.isArray(report?.strengths)
      ? (report!.strengths as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    const risks = Array.isArray(report?.risks)
      ? (report!.risks as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    return {
      id: a.id,
      readinessScore: a.readinessScore,
      strengths,
      risks,
      createdAt:
        a.createdAt instanceof Date
          ? a.createdAt.toISOString()
          : String(a.createdAt),
      currentApps: a.currentApps ?? [],
      biggestChallenge: a.biggestChallenge ?? null,
    };
  });

  const [statsAgg] = await db
    .select({
      total: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} in ('sent', 'not_sent'))::int`,
      sent: sql<number>`count(*) filter (where ${coachFollowUpsTable.answer} = 'sent')::int`,
    })
    .from(coachFollowUpsTable)
    .where(followUpScope(req));

  const sendStats =
    statsAgg && statsAgg.total > 0
      ? { totalPrompts: statsAgg.total, sentCount: statsAgg.sent }
      : null;

  const pulseRows = await db
    .select()
    .from(lifePulsesTable)
    .where(lifePulseScope(req))
    .orderBy(desc(lifePulsesTable.createdAt))
    .limit(14);

  const lifePulses = pulseRows.map((p) => ({
    energy: p.energy,
    headspace: p.headspace,
    createdAt:
      p.createdAt instanceof Date
        ? p.createdAt.toISOString()
        : String(p.createdAt),
  }));

  const journalRows = await db
    .select({
      createdAt: journalEntriesTable.createdAt,
      mood: journalEntriesTable.mood,
    })
    .from(journalEntriesTable)
    .where(and(journalScope(req), isNull(journalEntriesTable.deletedAt)));
  const journalEntries = journalRows.map((j) => ({
    createdAt:
      j.createdAt instanceof Date
        ? j.createdAt.toISOString()
        : String(j.createdAt),
    mood: j.mood ?? null,
  }));

  const postDateRows = await db
    .select({
      dateAt: postDateNotesTable.dateAt,
      createdAt: postDateNotesTable.createdAt,
      outcome: postDateNotesTable.outcome,
    })
    .from(postDateNotesTable)
    .where(and(postDateScope(req), isNull(postDateNotesTable.deletedAt)));
  const postDateNotes = postDateRows.map((n) => ({
    dateAt:
      n.dateAt instanceof Date
        ? n.dateAt.toISOString()
        : n.dateAt
          ? String(n.dateAt)
          : null,
    createdAt:
      n.createdAt instanceof Date
        ? n.createdAt.toISOString()
        : String(n.createdAt),
    outcome: n.outcome ?? null,
  }));

  const report = analyzeAuditTrends({
    audits: inputs,
    sendStats,
    lifePulses,
    journalEntries,
    postDateNotes,
  });

  res.json(GetMirrorTrendsResponse.parse(report));
});

export default router;
