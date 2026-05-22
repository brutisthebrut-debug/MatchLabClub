import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, postDateNotesTable } from "@workspace/db";
import {
  CreatePostDateNoteBody,
  UpdatePostDateNoteBody,
  ListPostDateNotesQueryParams,
} from "@workspace/api-zod";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";

const router: IRouter = Router();

function ownerScope(req: Request): SQL {
  if (req.user?.id) return eq(postDateNotesTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(postDateNotesTable.userId),
      eq(postDateNotesTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

function serialize(row: typeof postDateNotesTable.$inferSelect) {
  return {
    id: row.id,
    matchName: row.matchName,
    whatHappened: row.whatHappened,
    feltGood: row.feltGood ?? [],
    feltOff: row.feltOff ?? [],
    outcome: row.outcome,
    patternRead: row.patternRead,
    coachInsight: row.coachInsight,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : row.deletedAt ?? null,
  };
}

router.get("/post-date-notes", async (req, res): Promise<void> => {
  const params = ListPostDateNotesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const view = params.data.view ?? "active";
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";

  const scope = ownerScope(req);
  const filters: SQL[] = [scope];
  if (view === "active") filters.push(isNull(postDateNotesTable.deletedAt) as SQL);
  else if (view === "trash") filters.push(isNotNull(postDateNotesTable.deletedAt) as SQL);
  if (q.length > 0) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    filters.push(
      or(
        sql`${postDateNotesTable.matchName} ILIKE ${like}`,
        sql`${postDateNotesTable.whatHappened} ILIKE ${like}`,
        sql`${postDateNotesTable.patternRead} ILIKE ${like}`,
      ) as SQL,
    );
  }

  const rows = await db
    .select()
    .from(postDateNotesTable)
    .where(and(...filters))
    .orderBy(desc(postDateNotesTable.createdAt))
    .limit(500);

  res.json({ notes: rows.map(serialize) });
});

router.post("/post-date-notes", async (req, res): Promise<void> => {
  const parsed = CreatePostDateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);
  const [inserted] = await db
    .insert(postDateNotesTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      matchName: parsed.data.matchName ?? null,
      whatHappened: parsed.data.whatHappened,
      feltGood: parsed.data.feltGood ?? [],
      feltOff: parsed.data.feltOff ?? [],
      outcome: parsed.data.outcome ?? null,
      patternRead: parsed.data.patternRead ?? null,
      coachInsight: parsed.data.coachInsight ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted!));
});

router.patch("/post-date-notes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdatePostDateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const restore = Boolean((req.body as { restore?: unknown })?.restore);

  const [existing] = await db
    .select()
    .from(postDateNotesTable)
    .where(and(eq(postDateNotesTable.id, id), ownerScope(req)) as SQL);
  if (!existing) {
    res.status(404).json({ error: "Post-date note not found" });
    return;
  }

  const patch: Partial<typeof postDateNotesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.matchName !== undefined) patch.matchName = parsed.data.matchName ?? null;
  if (parsed.data.whatHappened !== undefined) patch.whatHappened = parsed.data.whatHappened;
  if (parsed.data.feltGood !== undefined) patch.feltGood = parsed.data.feltGood;
  if (parsed.data.feltOff !== undefined) patch.feltOff = parsed.data.feltOff;
  if (parsed.data.outcome !== undefined) patch.outcome = parsed.data.outcome ?? null;
  if (parsed.data.patternRead !== undefined) patch.patternRead = parsed.data.patternRead ?? null;
  if (parsed.data.coachInsight !== undefined) patch.coachInsight = parsed.data.coachInsight ?? null;
  if (restore) patch.deletedAt = null;

  const [updated] = await db
    .update(postDateNotesTable)
    .set(patch)
    .where(eq(postDateNotesTable.id, id))
    .returning();
  res.json(serialize(updated!));
});

router.delete("/post-date-notes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select({ id: postDateNotesTable.id })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.id, id),
        ownerScope(req),
        isNull(postDateNotesTable.deletedAt),
      ) as SQL,
    );
  if (!existing) {
    res.status(404).json({ error: "Post-date note not found" });
    return;
  }
  await db
    .update(postDateNotesTable)
    .set({ deletedAt: new Date() })
    .where(eq(postDateNotesTable.id, id));
  res.json({ success: true, deletedId: id });
});

export default router;
