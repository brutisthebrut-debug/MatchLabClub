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
import {
  GetMirrorTrendsResponse,
  GetMirrorPortraitResponse,
  AskMirrorBody,
  AskMirrorResponse,
} from "@workspace/api-zod";
import {
  analyzeAuditTrends,
  buildMirrorPortrait,
  answerMirrorQuestion,
  type AuditTrendInputAudit,
} from "../lib/aiEngine";
import { computeNextActions } from "../lib/readiness";
import {
  computeReadiness,
  computeOutcomeInsightForUser,
  readinessThreshold,
} from "./matching";
import { generate } from "../lib/aiService";
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

// Gather the user's real signal coverage and synthesize the deterministic
// self-portrait. Shared by both Mirror endpoints so they read the same brain.
export async function loadMirrorPortrait(userId: string) {
  const readiness = await computeReadiness(userId);
  const outcome = await computeOutcomeInsightForUser(userId);
  const threshold = await readinessThreshold();
  const eligible = readiness.score >= threshold;
  // Force eligible=false so we always surface the single highest-leverage lane
  // to deepen next, even for users already past the matching threshold.
  const nextActions = computeNextActions(
    readiness.breakdown,
    false,
    1,
    readiness.weights,
  );
  return buildMirrorPortrait({
    breakdown: readiness.breakdown,
    score: readiness.score,
    eligible,
    threshold,
    nextActions,
    outcome,
  });
}

router.get("/mirror/portrait", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to see your Mirror." });
    return;
  }
  const portrait = await loadMirrorPortrait(userId);
  res.json(GetMirrorPortraitResponse.parse(portrait));
});

router.post("/mirror/ask", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to talk to your Mirror." });
    return;
  }
  const parsed = AskMirrorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const question = parsed.data.question;

  const portrait = await loadMirrorPortrait(userId);

  // Deterministic baseline always answers. Grounding (the real signals the
  // answer leans on) is computed here, never by the model, so citations are
  // always true.
  const deterministic = answerMirrorQuestion(portrait, question);
  let answer = deterministic.answer;
  let followUp = deterministic.followUp;
  const grounding = deterministic.grounding;
  let isFallback = true;

  // Deep AI lane: when the account has granted content consent, Claude reshapes
  // the answer in a warmer voice. It only ever sees aggregate, derived portrait
  // lines (no raw content or PII), the same posture as the matching external
  // read. Anything short of a clean, schema-valid result (no consent, daily cap
  // hit, provider down, malformed JSON) keeps the deterministic answer.
  const knownLines = portrait.known
    .map(
      (k) =>
        `- ${k.label} (${k.coverage}% covered, confidence ${k.confidence}%): ${k.insight}`,
    )
    .join("\n");
  const blindLines = portrait.blindSpots
    .map((b) => `- ${b.label}: ${b.why}`)
    .join("\n");
  const nextLine = portrait.nextSignal
    ? `${portrait.nextSignal.label} (about ${portrait.nextSignal.points} points): ${portrait.nextSignal.detail}`
    : "none, the picture is fairly complete";

  const system = [
    "You are Your Mirror inside MatchLab Club: the evolving model the app keeps",
    "of one user, built only from the real signals they have fed it. You speak",
    "as that mirror, in second person, honest and warm. You never invent facts.",
    "You only reason from the portrait below. If the portrait does not cover",
    "something, say plainly that you cannot see it yet and point at the signal",
    "that would fill the gap. Keep it to 2 to 5 sentences.",
    "",
    `Readiness: ${portrait.readinessScore} out of 100 (matching opens at ${portrait.threshold}; user is ${portrait.eligible ? "eligible" : "not yet eligible"}).`,
    `Stage: ${portrait.stageLabel}.`,
    `Headline read: ${portrait.headline}`,
    "",
    knownLines
      ? `What the machine can see:\n${knownLines}`
      : "The machine cannot see anything yet; the user has fed it nothing.",
    "",
    blindLines ? `Blind spots:\n${blindLines}` : "No notable blind spots.",
    "",
    `Single best next signal to feed: ${nextLine}`,
    portrait.totalDates > 0
      ? `Date track record: ${portrait.outcomeHeadline}`
      : "No real date outcomes logged yet.",
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "answer": "your reply to the user, grounded only in the portrait",',
    '  "followUp": "one short question the user could ask you next" }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'game-changer', 'cutting-edge',",
    "'dive in', or 'in today's world'. No emojis. Vary sentence length. Sound human.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: question,
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: { toolName: "Your Mirror" },
        maxTokens: 600,
      },
      "",
    );

    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = JSON.parse(aiResult.output) as {
        answer?: string;
        followUp?: string;
      };
      if (ai.answer && ai.followUp) {
        answer = ai.answer;
        followUp = ai.followUp;
        isFallback = false;
      }
    } else if (aiResult.fallbackReason) {
      req.log.info(
        { fallbackReason: aiResult.fallbackReason },
        "mirror ask fell back to deterministic baseline",
      );
    }
  } catch (err) {
    // generate() handles provider errors internally, but any unexpected throw
    // must never fail the request: the deterministic answer already covers it.
    answer = deterministic.answer;
    followUp = deterministic.followUp;
    isFallback = true;
    req.log.warn(
      { err },
      "mirror deep-AI lane threw; using deterministic baseline",
    );
  }

  res.json(AskMirrorResponse.parse({ answer, grounding, followUp, isFallback }));
});

export default router;
