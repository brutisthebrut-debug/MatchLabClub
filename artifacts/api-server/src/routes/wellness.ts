import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, wellnessAnswersTable, wellnessTagsTable } from "@workspace/db";
import {
  CreateWellnessAnswerBody,
  UpdateWellnessAnswerBody,
  CreateWellnessTagBody,
  UpdateWellnessTagBody,
} from "@workspace/api-zod";

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
  const { questionId, dimension, category, questionText, answer, consentLevel } = parsed.data;

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
      .set({ answer, consentLevel: consentLevel ?? "coaching", updatedAt: new Date() })
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
        consentLevel: consentLevel ?? "coaching",
      })
      .returning();
    row = inserted!;
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
  if (parsed.data.answer       !== undefined) patch.answer       = parsed.data.answer;
  if (parsed.data.consentLevel !== undefined) patch.consentLevel = parsed.data.consentLevel;

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

export default router;
