import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  behavioralGrowthEventsTable,
  datingWinsTable,
  db,
  insertJourneyFollowUpSchema,
  journalEntriesTable,
  journeyExperimentsTable,
  journeyFollowUpsTable,
  postDateNotesTable,
  type JourneyFollowUp,
  type JourneyFollowUpSourceType,
} from "@workspace/db";

const router: IRouter = Router();

function positiveId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : value instanceof Date ? value.toISOString() : String(value);
}

function serialize(row: JourneyFollowUp) {
  return {
    id: row.id,
    source: { type: row.sourceType, id: row.sourceId, label: row.sourceLabel },
    question: row.question,
    status: row.status,
    answer: row.answer,
    answeredAt: iso(row.answeredAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function ownedSourceLabel(userId: string, sourceType: JourneyFollowUpSourceType, sourceId: number): Promise<string | null> {
  if (sourceType === "journal_entry") {
    const [row] = await db.select().from(journalEntriesTable).where(and(eq(journalEntriesTable.id, sourceId), eq(journalEntriesTable.userId, userId), isNull(journalEntriesTable.deletedAt))).limit(1);
    return row ? row.prompt?.trim() || "Reflection" : null;
  }
  if (sourceType === "post_date_note") {
    const [row] = await db.select().from(postDateNotesTable).where(and(eq(postDateNotesTable.id, sourceId), eq(postDateNotesTable.userId, userId), isNull(postDateNotesTable.deletedAt))).limit(1);
    return row ? row.personLabel?.trim() ? `Date with ${row.personLabel}` : "Date debrief" : null;
  }
  if (sourceType === "dating_win") {
    const [row] = await db.select().from(datingWinsTable).where(and(eq(datingWinsTable.id, sourceId), eq(datingWinsTable.userId, userId), isNull(datingWinsTable.deletedAt))).limit(1);
    return row ? "A win worth keeping" : null;
  }
  const [row] = await db.select().from(journeyExperimentsTable).where(and(eq(journeyExperimentsTable.id, sourceId), eq(journeyExperimentsTable.userId, userId), isNull(journeyExperimentsTable.deletedAt))).limit(1);
  return row ? row.title : null;
}

router.get("/me/journey/follow-ups", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const view = typeof req.query.view === "string" ? req.query.view : "active";
  if (view !== "active" && view !== "trash") {
    res.status(400).json({ error: "Invalid follow-up view" });
    return;
  }
  const rows = await db.select().from(journeyFollowUpsTable).where(and(
    eq(journeyFollowUpsTable.userId, req.user.id),
    view === "trash" ? isNotNull(journeyFollowUpsTable.deletedAt) : isNull(journeyFollowUpsTable.deletedAt),
  )).orderBy(desc(journeyFollowUpsTable.createdAt)).limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/journey/follow-ups", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = insertJourneyFollowUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sourceLabel = await ownedSourceLabel(req.user.id, parsed.data.sourceType, parsed.data.sourceId);
  if (!sourceLabel) {
    res.status(400).json({ error: "Choose an active Journey moment you own." });
    return;
  }
  const now = new Date();
  const answered = parsed.data.status === "answered";
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(journeyFollowUpsTable).values({
      userId: req.user!.id,
      ...parsed.data,
      sourceLabel,
      answeredAt: answered ? now : null,
      readinessRecordedAt: answered ? now : null,
    }).returning();
    if (answered) {
      await tx.insert(behavioralGrowthEventsTable).values({ userId: req.user!.id, type: "follow_up_logged" });
    }
    return created;
  });
  res.status(201).json(serialize(row));
});

router.patch("/me/journey/follow-ups/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  const parsed = insertJourneyFollowUpSchema.safeParse(req.body);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(journeyFollowUpsTable).where(and(eq(journeyFollowUpsTable.id, id), eq(journeyFollowUpsTable.userId, req.user.id), isNull(journeyFollowUpsTable.deletedAt))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const sourceLabel = await ownedSourceLabel(req.user.id, parsed.data.sourceType, parsed.data.sourceId);
  if (!sourceLabel) {
    res.status(400).json({ error: "Choose an active Journey moment you own." });
    return;
  }
  const now = new Date();
  const firstAnswer = !existing.readinessRecordedAt && parsed.data.status === "answered";
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(journeyFollowUpsTable).set({
      ...parsed.data,
      sourceLabel,
      answeredAt: parsed.data.status === "answered" ? existing.answeredAt ?? now : null,
      updatedAt: now,
      ...(firstAnswer ? { readinessRecordedAt: now } : {}),
    }).where(and(eq(journeyFollowUpsTable.id, id), eq(journeyFollowUpsTable.userId, req.user!.id), isNull(journeyFollowUpsTable.deletedAt))).returning();
    if (firstAnswer) {
      await tx.insert(behavioralGrowthEventsTable).values({ userId: req.user!.id, type: "follow_up_logged" });
    }
    return updated;
  });
  res.json(serialize(row));
});

router.delete("/me/journey/follow-ups/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.update(journeyFollowUpsTable).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(journeyFollowUpsTable.id, id), eq(journeyFollowUpsTable.userId, req.user.id), isNull(journeyFollowUpsTable.deletedAt))).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

router.post("/me/journey/follow-ups/:id/restore", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.update(journeyFollowUpsTable).set({ deletedAt: null, updatedAt: new Date() }).where(and(eq(journeyFollowUpsTable.id, id), eq(journeyFollowUpsTable.userId, req.user.id), isNotNull(journeyFollowUpsTable.deletedAt))).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

export default router;
