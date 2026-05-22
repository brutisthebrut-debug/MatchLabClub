import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
  ListJournalEntriesQueryParams,
} from "@workspace/api-zod";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";

const router: IRouter = Router();

function ownerScope(req: Request): SQL {
  if (req.user?.id) return eq(journalEntriesTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(journalEntriesTable.userId),
      eq(journalEntriesTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

function serialize(row: typeof journalEntriesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mood: row.mood,
    tag: row.tag,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : row.deletedAt ?? null,
  };
}

router.get("/journal", async (req, res): Promise<void> => {
  const params = ListJournalEntriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const view = params.data.view ?? "active";
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";

  const scope = ownerScope(req);
  const filters: SQL[] = [scope];
  if (view === "active") filters.push(isNull(journalEntriesTable.deletedAt) as SQL);
  else if (view === "trash") filters.push(isNotNull(journalEntriesTable.deletedAt) as SQL);
  if (q.length > 0) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    filters.push(
      or(
        sql`${journalEntriesTable.title} ILIKE ${like}`,
        sql`${journalEntriesTable.body} ILIKE ${like}`,
      ) as SQL,
    );
  }

  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(and(...filters))
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(500);

  res.json({ entries: rows.map(serialize) });
});

router.post("/journal", async (req, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);
  const [inserted] = await db
    .insert(journalEntriesTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      title: parsed.data.title ?? null,
      body: parsed.data.body,
      mood: parsed.data.mood ?? null,
      tag: parsed.data.tag ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted!));
});

router.patch("/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const restore = Boolean((req.body as { restore?: unknown })?.restore);

  const [existing] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), ownerScope(req)) as SQL);
  if (!existing) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  const patch: Partial<typeof journalEntriesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.title !== undefined) patch.title = parsed.data.title ?? null;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  if (parsed.data.mood !== undefined) patch.mood = parsed.data.mood ?? null;
  if (parsed.data.tag !== undefined) patch.tag = parsed.data.tag ?? null;
  if (restore) patch.deletedAt = null;

  const [updated] = await db
    .update(journalEntriesTable)
    .set(patch)
    .where(eq(journalEntriesTable.id, id))
    .returning();
  res.json(serialize(updated!));
});

router.delete("/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select({ id: journalEntriesTable.id })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.id, id),
        ownerScope(req),
        isNull(journalEntriesTable.deletedAt),
      ) as SQL,
    );
  if (!existing) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }
  await db
    .update(journalEntriesTable)
    .set({ deletedAt: new Date() })
    .where(eq(journalEntriesTable.id, id));
  res.json({ success: true, deletedId: id });
});

export default router;
