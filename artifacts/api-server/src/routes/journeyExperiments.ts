import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  behavioralGrowthEventsTable,
  db,
  insertJourneyExperimentSchema,
  journeyExperimentsTable,
  type JourneyExperiment,
  type JourneyExperimentStatus,
} from "@workspace/db";

const router: IRouter = Router();

function positiveId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : value instanceof Date ? value.toISOString() : String(value);
}

function serialize(row: JourneyExperiment) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    result: row.result,
    triedAt: iso(row.triedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function hasBeenTried(status: JourneyExperimentStatus): boolean {
  return status !== "planned";
}

router.get("/me/journey/experiments", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const view = typeof req.query.view === "string" ? req.query.view : "active";
  if (view !== "active" && view !== "trash") {
    res.status(400).json({ error: "Invalid experiment view" });
    return;
  }
  const rows = await db.select().from(journeyExperimentsTable).where(and(
    eq(journeyExperimentsTable.userId, req.user.id),
    view === "trash" ? isNotNull(journeyExperimentsTable.deletedAt) : isNull(journeyExperimentsTable.deletedAt),
  )).orderBy(desc(journeyExperimentsTable.createdAt)).limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/journey/experiments", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = insertJourneyExperimentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const now = new Date();
  const tried = hasBeenTried(parsed.data.status);
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(journeyExperimentsTable).values({
      userId: req.user!.id,
      ...parsed.data,
      triedAt: tried ? now : null,
      readinessRecordedAt: tried ? now : null,
    }).returning();
    if (tried) {
      await tx.insert(behavioralGrowthEventsTable).values({ userId: req.user!.id, type: "experiment_tried" });
    }
    return created;
  });
  res.status(201).json(serialize(row));
});

router.patch("/me/journey/experiments/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  const parsed = insertJourneyExperimentSchema.safeParse(req.body);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(journeyExperimentsTable).where(and(
    eq(journeyExperimentsTable.id, id),
    eq(journeyExperimentsTable.userId, req.user.id),
    isNull(journeyExperimentsTable.deletedAt),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const now = new Date();
  const firstTry = !existing.readinessRecordedAt && hasBeenTried(parsed.data.status);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(journeyExperimentsTable).set({
      ...parsed.data,
      updatedAt: now,
      ...(firstTry ? { triedAt: now, readinessRecordedAt: now } : {}),
    }).where(and(
      eq(journeyExperimentsTable.id, id),
      eq(journeyExperimentsTable.userId, req.user!.id),
      isNull(journeyExperimentsTable.deletedAt),
    )).returning();
    if (firstTry) {
      await tx.insert(behavioralGrowthEventsTable).values({ userId: req.user!.id, type: "experiment_tried" });
    }
    return updated;
  });
  res.json(serialize(row));
});

router.delete("/me/journey/experiments/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.update(journeyExperimentsTable).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(
    eq(journeyExperimentsTable.id, id),
    eq(journeyExperimentsTable.userId, req.user.id),
    isNull(journeyExperimentsTable.deletedAt),
  )).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

router.post("/me/journey/experiments/:id/restore", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = positiveId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.update(journeyExperimentsTable).set({ deletedAt: null, updatedAt: new Date() }).where(and(
    eq(journeyExperimentsTable.id, id),
    eq(journeyExperimentsTable.userId, req.user.id),
    isNotNull(journeyExperimentsTable.deletedAt),
  )).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

export default router;
