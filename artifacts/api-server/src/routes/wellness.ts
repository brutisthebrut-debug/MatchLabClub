import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  db,
  wellnessAnswersTable,
  wellnessInferencesTable,
  wellnessTagsTable,
  journalEntriesTable,
  auditsTable,
  messageCoachingSessionsTable,
} from "@workspace/db";
import {
  CreateWellnessAnswerBody,
  UpdateWellnessAnswerBody,
  CreateWellnessTagBody,
  UpdateWellnessTagBody,
  ConfirmWellnessInferenceBody,
} from "@workspace/api-zod";
import { recordJourneyEvent } from "../lib/journeyEvents";
import { computeActivityStreak } from "../lib/streak";
import { generate } from "../lib/aiService";
import {
  inferWellnessSignals,
  type WellnessInferenceCandidate,
} from "../lib/aiEngine";
import {
  WELLNESS_QUESTION_BANK,
  WELLNESS_DIMENSIONS,
  WELLNESS_BANK_TOTAL,
  pickDailyQuestion,
} from "../lib/wellnessQuestionBank";

const router: IRouter = Router();

// ── Auth scope helpers ──────────────────────────────────────────────────────

function answerScope(req: Request): SQL {
  if (req.user?.id) return eq(wellnessAnswersTable.userId, req.user.id);
  return sql`false`;
}

function tagScope(req: Request): SQL {
  if (req.user?.id) return eq(wellnessTagsTable.userId, req.user.id);
  return sql`false`;
}

// ── Serialisers ─────────────────────────────────────────────────────────────

type AnswerRow = typeof wellnessAnswersTable.$inferSelect;
type TagRow    = typeof wellnessTagsTable.$inferSelect;

function serializeAnswer(row: AnswerRow) {
  return {
    id:           row.id,
    questionId:   row.questionId,
    dimension:    row.dimension,
    category:     row.category ?? null,
    questionText: row.questionText,
    answer:       row.answer,
    consentLevel: row.consentLevel,
    deletedAt:    row.deletedAt instanceof Date ? row.deletedAt.toISOString() : (row.deletedAt ?? null),
    createdAt:    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt:    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function serializeTag(row: TagRow) {
  return {
    id:                  row.id,
    tag:                 row.tag,
    label:               row.label,
    category:            row.category,
    approvedForMatching: row.approvedForMatching,
    hidden:              row.hidden,
    createdAt:           row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt:           row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function parseId(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── /wellness/answers ────────────────────────────────────────────────────────

router.get("/wellness/answers", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.json({ answers: [], total: 0 });
    return;
  }
  const dim = typeof req.query["dimension"] === "string" ? req.query["dimension"] : null;
  const filters: SQL[] = [answerScope(req), isNull(wellnessAnswersTable.deletedAt) as SQL];
  if (dim) filters.push(eq(wellnessAnswersTable.dimension, dim) as SQL);

  const rows = await db
    .select()
    .from(wellnessAnswersTable)
    .where(and(...filters))
    .orderBy(desc(wellnessAnswersTable.createdAt));

  res.json({ answers: rows.map(serializeAnswer), total: rows.length });
});

router.post("/wellness/answers", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = CreateWellnessAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { questionId, dimension, category, questionText, answer } = parsed.data;
  // Capture policy is fixed: every wellness answer is stored at "all" for all uses.
  // We ignore any caller-supplied consentLevel so the policy is enforced server-side,
  // not just in the UI. Users still control deletion/export from the Data Vault.
  const consentLevel = "all" as const;

  // Upsert: one answer per questionId per user (overwrite if they answer again)
  const existing = await db
    .select({ id: wellnessAnswersTable.id })
    .from(wellnessAnswersTable)
    .where(
      and(
        eq(wellnessAnswersTable.userId, req.user.id),
        eq(wellnessAnswersTable.questionId, questionId),
        isNull(wellnessAnswersTable.deletedAt),
      ) as SQL,
    )
    .limit(1);

  let row: AnswerRow;
  if (existing.length > 0) {
    const [updated] = await db
      .update(wellnessAnswersTable)
      .set({ answer, consentLevel, updatedAt: new Date() })
      .where(eq(wellnessAnswersTable.id, existing[0]!.id))
      .returning();
    row = updated!;
    res.status(200).json(serializeAnswer(row));
  } else {
    const [inserted] = await db
      .insert(wellnessAnswersTable)
      .values({
        userId:       req.user.id,
        questionId,
        dimension,
        category:     category ?? null,
        questionText,
        answer,
        consentLevel,
      })
      .returning();
    row = inserted!;
    void recordJourneyEvent({
      eventType: "signal_fed",
      userId: req.user.id,
      props: { source: "wellness" },
    });
    res.status(201).json(serializeAnswer(row));
  }
});

router.patch("/wellness/answers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateWellnessAnswerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db
    .select()
    .from(wellnessAnswersTable)
    .where(and(eq(wellnessAnswersTable.id, id), answerScope(req)) as SQL);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const patch: Partial<typeof wellnessAnswersTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.answer !== undefined) patch.answer = parsed.data.answer;
  // consentLevel is fixed at "all" by capture policy; we never let a caller change it here.

  const [updated] = await db
    .update(wellnessAnswersTable)
    .set(patch)
    .where(eq(wellnessAnswersTable.id, id))
    .returning();
  res.json(serializeAnswer(updated!));
});

router.delete("/wellness/answers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ id: wellnessAnswersTable.id })
    .from(wellnessAnswersTable)
    .where(and(eq(wellnessAnswersTable.id, id), answerScope(req), isNull(wellnessAnswersTable.deletedAt)) as SQL);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(wellnessAnswersTable).set({ deletedAt: new Date() }).where(eq(wellnessAnswersTable.id, id));
  res.json({ success: true as const, deletedId: id });
});

// ── /wellness/tags ───────────────────────────────────────────────────────────

router.get("/wellness/tags", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.json({ tags: [] });
    return;
  }
  const rows = await db
    .select()
    .from(wellnessTagsTable)
    .where(tagScope(req))
    .orderBy(wellnessTagsTable.category, wellnessTagsTable.label);

  res.json({ tags: rows.map(serializeTag) });
});

router.post("/wellness/tags", async (req, res): Promise<void> => {
  if (!req.user?.id) { res.status(401).json({ error: "Authentication required" }); return; }

  const parsed = CreateWellnessTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [inserted] = await db
    .insert(wellnessTagsTable)
    .values({ userId: req.user.id, ...parsed.data })
    .returning();
  res.status(201).json(serializeTag(inserted!));
});

router.patch("/wellness/tags/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateWellnessTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(wellnessTagsTable)
    .where(and(eq(wellnessTagsTable.id, id), tagScope(req)) as SQL);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(wellnessTagsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(wellnessTagsTable.id, id))
    .returning();
  res.json(serializeTag(updated!));
});

router.delete("/wellness/tags/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select({ id: wellnessTagsTable.id }).from(wellnessTagsTable)
    .where(and(eq(wellnessTagsTable.id, id), tagScope(req)) as SQL);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(wellnessTagsTable).where(eq(wellnessTagsTable.id, id));
  res.json({ success: true as const, deletedId: id });
});

// ── /wellness/profile ────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  emotional:    "Emotional",
  physical:     "Physical",
  social:       "Social",
  intellectual: "Intellectual",
  spiritual:    "Spiritual / Meaning",
  occupational: "Occupational / Purpose",
  financial:    "Financial",
  environmental:"Environmental / Home",
  communication:"Communication",
  conflict:     "Conflict & Repair",
  boundaries:   "Boundaries",
  affection:    "Affection & Touch",
  intimacy:     "Intimacy",
  lifestyle:    "Lifestyle Rhythm",
  future_vision:"Future Vision",
  values:       "Values & Character",
  family:       "Family & Community",
  culture:      "Culture & Background",
};

const DIMENSION_QUESTION_COUNTS: Record<string, number> = {
  emotional: 12, physical: 10, social: 8, intellectual: 6,
  spiritual: 8, occupational: 7, financial: 6, environmental: 5,
  communication: 12, conflict: 10, boundaries: 14, affection: 8,
  intimacy: 16, lifestyle: 8, future_vision: 6, values: 10,
  family: 6, culture: 4,
};

const DIMENSION_NEXT_QUESTIONS: Record<string, string> = {
  emotional:    "When do you feel most like yourself?",
  physical:     "What physical habits make you feel your best?",
  social:       "What role does your social circle play in your dating life?",
  intellectual: "What topics make you lose track of time?",
  spiritual:    "What principles guide your biggest decisions?",
  occupational: "What would you do with your time if money wasn't a factor?",
  financial:    "What does financial stability mean to you?",
  environmental:"What does your ideal living environment feel like?",
  communication:"Are you someone who processes thoughts out loud or internally?",
  conflict:     "How do you usually respond when you're upset?",
  boundaries:   "What's something you've become stronger about as you've gotten older?",
  affection:    "What kinds of touch make you feel most cared for?",
  intimacy:     "What helps you feel emotionally and physically safe with someone?",
  lifestyle:    "Are you an early riser or a night person?",
  future_vision:"What kind of life are you trying to create?",
  values:       "What do you believe strongly even if others disagree?",
  family:       "What role does family play in your life today?",
  culture:      "What traditions matter to you?",
};

// ── /wellness/daily ──────────────────────────────────────────────────────────
// Signal of the Day: one question a day, picked deterministically from the
// question bank (least-covered dimension first). Answering writes through the
// existing POST /wellness/answers upsert, so it rides the wellness lane with no
// new table or signal-registry entry. The streak is a gamification lens over the
// distinct UTC days the user has fed a wellness answer; it never touches scoring.

const EMPTY_DAILY_STREAK = {
  current: 0,
  longest: 0,
  activeToday: false,
  daysActiveLast14: 0,
};

function utcDayString(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value))
    .toISOString()
    .slice(0, 10);
}

function dailyQuestionView(q: {
  questionId: string;
  dimension: string;
  questionText: string;
}) {
  return {
    questionId: q.questionId,
    dimension: q.dimension,
    dimensionLabel: DIMENSION_LABELS[q.dimension] ?? q.dimension,
    questionText: q.questionText,
  };
}

router.get("/wellness/daily", async (req: Request, res): Promise<void> => {
  // Anonymous visitors get a real demo question and a zeroed streak so the card
  // never looks empty, matching the /wellness/profile fallback. The write path
  // (POST /wellness/answers) still requires auth.
  if (!req.user?.id) {
    const first = WELLNESS_QUESTION_BANK[0]!;
    res.json({
      question: dailyQuestionView(first),
      answeredToday: false,
      streak: EMPTY_DAILY_STREAK,
      dimensionsCovered: 0,
      dimensionsTotal: WELLNESS_DIMENSIONS.length,
      bankAnswered: 0,
      bankTotal: WELLNESS_BANK_TOTAL,
    });
    return;
  }

  const rows = await db
    .select({
      questionId: wellnessAnswersTable.questionId,
      dimension: wellnessAnswersTable.dimension,
      deletedAt: wellnessAnswersTable.deletedAt,
      createdAt: wellnessAnswersTable.createdAt,
      updatedAt: wellnessAnswersTable.updatedAt,
    })
    .from(wellnessAnswersTable)
    .where(eq(wellnessAnswersTable.userId, req.user.id));

  const live = rows.filter((r) => !r.deletedAt);
  const answeredQuestionIds = new Set(live.map((r) => r.questionId));
  const dimensionAnsweredCounts = new Map<string, number>();
  const dimensionsCovered = new Set<string>();
  for (const r of live) {
    dimensionAnsweredCounts.set(
      r.dimension,
      (dimensionAnsweredCounts.get(r.dimension) ?? 0) + 1,
    );
    dimensionsCovered.add(r.dimension);
  }

  // Streak counts any UTC day the user created or last touched a wellness answer.
  // Counting updatedAt too keeps the streak honest when an upsert refreshes a row.
  const days = rows.flatMap((r) => [
    utcDayString(r.createdAt),
    utcDayString(r.updatedAt),
  ]);
  const streak = computeActivityStreak(
    days,
    new Date().toISOString().slice(0, 10),
  );

  const picked = pickDailyQuestion({
    answeredQuestionIds,
    dimensionAnsweredCounts,
  });
  const bankAnswered = WELLNESS_QUESTION_BANK.filter((q) =>
    answeredQuestionIds.has(q.questionId),
  ).length;

  res.json({
    question: picked ? dailyQuestionView(picked) : null,
    answeredToday: streak.activeToday,
    streak,
    dimensionsCovered: dimensionsCovered.size,
    dimensionsTotal: WELLNESS_DIMENSIONS.length,
    bankAnswered,
    bankTotal: WELLNESS_BANK_TOTAL,
  });
});

router.get("/wellness/profile", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    // Return empty profile for unauthenticated (demo mode)
    const dimensions = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
      dimension:       key,
      label,
      answeredCount:   0,
      totalQuestions:  DIMENSION_QUESTION_COUNTS[key] ?? 10,
      completionPct:   0,
      strengths:       [],
      frictionPoints:  [],
      nextQuestion:    DIMENSION_NEXT_QUESTIONS[key] ?? null,
    }));
    res.json({ dimensions, tags: [], matchingReadiness: { overallPct: 0, strongDimensions: [], weakDimensions: Object.keys(DIMENSION_LABELS), readyForMatching: false } });
    return;
  }

  const [answers, tags] = await Promise.all([
    db.select().from(wellnessAnswersTable)
      .where(and(eq(wellnessAnswersTable.userId, req.user.id), isNull(wellnessAnswersTable.deletedAt)) as SQL),
    db.select().from(wellnessTagsTable)
      .where(eq(wellnessTagsTable.userId, req.user.id))
      .orderBy(wellnessTagsTable.category, wellnessTagsTable.label),
  ]);

  // Group answers by dimension
  const byDimension = new Map<string, AnswerRow[]>();
  for (const a of answers) {
    const arr = byDimension.get(a.dimension) ?? [];
    arr.push(a);
    byDimension.set(a.dimension, arr);
  }

  const dimensions = Object.entries(DIMENSION_LABELS).map(([key, label]) => {
    const dimAnswers = byDimension.get(key) ?? [];
    const total      = DIMENSION_QUESTION_COUNTS[key] ?? 10;
    const pct        = Math.min(100, Math.round((dimAnswers.length / total) * 100));
    return {
      dimension:      key,
      label,
      answeredCount:  dimAnswers.length,
      totalQuestions: total,
      completionPct:  pct,
      strengths:      [],
      frictionPoints: [],
      nextQuestion:   pct < 100 ? (DIMENSION_NEXT_QUESTIONS[key] ?? null) : null,
    };
  });

  // Matching readiness: dimensions with >40% completion = strong
  const strongDimensions = dimensions.filter(d => d.completionPct >= 40).map(d => d.dimension);
  const weakDimensions   = dimensions.filter(d => d.completionPct < 40).map(d => d.dimension);
  const overallPct       = Math.round(dimensions.reduce((s, d) => s + d.completionPct, 0) / dimensions.length);
  const readyForMatching = overallPct >= 30 && strongDimensions.length >= 5;

  res.json({
    dimensions,
    tags: tags.map(serializeTag),
    matchingReadiness: { overallPct, strongDimensions, weakDimensions, readyForMatching },
  });
});

// ── /me/wellness/inferences (passive, confirm-before-write) ──────────────────
//
// The machine reads ONLY the user's own writing (journal, audit drafts, message
// coach threads) and proposes short per-dimension reflections. Nothing here is
// ever counted as a real signal until the user confirms it, at which point it is
// written through the normal wellness-answer upsert under a synthetic
// `inferred:<dimension>:1` question id so it can never clobber a hand-written
// answer. Deterministic extraction is the always-on baseline; Claude refines it
// only behind ai_content_consent + the daily cap, and any failure falls back.

type InferenceRow = typeof wellnessInferencesTable.$inferSelect;

function serializeInference(row: InferenceRow) {
  return {
    id:                 row.id,
    dimension:          row.dimension,
    inferredQuestionId: row.inferredQuestionId,
    questionText:       row.questionText,
    suggestedAnswer:    row.suggestedAnswer,
    sourceKind:         row.sourceKind,
    rationale:          row.rationale ?? null,
    mode:               row.mode,
    status:             row.status,
    createdAt:          row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt:          row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function canonicalQuestion(dim: string): string {
  return (
    WELLNESS_QUESTION_BANK.find((q) => q.dimension === dim)?.questionText ??
    `What matters to you when it comes to ${dim.replace(/_/g, " ")}?`
  );
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s;
}

// Map a validated Claude payload into the same candidate shape the deterministic
// engine returns. Drops anything outside the known dimension set, dedupes by
// dimension, and caps the list so one run can never flood the queue.
function mapClaudeInferences(
  items: { dimension: string; suggestedAnswer: string; rationale: string }[],
): WellnessInferenceCandidate[] {
  const out: WellnessInferenceCandidate[] = [];
  const seen = new Set<string>();
  const allowed = WELLNESS_DIMENSIONS as readonly string[];
  for (const item of items) {
    const dimension = (item.dimension ?? "").trim();
    if (!allowed.includes(dimension)) continue;
    if (seen.has(dimension)) continue;
    const suggestedAnswer = (item.suggestedAnswer ?? "").trim();
    if (suggestedAnswer.length < 8) continue;
    seen.add(dimension);
    out.push({
      dimension,
      questionText: canonicalQuestion(dimension),
      suggestedAnswer: clip(suggestedAnswer, 280),
      sourceKind: "writing",
      rationale: clip((item.rationale ?? "").trim() || "Noticed in your own writing.", 200),
    });
  }
  return out.slice(0, 6);
}

const INFERENCE_SYSTEM = [
  "You are the MatchLab wellness inference engine. A user has shared their own",
  "writing (journal entries, dating-profile drafts, message-coach threads).",
  "Draw at most six short, gentle observations about their wellbeing, one per",
  "wellness dimension, using only what their words actually support. Never",
  "invent facts. Each observation must read as a first-person reflection the",
  'user could confirm as their own (e.g. "I feel most grounded after I run").',
  "",
  `Allowed dimensions: ${WELLNESS_DIMENSIONS.join(", ")}.`,
  "",
  "Return JSON only, no prose, no code fences, matching this shape exactly:",
  '{ "inferences": [ { "dimension": "<one of the allowed>",',
  '  "suggestedAnswer": "<short first-person reflection, under 40 words>",',
  '  "rationale": "<short note on what hinted at this>" } ] }',
  "",
  "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
  "'elevate', 'dive in', or 'in today's world'. Sound human and warm.",
].join("\n");

function buildInferenceUser(sources: { kind: string; text: string }[]): string {
  return sources
    .map((s) => `From the user's ${s.kind} writing:\n${s.text.slice(0, 4000)}`)
    .join("\n\n");
}

router.post("/me/wellness/inferences/generate", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const userId = req.user.id;

  // 1) Gather the user's own free text from first-party surfaces only.
  const [journalRows, auditRows, coachRows] = await Promise.all([
    db
      .select({ prompt: journalEntriesTable.prompt, body: journalEntriesTable.body })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, userId),
          isNull(journalEntriesTable.deletedAt),
        ) as SQL,
      )
      .orderBy(desc(journalEntriesTable.createdAt))
      .limit(25),
    db
      .select({ bio: auditsTable.bio, prompts: auditsTable.prompts })
      .from(auditsTable)
      .where(eq(auditsTable.userId, userId))
      .orderBy(desc(auditsTable.createdAt))
      .limit(15),
    db
      .select({
        last: messageCoachingSessionsTable.yourLastMessage,
      })
      .from(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId))
      .orderBy(desc(messageCoachingSessionsTable.createdAt))
      .limit(15),
  ]);

  const joinRows = (rows: (string | null | undefined)[][]): string =>
    rows.map((parts) => parts.filter(Boolean).join(" ")).join("\n");

  const sources = [
    { kind: "journal", text: joinRows(journalRows.map((r) => [r.prompt, r.body])) },
    { kind: "audit", text: joinRows(auditRows.map((r) => [r.bio, r.prompts])) },
    { kind: "coach", text: joinRows(coachRows.map((r) => [r.last])) },
  ].filter((s) => s.text.trim().length > 0);

  // 2) Deterministic baseline always runs.
  let candidates = inferWellnessSignals({ sources });
  let mode: "deterministic" | "anthropic" = "deterministic";

  // 3) Optional Claude refinement (consent + daily cap gated; falls back).
  if (sources.length > 0) {
    try {
      const ai = await generate(
        {
          provider: "anthropic",
          system: INFERENCE_SYSTEM,
          user: buildInferenceUser(sources),
          expectJson: true,
          requireContentConsent: true,
          userId,
          context: { toolName: "Wellness Inference" },
          maxTokens: 900,
        },
        "",
      );
      if (!ai.isFallback && ai.validated && ai.output) {
        const parsed = JSON.parse(ai.output) as {
          inferences: { dimension: string; suggestedAnswer: string; rationale: string }[];
        };
        const refined = mapClaudeInferences(parsed.inferences ?? []);
        if (refined.length > 0) {
          candidates = refined;
          mode = "anthropic";
        }
      } else if (ai.fallbackReason) {
        req.log.info(
          { fallbackReason: ai.fallbackReason },
          "wellness inference fell back to deterministic baseline",
        );
      }
    } catch (err) {
      req.log.warn(
        { err },
        "wellness inference deep-AI lane threw; using deterministic baseline",
      );
    }
  }

  // 4) Persist as pending, deduped: never re-surface a question id the user has
  //    already answered, confirmed, or dismissed, and never duplicate a pending.
  const [existingInferences, existingAnswers] = await Promise.all([
    db
      .select({ qid: wellnessInferencesTable.inferredQuestionId })
      .from(wellnessInferencesTable)
      .where(eq(wellnessInferencesTable.userId, userId)),
    db
      .select({ qid: wellnessAnswersTable.questionId })
      .from(wellnessAnswersTable)
      .where(
        and(
          eq(wellnessAnswersTable.userId, userId),
          isNull(wellnessAnswersTable.deletedAt),
        ) as SQL,
      ),
  ]);
  const taken = new Set<string>([
    ...existingInferences.map((r) => r.qid),
    ...existingAnswers.map((r) => r.qid),
  ]);

  let created = 0;
  for (const c of candidates) {
    const inferredQuestionId = `inferred:${c.dimension}:1`;
    if (taken.has(inferredQuestionId)) continue;
    taken.add(inferredQuestionId);
    await db.insert(wellnessInferencesTable).values({
      userId,
      dimension: c.dimension,
      inferredQuestionId,
      questionText: c.questionText,
      suggestedAnswer: c.suggestedAnswer,
      sourceKind: c.sourceKind,
      rationale: c.rationale,
      mode,
      status: "pending",
    });
    created += 1;
  }

  const pending = await db
    .select()
    .from(wellnessInferencesTable)
    .where(
      and(
        eq(wellnessInferencesTable.userId, userId),
        eq(wellnessInferencesTable.status, "pending"),
      ) as SQL,
    )
    .orderBy(desc(wellnessInferencesTable.createdAt));

  res.status(200).json({ created, mode, inferences: pending.map(serializeInference) });
});

router.get("/me/wellness/inferences", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const rows = await db
    .select()
    .from(wellnessInferencesTable)
    .where(
      and(
        eq(wellnessInferencesTable.userId, req.user.id),
        eq(wellnessInferencesTable.status, "pending"),
      ) as SQL,
    )
    .orderBy(desc(wellnessInferencesTable.createdAt));
  res.status(200).json({ inferences: rows.map(serializeInference) });
});

router.post("/me/wellness/inferences/:id/confirm", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = ConfirmWellnessInferenceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inference] = await db
    .select()
    .from(wellnessInferencesTable)
    .where(
      and(
        eq(wellnessInferencesTable.userId, req.user.id),
        eq(wellnessInferencesTable.id, id),
      ) as SQL,
    )
    .limit(1);
  if (!inference) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (inference.status !== "pending") {
    res.status(409).json({ error: "Already resolved" });
    return;
  }

  const answerText = (parsed.data.answer ?? inference.suggestedAnswer).trim();
  if (answerText.length === 0) {
    res.status(400).json({ error: "Answer required" });
    return;
  }

  // Write through the normal wellness-answer upsert (one row per questionId).
  const existing = await db
    .select({ id: wellnessAnswersTable.id })
    .from(wellnessAnswersTable)
    .where(
      and(
        eq(wellnessAnswersTable.userId, req.user.id),
        eq(wellnessAnswersTable.questionId, inference.inferredQuestionId),
        isNull(wellnessAnswersTable.deletedAt),
      ) as SQL,
    )
    .limit(1);

  let answerRow: AnswerRow;
  if (existing.length > 0) {
    const [updated] = await db
      .update(wellnessAnswersTable)
      .set({ answer: answerText, consentLevel: "all", updatedAt: new Date() })
      .where(eq(wellnessAnswersTable.id, existing[0]!.id))
      .returning();
    answerRow = updated!;
  } else {
    const [inserted] = await db
      .insert(wellnessAnswersTable)
      .values({
        userId:       req.user.id,
        questionId:   inference.inferredQuestionId,
        dimension:    inference.dimension,
        category:     null,
        questionText: inference.questionText,
        answer:       answerText,
        consentLevel: "all",
      })
      .returning();
    answerRow = inserted!;
    void recordJourneyEvent({
      eventType: "signal_fed",
      userId: req.user.id,
      props: { source: "wellness_inference" },
    });
  }

  const [updatedInference] = await db
    .update(wellnessInferencesTable)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(wellnessInferencesTable.id, id))
    .returning();

  res.status(200).json({
    confirmed: true,
    answer: serializeAnswer(answerRow),
    inference: serializeInference(updatedInference!),
  });
});

router.post("/me/wellness/inferences/:id/dismiss", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [inference] = await db
    .select()
    .from(wellnessInferencesTable)
    .where(
      and(
        eq(wellnessInferencesTable.userId, req.user.id),
        eq(wellnessInferencesTable.id, id),
      ) as SQL,
    )
    .limit(1);
  if (!inference) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (inference.status !== "pending") {
    res.status(409).json({ error: "Already resolved" });
    return;
  }

  const [updated] = await db
    .update(wellnessInferencesTable)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(eq(wellnessInferencesTable.id, id))
    .returning();

  res.status(200).json({ dismissed: true, inference: serializeInference(updated!) });
});

export default router;
