import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db, auditsTable, auditReportVersionsTable } from "@workspace/db";
import {
  CreateAuditBody,
  ListAuditsResponse,
  GetAuditResponse,
  GenerateAuditReportResponse,
  GetAuditSummaryResponse,
  AuditFromScreenshotBody,
  AuditFromScreenshotResponse,
  DeleteAuditResponse,
  ExtractScreenshotBody,
  ExtractScreenshotResponse,
  BulkDeleteAuditsBody,
  BulkDeleteAuditsResponse,
  EmptyTrashResponse,
  RestoreAllTrashResponse,
  ListExpiringTrashedAuditsResponse,
  ListAuditReportVersionsResponse,
  GetAuditReportVersionResponse,
} from "@workspace/api-zod";
import { z } from "zod/v4";
import type { BioRewriteOutput } from "@workspace/ai-schemas";
import { generateAuditReport, type AuditReportOutput } from "../lib/aiEngine";
import { generate, analyzeProfilePhotos } from "../lib/aiService";
import { getRetentionDays } from "../lib/auditTrashPurge";
import { pruneVersionsForAudit } from "../lib/auditVersionPurge";
import { recordJourneyEvent } from "../lib/journeyEvents";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { extractProfileFromScreenshot, detectLowConfidenceFields } from "../lib/ocr";
import { assessAuditEvidence } from "../lib/auditEvidence";
import type { OcrCorrectionsRecord, OcrCorrectionEntry } from "@workspace/db";
import type { Request } from "express";

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

/**
 * Owner scope restricted to audits that have not been soft-deleted.
 * Used by every "active list" surface (list, summary, get-by-id, generate, ...)
 * so users only ever see audits they haven't moved to the trash.
 */
function activeOwnerScope(req: Request): SQL {
  return and(ownerScope(req), isNull(auditsTable.deletedAt)) as SQL;
}

function serializeAudit(a: typeof auditsTable.$inferSelect) {
  return {
    ...a,
    report: a.report ?? null,
    reportGeneratedAt:
      a.reportGeneratedAt instanceof Date
        ? a.reportGeneratedAt.toISOString()
        : a.reportGeneratedAt ?? null,
    previousReport: a.previousReport ?? null,
    previousReadinessScore: a.previousReadinessScore ?? null,
    previousReportGeneratedAt:
      a.previousReportGeneratedAt instanceof Date
        ? a.previousReportGeneratedAt.toISOString()
        : a.previousReportGeneratedAt ?? null,
    createdAt:
      a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    deletedAt:
      a.deletedAt instanceof Date
        ? a.deletedAt.toISOString()
        : a.deletedAt ?? null,
  };
}

router.get("/audits/summary", async (req, res): Promise<void> => {
  const audits = await db
    .select()
    .from(auditsTable)
    .where(activeOwnerScope(req))
    .orderBy(auditsTable.createdAt);

  const completed = audits.filter((a) => a.readinessScore !== null);
  const scores = completed.map((a) => a.readinessScore as number);
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
  const latest = scores.length ? scores[scores.length - 1] : null;

  const scoreHistory = completed.map((a) => ({
    date: a.createdAt instanceof Date ? a.createdAt.toISOString().split("T")[0] : String(a.createdAt).split("T")[0],
    score: a.readinessScore as number,
  }));

  const summary = GetAuditSummaryResponse.parse({
    totalAudits: audits.length,
    averageScore: avg,
    latestScore: latest,
    scoreHistory,
    topStrengths: [
      "Genuine warmth and emotional availability",
      "Clear intention about what you're looking for",
      "Consistency and follow-through in conversations",
    ],
    topRisks: [
      "Generic bio language reduces visibility",
      "Opening messages lack specificity",
      "Photo selection needs strategic curation",
    ],
  });

  res.json(summary);
});

function parseIntInRange(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function bigramOverlap(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const toBigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const aSet = toBigrams(a);
  const bSet = toBigrams(b);
  let count = 0;
  for (const bg of aSet) {
    if (bSet.has(bg)) count++;
  }
  return count;
}

function extractBioSnippet(text: string, matchIdx: number, matchLen: number): string {
  const PAD = 40;
  const start = Math.max(0, matchIdx - PAD);
  const end = Math.min(text.length, matchIdx + matchLen + PAD);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "\u2026" + snippet;
  if (end < text.length) snippet = snippet + "\u2026";
  return snippet;
}

function buildMatchContext(
  q: string,
  firstName: string,
  bio: string,
): { matchedField: "name" | "bio"; snippet: string | null } | null {
  if (!q) return null;
  const qLow = q.toLowerCase();
  const nameLow = firstName.toLowerCase();
  const bioLow = bio.toLowerCase();

  // Exact substring: name wins first
  if (nameLow.includes(qLow)) {
    return { matchedField: "name", snippet: null };
  }
  // Exact substring: bio
  const bioIdx = bioLow.indexOf(qLow);
  if (bioIdx !== -1) {
    return { matchedField: "bio", snippet: extractBioSnippet(bio, bioIdx, q.length) };
  }
  // Word-level: any word in the query appears in name
  const words = qLow.split(/\s+/).filter(Boolean);
  if (words.some((w) => nameLow.includes(w))) {
    return { matchedField: "name", snippet: null };
  }
  // Word-level: any word in the query appears in bio
  let wordBioIdx = -1;
  let wordLen = 0;
  for (const w of words) {
    const idx = bioLow.indexOf(w);
    if (idx !== -1) { wordBioIdx = idx; wordLen = w.length; break; }
  }
  if (wordBioIdx !== -1) {
    return { matchedField: "bio", snippet: extractBioSnippet(bio, wordBioIdx, wordLen) };
  }
  // Fuzzy fallback: bigram overlap determines which field matched better
  const nameScore = bigramOverlap(qLow, nameLow);
  const bioScore = bigramOverlap(qLow, bioLow);
  if (nameScore >= bioScore && nameScore > 0) {
    return { matchedField: "name", snippet: null };
  }
  if (bio.length > 0) {
    const snippet = bio.length > 80 ? bio.slice(0, 80).trimEnd() + "\u2026" : bio;
    return { matchedField: "bio", snippet };
  }
  return { matchedField: "name", snippet: null };
}

router.get("/audits", async (req, res): Promise<void> => {
  const sourceParam = typeof req.query.source === "string" ? req.query.source : undefined;
  const sourceFilter =
    sourceParam === "manual" || sourceParam === "screenshot"
      ? eq(auditsTable.source, sourceParam)
      : undefined;

  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const qFilter =
    qRaw.length === 0
      ? undefined
      : qRaw.length <= 2
        ? or(
            ilike(auditsTable.firstName, `%${escapeLike(qRaw)}%`),
            ilike(auditsTable.bio, `%${escapeLike(qRaw)}%`),
          )
        : or(
            ilike(auditsTable.firstName, `%${escapeLike(qRaw)}%`),
            ilike(auditsTable.bio, `%${escapeLike(qRaw)}%`),
            sql`${auditsTable.firstName} % ${qRaw}`,
            sql`${auditsTable.bio} % ${qRaw}`,
            sql`word_similarity(${qRaw}, ${auditsTable.firstName}) > 0.5`,
            sql`word_similarity(${qRaw}, ${auditsTable.bio}) > 0.5`,
          );

  const scoreRangeParam =
    typeof req.query.scoreRange === "string" ? req.query.scoreRange : undefined;
  let scoreFilter: SQL | undefined;
  if (scoreRangeParam === "high") {
    scoreFilter = gte(auditsTable.readinessScore, 75);
  } else if (scoreRangeParam === "medium") {
    scoreFilter = and(
      gte(auditsTable.readinessScore, 55),
      lt(auditsTable.readinessScore, 75),
    ) as SQL;
  } else if (scoreRangeParam === "low") {
    scoreFilter = and(
      isNotNull(auditsTable.readinessScore),
      lt(auditsTable.readinessScore, 55),
    ) as SQL;
  }

  const sortParam =
    req.query.sort === "topScore" ? "topScore" : "newest";

  const limit = parseIntInRange(req.query.limit, 1, 100, 50);
  const offset = parseIntInRange(req.query.offset, 0, Number.MAX_SAFE_INTEGER, 0);

  const where = and(
    activeOwnerScope(req),
    ...[sourceFilter, qFilter, scoreFilter].filter(
      (f): f is SQL => f !== undefined,
    ),
  ) as SQL;

  const baseOrderBy =
    sortParam === "topScore"
      ? [desc(auditsTable.readinessScore), desc(auditsTable.createdAt)]
      : [desc(auditsTable.createdAt)];
  const orderBy: (SQL | ReturnType<typeof desc>)[] =
    qRaw.length > 0
      ? [
          desc(sql`GREATEST(
            similarity(${auditsTable.firstName}, ${qRaw}),
            word_similarity(${qRaw}, COALESCE(${auditsTable.bio}, ''))
          )`),
          ...baseOrderBy,
        ]
      : baseOrderBy;

  const audits = await db
    .select()
    .from(auditsTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const serialized = audits.map((a) => {
    const base = serializeAudit(a);
    if (qRaw.length === 0) return base;
    return { ...base, matchContext: buildMatchContext(qRaw, a.firstName, a.bio ?? "") };
  });
  res.json(ListAuditsResponse.parse(serialized));
});

router.post("/audits", async (req, res): Promise<void> => {
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const anonymousClaimToken = req.user?.id
    ? null
    : getOrCreateAnonClaimToken(req, res);

  const [audit] = await db
    .insert(auditsTable)
    .values({
      ...parsed.data,
      status: "pending",
      userId: req.user?.id ?? null,
      anonymousClaimToken,
    })
    .returning();

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: req.user?.id ?? null,
    anonId: anonymousClaimToken,
    props: { source: "audit" },
  });

  res.status(201).json(GetAuditResponse.parse(serializeAudit(audit)));
});

router.get("/audits/trash/expiring-soon", async (req, res): Promise<void> => {
  const retentionDays = getRetentionDays();
  const withinDaysRaw =
    typeof req.query.withinDays === "string" ? req.query.withinDays : undefined;
  const withinDays = parseIntInRange(withinDaysRaw, 1, 30, 3);

  // Fetch every trashed audit the caller owns, then filter to those whose
  // purge moment (deletedAt + retentionDays) is within the next `withinDays`.
  // Trash sets are tiny per user (capped at the 30-day retention window), so
  // in-process filtering is fine and keeps the query portable.
  const trashed = await db
    .select()
    .from(auditsTable)
    .where(and(ownerScope(req), isNotNull(auditsTable.deletedAt)) as SQL)
    .orderBy(asc(auditsTable.deletedAt));

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const earliestDeletedMs = now - retentionDays * dayMs;
  const latestDeletedMs = now - (retentionDays - withinDays) * dayMs;
  const expiring = trashed.filter((a) => {
    if (!a.deletedAt) return false;
    const t =
      a.deletedAt instanceof Date
        ? a.deletedAt.getTime()
        : new Date(a.deletedAt).getTime();
    return t >= earliestDeletedMs && t < latestDeletedMs;
  });

  res.json(
    ListExpiringTrashedAuditsResponse.parse({
      audits: expiring.map(serializeAudit),
      retentionDays,
      withinDays,
    }),
  );
});

router.get("/audits/trash", async (req, res): Promise<void> => {
  const audits = await db
    .select()
    .from(auditsTable)
    .where(
      and(ownerScope(req), isNotNull(auditsTable.deletedAt)) as SQL,
    )
    .orderBy(desc(auditsTable.deletedAt));

  res.json(ListAuditsResponse.parse(audits.map(serializeAudit)));
});

router.post("/audits/trash/empty", async (req, res): Promise<void> => {
  const trashedScope = and(
    ownerScope(req),
    isNotNull(auditsTable.deletedAt),
  ) as SQL;

  const owned = await db
    .select({ id: auditsTable.id })
    .from(auditsTable)
    .where(trashedScope);

  const purgedIds = owned.map((row) => row.id);
  if (purgedIds.length > 0) {
    await db
      .delete(auditsTable)
      .where(
        and(inArray(auditsTable.id, purgedIds), trashedScope) as SQL,
      );
  }

  res.json(EmptyTrashResponse.parse({ success: true, purgedIds }));
});

router.post("/audits/trash/restore-all", async (req, res): Promise<void> => {
  const trashedScope = and(
    ownerScope(req),
    isNotNull(auditsTable.deletedAt),
  ) as SQL;

  const owned = await db
    .select({ id: auditsTable.id })
    .from(auditsTable)
    .where(trashedScope);

  const restoredIds = owned.map((row) => row.id);
  if (restoredIds.length > 0) {
    await db
      .update(auditsTable)
      .set({ deletedAt: null })
      .where(
        and(inArray(auditsTable.id, restoredIds), trashedScope) as SQL,
      );
  }

  res.json(RestoreAllTrashResponse.parse({ success: true, restoredIds }));
});

router.get("/audits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.json(GetAuditResponse.parse(serializeAudit(audit)));
});

const VALID_SOURCE_APPS = new Set(["Hinge", "Bumble", "Tinder", "Grindr", "Feeld", "HER", "OkCupid", "CoffeeMeetsBagel"]);

const CorrectSourceAppBody = z.object({
  correctedApp: z.string().nullable(),
});

router.post("/audits/:id/correct-source-app", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = CorrectSourceAppBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { correctedApp } = parsed.data;

  if (correctedApp !== null && !VALID_SOURCE_APPS.has(correctedApp)) {
    res.status(400).json({
      error: `Invalid app. Must be one of: ${[...VALID_SOURCE_APPS].join(", ")}, or null.`,
    });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const previousApp = audit.sourceApp ?? null;

  const updatedCorrections: OcrCorrectionsRecord = {
    ...((audit.ocrCorrections as OcrCorrectionsRecord | null) ?? {}),
  };

  if (previousApp !== correctedApp) {
    const entry: OcrCorrectionEntry = {
      raw: previousApp,
      corrected: correctedApp,
    };
    updatedCorrections.sourceApp = entry;
  }

  await db
    .update(auditsTable)
    .set({
      sourceApp: correctedApp,
      ocrCorrections: Object.keys(updatedCorrections).length > 0 ? updatedCorrections : null,
    })
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));

  res.json({ success: true, sourceApp: correctedApp });
});

router.delete("/audits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  await db
    .update(auditsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));

  res.json(DeleteAuditResponse.parse({ success: true, deletedId: id }));
});

router.post("/audits/:id/restore", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.id, id),
        ownerScope(req),
        isNotNull(auditsTable.deletedAt),
      ) as SQL,
    );
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  await db
    .update(auditsTable)
    .set({ deletedAt: null })
    .where(and(eq(auditsTable.id, id), ownerScope(req)));

  res.json(
    GetAuditResponse.parse(serializeAudit({ ...audit, deletedAt: null })),
  );
});

router.delete("/audits/:id/purge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.id, id),
        ownerScope(req),
        isNotNull(auditsTable.deletedAt),
      ) as SQL,
    );
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  await db.delete(auditsTable).where(eq(auditsTable.id, id));

  res.json(DeleteAuditResponse.parse({ success: true, deletedId: id }));
});

router.post("/audits/bulk-delete", async (req, res): Promise<void> => {
  const parsed = BulkDeleteAuditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const uniqueIds = Array.from(new Set(parsed.data.ids));
  const owned = await db
    .select({ id: auditsTable.id })
    .from(auditsTable)
    .where(
      and(
        inArray(auditsTable.id, uniqueIds),
        ownerScope(req),
        isNull(auditsTable.deletedAt),
      ) as SQL,
    );

  const deletableIds = owned.map((row) => row.id);
  if (deletableIds.length > 0) {
    await db
      .update(auditsTable)
      .set({ deletedAt: new Date() })
      .where(inArray(auditsTable.id, deletableIds));
  }

  res.json(
    BulkDeleteAuditsResponse.parse({ success: true, deletedIds: deletableIds }),
  );
});

// Deep AI lane for the bio rewrite. The deterministic report is the always-on
// baseline; this overlays ONLY the textual `rewrittenBio` and `bioAudit` fields
// with a Claude-enhanced version. readinessScore, grade, strengths, risks,
// prompt rewrites, photo guidance, and the action plan stay 100% deterministic
// so audit history, score filters, and change summaries are unaffected.
async function enhanceBioRewriteWithAi(
  base: AuditReportOutput,
  input: {
    firstName: string;
    bio: string;
    prompts?: string | null;
    datingGoal: string;
    currentApps: string[];
    sourceApp?: string | null;
  },
  userId: string | null | undefined,
  log: Request["log"],
): Promise<AuditReportOutput> {
  // Anonymous audits never reach the hosted AI lane; their deterministic rewrite
  // already covers them. Only authenticated users with content consent (gated
  // inside generate) get the Claude-enhanced bio.
  if (!userId) return base;

  try {
    const appLine =
      input.currentApps.filter(Boolean).join(", ") || "unspecified";
    const system = [
      "You are Echo, a candid dating-profile editor. Rewrite the user's dating",
      "app bio so it is specific, warm, and true to them, then write a short,",
      "honest audit of what the original got right and what it got wrong.",
      `Their app(s): ${appLine}. Their dating goal: ${input.datingGoal}.`,
      "Keep the rewrite realistic for a real profile: no clichés, no stacking",
      "adjectives, lead with one concrete specific detail a stranger could ask",
      "about.",
      "Voice rules: no em dashes. No filler like 'unlock', 'elevate', 'dive in',",
      "'game-changer', 'seamless', 'in today's world', 'buckle up'. Vary sentence",
      "length. Be specific, not generic.",
      "Return JSON only, no prose, no code fences:",
      '{ "rewrittenBio": "the improved bio", "bioAudit": "2-4 sentence honest critique" }',
    ].join("\n");

    const userContent = [
      `First name: ${input.firstName}`,
      `Original bio:\n${input.bio}`,
      input.prompts ? `Prompts:\n${input.prompts}` : null,
      `Deterministic baseline rewrite (improve on this, do not just echo it):\n${base.rewrittenBio}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n\n");

    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: userContent,
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: {
          toolName: "Bio Rewrite",
          goals: input.datingGoal ? [input.datingGoal] : undefined,
        },
        maxTokens: 1200,
      },
      "",
    );

    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const parsed = JSON.parse(aiResult.output) as BioRewriteOutput;
      return {
        ...base,
        rewrittenBio: parsed.rewrittenBio,
        bioAudit: parsed.bioAudit,
      };
    }
    if (aiResult.fallbackReason) {
      log.info(
        { userId, fallbackReason: aiResult.fallbackReason },
        "audit bio rewrite fell back to deterministic baseline",
      );
    }
    return base;
  } catch (err) {
    // generate() handles provider errors internally, but any unexpected throw
    // (consent lookup, JSON parse, etc.) must never fail the audit: the
    // deterministic report already covers it.
    log.warn(
      { err, userId },
      "audit bio rewrite deep-AI lane threw; using deterministic baseline",
    );
    return base;
  }
}

async function generateAndPersistAuditReport(
  audit: typeof auditsTable.$inferSelect,
  userId: string | null,
  log: Request["log"],
) {
  const id = audit.id;
  const priorReport = audit.report ?? null;
  const priorScore = audit.readinessScore ?? null;
  const priorGeneratedAt = audit.reportGeneratedAt ?? null;

  await db
    .update(auditsTable)
    .set({ status: "generating" })
    .where(eq(auditsTable.id, id));

  const baseReport = generateAuditReport({
    firstName: audit.firstName,
    bio: audit.bio,
    prompts: audit.prompts,
    datingGoal: audit.datingGoal,
    currentApps: audit.currentApps,
    biggestChallenge: audit.biggestChallenge,
    recentMessageSample: audit.recentMessageSample,
    sourceApp: audit.sourceApp,
  });
  const report = await enhanceBioRewriteWithAi(
    baseReport,
    {
      firstName: audit.firstName,
      bio: audit.bio,
      prompts: audit.prompts,
      datingGoal: audit.datingGoal,
      currentApps: audit.currentApps,
      sourceApp: audit.sourceApp,
    },
    userId,
    log,
  );

  const changeSummary = buildChangeSummary(priorReport, priorScore, report);
  const fullReport = {
    auditId: id,
    ...report,
    ...(changeSummary ? { changeSummary } : {}),
  };

  const newGeneratedAt = new Date();
  await db
    .update(auditsTable)
    .set({
      status: "complete",
      readinessScore: report.readinessScore,
      report: fullReport,
      reportGeneratedAt: newGeneratedAt,
      ...(priorReport
        ? {
            previousReport: priorReport,
            previousReadinessScore: priorScore,
            previousReportGeneratedAt: priorGeneratedAt,
          }
        : {}),
    })
    .where(eq(auditsTable.id, id));

  const existingVersions = await db
    .select({ id: auditReportVersionsTable.id })
    .from(auditReportVersionsTable)
    .where(eq(auditReportVersionsTable.auditId, id))
    .limit(1);
  if (existingVersions.length === 0 && priorReport && priorScore !== null) {
    const priorEngineVersion =
      (priorReport as { engineVersion?: string | null }).engineVersion ?? null;
    await db.insert(auditReportVersionsTable).values({
      auditId: id,
      readinessScore: priorScore,
      report: priorReport,
      changeSummary: null,
      engineVersion: priorEngineVersion,
      generatedAt: priorGeneratedAt ?? newGeneratedAt,
    });
  }
  await db.insert(auditReportVersionsTable).values({
    auditId: id,
    readinessScore: report.readinessScore,
    report: fullReport,
    changeSummary: changeSummary ?? null,
    engineVersion: report.engineVersion ?? null,
    generatedAt: newGeneratedAt,
  });
  await pruneVersionsForAudit(id);

  return { fullReport, report, newGeneratedAt };
}

function sendInsufficientEvidence(
  res: import("express").Response,
  evidence: Exclude<ReturnType<typeof assessAuditEvidence>, { sufficient: true }>,
): void {
  res.status(422).json({
    error: "insufficient_evidence",
    message:
      "This source does not contain enough reliable profile evidence to generate a read.",
    fields: evidence.fields,
    reasons: evidence.reasons,
  });
}

// Canonical Profile Project service: validates the source, saves it, generates
// the first immutable report version, and returns the durable record in one
// member-owned workflow.
router.post("/me/profile-project/audits", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const evidence = assessAuditEvidence(parsed.data);
  if (!evidence.sufficient) {
    sendInsufficientEvidence(res, evidence);
    return;
  }

  const [audit] = await db
    .insert(auditsTable)
    .values({
      ...parsed.data,
      status: "generating",
      userId: req.user.id,
      anonymousClaimToken: null,
    })
    .returning();

  try {
    const generated = await generateAndPersistAuditReport(
      audit!,
      req.user.id,
      req.log,
    );
    void recordJourneyEvent({
      eventType: "signal_fed",
      userId: req.user.id,
      anonId: null,
      props: { source: "profile_project_audit" },
    });
    res.status(201).json({
      audit: serializeAudit({
        ...audit!,
        status: "complete",
        readinessScore: generated.report.readinessScore,
        report: generated.fullReport,
        reportGeneratedAt: generated.newGeneratedAt,
      }),
      report: generated.fullReport,
    });
  } catch (err) {
    await db
      .update(auditsTable)
      .set({ status: "error", report: null, readinessScore: null })
      .where(eq(auditsTable.id, audit!.id));
    req.log.error({ err, auditId: audit!.id }, "Profile Project audit failed");
    res.status(500).json({
      error: "audit_generation_failed",
      message: "The source was saved, but no read was generated. Try again.",
      auditId: audit!.id,
    });
  }
});

router.post("/audits/:id/generate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const evidence = assessAuditEvidence(audit);
  if (!evidence.sufficient) {
    sendInsufficientEvidence(res, evidence);
    return;
  }

  const { fullReport } = await generateAndPersistAuditReport(
    audit,
    req.user?.id ?? null,
    req.log,
  );
  res.json(GenerateAuditReportResponse.parse(fullReport));
});

function serializeReportVersion(v: typeof auditReportVersionsTable.$inferSelect) {
  return {
    id: v.id,
    auditId: v.auditId,
    readinessScore: v.readinessScore,
    report: v.report,
    changeSummary: v.changeSummary ?? null,
    engineVersion: v.engineVersion ?? null,
    generatedAt:
      v.generatedAt instanceof Date
        ? v.generatedAt.toISOString()
        : String(v.generatedAt),
  };
}

router.get("/audits/:id/versions", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Ownership check via the parent audit. Avoids exposing version rows from
  // other users even if the route is hit directly.
  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const versions = await db
    .select()
    .from(auditReportVersionsTable)
    .where(eq(auditReportVersionsTable.auditId, id))
    .orderBy(desc(auditReportVersionsTable.generatedAt));

  res.json(
    ListAuditReportVersionsResponse.parse({
      auditId: id,
      versions: versions.map(serializeReportVersion),
    }),
  );
});

router.get(
  "/audits/:id/versions/:versionId",
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawVid = Array.isArray(req.params.versionId)
      ? req.params.versionId[0]
      : req.params.versionId;
    const id = parseInt(rawId, 10);
    const versionId = parseInt(rawVid, 10);
    if (isNaN(id) || isNaN(versionId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(and(eq(auditsTable.id, id), activeOwnerScope(req)));
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const [version] = await db
      .select()
      .from(auditReportVersionsTable)
      .where(
        and(
          eq(auditReportVersionsTable.id, versionId),
          eq(auditReportVersionsTable.auditId, id),
        ) as SQL,
      );
    if (!version) {
      res.status(404).json({ error: "Version not found" });
      return;
    }

    res.json(
      GetAuditReportVersionResponse.parse(serializeReportVersion(version)),
    );
  },
);

function buildChangeSummary(
  prior: Record<string, unknown> | null,
  priorScore: number | null,
  next: { readinessScore: number; strengths: string[]; risks: string[] },
): {
  scoreDelta: number;
  previousScore: number;
  newScore: number;
  addedStrengths: string[];
  removedStrengths: string[];
  addedRisks: string[];
  removedRisks: string[];
} | null {
  if (!prior || priorScore === null) return null;
  const priorStrengths = Array.isArray(
    (prior as { strengths?: unknown }).strengths,
  )
    ? ((prior as { strengths: unknown[] }).strengths.filter(
        (s): s is string => typeof s === "string",
      ))
    : [];
  const priorRisks = Array.isArray((prior as { risks?: unknown }).risks)
    ? ((prior as { risks: unknown[] }).risks.filter(
        (s): s is string => typeof s === "string",
      ))
    : [];
  const prevSet = (xs: string[]) => new Set(xs.map((x) => x.trim()));
  const ps = prevSet(priorStrengths);
  const ns = prevSet(next.strengths);
  const pr = prevSet(priorRisks);
  const nr = prevSet(next.risks);
  return {
    scoreDelta: next.readinessScore - priorScore,
    previousScore: priorScore,
    newScore: next.readinessScore,
    addedStrengths: next.strengths.filter((s) => !ps.has(s.trim())),
    removedStrengths: priorStrengths.filter((s) => !ns.has(s.trim())),
    addedRisks: next.risks.filter((s) => !pr.has(s.trim())),
    removedRisks: priorRisks.filter((s) => !nr.has(s.trim())),
  };
}

router.post("/audits/extract-screenshot", async (req, res): Promise<void> => {
  const parsed = ExtractScreenshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let extracted: Awaited<ReturnType<typeof extractProfileFromScreenshot>>;
  try {
    extracted = await extractProfileFromScreenshot(parsed.data.imageBase64);
  } catch (err) {
    req.log.error({ err }, "OCR failed");
    res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
    return;
  }

  if (!extracted.bio && extracted.prompts.length === 0) {
    res.status(400).json({ error: "No readable profile text found in the screenshot." });
    return;
  }

  const lowConfidenceFields = detectLowConfidenceFields({
    firstName: extracted.firstName,
    age: extracted.age,
    sourceApp: extracted.sourceApp,
    bio: extracted.bio,
    prompts: extracted.prompts,
  });

  res.json(
    ExtractScreenshotResponse.parse({
      firstName: extracted.firstName,
      age: extracted.age,
      sourceApp: extracted.sourceApp,
      bio: extracted.bio || extracted.rawText,
      prompts: extracted.prompts,
      rawOcrText: extracted.rawText,
      lowConfidenceFields,
    }),
  );
});

function normalizeForCompare(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean).join("\n");
  return String(v).trim();
}

function diffField(
  raw: OcrCorrectionEntry["raw"],
  corrected: OcrCorrectionEntry["corrected"],
): OcrCorrectionEntry | null {
  if (normalizeForCompare(raw) === normalizeForCompare(corrected)) return null;
  return { raw, corrected };
}

router.post("/audits/from-screenshot", async (req, res): Promise<void> => {
  const parsed = AuditFromScreenshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const correctedBio = parsed.data.bio?.trim();
  const hasCorrectedFields = !!correctedBio;

  let firstName: string;
  let age: number;
  let sourceApp: string;
  let bioText: string;
  let prompts: string[];
  let rawText: string;
  let ocrCorrections: OcrCorrectionsRecord | null = null;
  let storedRawOcrText: string | null = null;

  if (hasCorrectedFields) {
    firstName = parsed.data.firstName?.trim() || "Match";
    age = parsed.data.age ?? 30;
    sourceApp = parsed.data.sourceApp?.trim() || "Hinge";
    bioText = correctedBio!;
    prompts = (parsed.data.prompts ?? [])
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    rawText = bioText + (prompts.length ? "\n" + prompts.join("\n") : "");

    const clientRawOcr = parsed.data.rawOcrText?.trim();
    if (clientRawOcr) storedRawOcrText = clientRawOcr;

    const rawExtracted = parsed.data.rawExtracted ?? null;
    if (rawExtracted) {
      const corrections: OcrCorrectionsRecord = {};
      const fn = diffField(rawExtracted.firstName ?? null, firstName);
      if (fn) corrections.firstName = fn;
      const ag = diffField(rawExtracted.age ?? null, age);
      if (ag) corrections.age = ag;
      const sa = diffField(rawExtracted.sourceApp ?? null, sourceApp);
      if (sa) corrections.sourceApp = sa;
      const bi = diffField(rawExtracted.bio ?? null, bioText);
      if (bi) corrections.bio = bi;
      const pr = diffField(rawExtracted.prompts ?? [], prompts);
      if (pr) corrections.prompts = pr;
      if (Object.keys(corrections).length > 0) {
        ocrCorrections = corrections;
      }
    }
  } else {
    if (!parsed.data.imageBase64) {
      res.status(400).json({ error: "Provide either imageBase64 or bio." });
      return;
    }

    let extracted: Awaited<ReturnType<typeof extractProfileFromScreenshot>>;
    try {
      extracted = await extractProfileFromScreenshot(parsed.data.imageBase64);
    } catch (err) {
      req.log.error({ err }, "OCR failed");
      res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
      return;
    }

    if (!extracted.bio && extracted.prompts.length === 0) {
      res.status(400).json({ error: "No readable profile text found in the screenshot." });
      return;
    }

    firstName = parsed.data.firstName?.trim() || extracted.firstName || "Match";
    age = parsed.data.age ?? extracted.age ?? 30;
    sourceApp = parsed.data.sourceApp?.trim() || extracted.sourceApp || "Hinge";
    bioText = extracted.bio || extracted.rawText;
    prompts = extracted.prompts;
    rawText = extracted.rawText;
    storedRawOcrText = extracted.rawText;
  }

  const datingGoal = parsed.data.datingGoal?.trim() || "find a relationship";
  const promptsText = prompts.length ? prompts.join("\n") : null;

  const anonymousClaimToken = req.user?.id
    ? null
    : getOrCreateAnonClaimToken(req, res);

  const [audit] = await db
    .insert(auditsTable)
    .values({
      firstName,
      age,
      gender: "unspecified",
      orientation: "unspecified",
      datingGoal,
      currentApps: [sourceApp],
      bio: bioText,
      prompts: promptsText,
      sourceApp,
      status: "generating",
      source: "screenshot",
      userId: req.user?.id ?? null,
      anonymousClaimToken,
      rawOcrText: storedRawOcrText,
      ocrCorrections,
    })
    .returning();

  const baseReport = generateAuditReport({
    firstName,
    bio: bioText,
    prompts: promptsText,
    datingGoal,
    currentApps: [sourceApp],
    sourceApp,
  });
  const report = await enhanceBioRewriteWithAi(
    baseReport,
    {
      firstName,
      bio: bioText,
      prompts: promptsText,
      datingGoal,
      currentApps: [sourceApp],
      sourceApp,
    },
    req.user?.id ?? null,
    req.log,
  );

  // Real photo critique via Claude vision, opt-in only, signed-in users only.
  // The image is analyzed in memory and never persisted. When the user has not
  // opted into the deep AI lane (or the call fails / hits the daily cap),
  // photoAnalysis stays absent and the deterministic photoGuidance checklist
  // remains the always-on fallback. Anonymous callers never reach the model.
  if (parsed.data.imageBase64 && req.user?.id) {
    try {
      const vision = await analyzeProfilePhotos({
        imageBase64: parsed.data.imageBase64,
        imageMediaType: parsed.data.imageMediaType,
        userId: req.user.id,
        sourceApp,
        datingGoal,
      });
      if (vision.analysis) {
        report.photoAnalysis = vision.analysis;
      }
    } catch (err) {
      req.log.warn({ err }, "photo vision analysis failed; keeping checklist fallback");
    }
  }

  const fullReport = { auditId: audit.id, ...report };
  const firstGeneratedAt = new Date();
  await db
    .update(auditsTable)
    .set({
      status: "complete",
      readinessScore: report.readinessScore,
      report: fullReport,
      reportGeneratedAt: firstGeneratedAt,
    })
    .where(eq(auditsTable.id, audit.id));

  // First version of the report for this new audit.
  await db.insert(auditReportVersionsTable).values({
    auditId: audit.id,
    readinessScore: report.readinessScore,
    report: fullReport,
    changeSummary: null,
    engineVersion: report.engineVersion ?? null,
    generatedAt: firstGeneratedAt,
  });

  res.json(
    AuditFromScreenshotResponse.parse({
      auditId: audit.id,
      extractedBio: bioText,
      extractedPrompts: prompts,
      rawOcrText: rawText,
      report: fullReport,
    }),
  );
});

export default router;
