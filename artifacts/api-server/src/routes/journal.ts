import { Router, type IRouter, type Request } from "express";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
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

type Row = typeof journalEntriesTable.$inferSelect;

function serialize(row: Row) {
  return {
    id: row.id,
    prompt: row.prompt,
    body: row.body,
    tags: row.tags ?? [],
    mood: row.mood,
    linkedAuditId: row.linkedAuditId,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
    deletedAt:
      row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : (row.deletedAt ?? null),
  };
}

function parseIdParam(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(v ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.get("/journal", async (req, res): Promise<void> => {
  const params = ListJournalEntriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const view = params.data.view ?? "active";
  const limit = params.data.limit ?? 50;
  const offset = params.data.offset ?? 0;
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const tag = typeof req.query["tag"] === "string" ? req.query["tag"].trim() : "";
  const dateFrom = params.data.dateFrom ? new Date(params.data.dateFrom) : null;
  const dateTo = params.data.dateTo ? new Date(params.data.dateTo) : null;

  const filters: SQL[] = [ownerScope(req)];
  if (view === "active") filters.push(isNull(journalEntriesTable.deletedAt) as SQL);
  else if (view === "trash") filters.push(isNotNull(journalEntriesTable.deletedAt) as SQL);
  if (q.length > 0) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    filters.push(
      or(
        sql`${journalEntriesTable.prompt} ILIKE ${like}`,
        sql`${journalEntriesTable.body} ILIKE ${like}`,
      ) as SQL,
    );
  }
  if (tag.length > 0) {
    filters.push(sql`${tag} = ANY(${journalEntriesTable.tags})`);
  }
  if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
    filters.push(gte(journalEntriesTable.createdAt, dateFrom) as SQL);
  }
  if (dateTo && !Number.isNaN(dateTo.getTime())) {
    filters.push(lte(journalEntriesTable.createdAt, dateTo) as SQL);
  }

  const whereClause = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(journalEntriesTable)
      .where(whereClause)
      .orderBy(desc(journalEntriesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(journalEntriesTable)
      .where(whereClause),
  ]);

  res.json({ entries: rows.map(serialize), total: totalRow[0]?.n ?? 0 });
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
      prompt: parsed.data.prompt ?? null,
      body: parsed.data.body,
      tags: parsed.data.tags ?? [],
      mood: parsed.data.mood ?? null,
      linkedAuditId: parsed.data.linkedAuditId ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted!));
});

router.patch("/journal/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
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
  if (parsed.data.prompt !== undefined) patch.prompt = parsed.data.prompt ?? null;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
  if (parsed.data.mood !== undefined) patch.mood = parsed.data.mood ?? null;
  if (parsed.data.linkedAuditId !== undefined)
    patch.linkedAuditId = parsed.data.linkedAuditId ?? null;
  if (restore) patch.deletedAt = null;

  const [updated] = await db
    .update(journalEntriesTable)
    .set(patch)
    .where(eq(journalEntriesTable.id, id))
    .returning();
  res.json(serialize(updated!));
});

router.delete("/journal/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
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
  res.json({ success: true as const, deletedId: id });
});

router.post("/journal/:id/restore", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), ownerScope(req)) as SQL);
  if (!existing) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }
  const [restored] = await db
    .update(journalEntriesTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(journalEntriesTable.id, id))
    .returning();
  res.json(serialize(restored!));
});

export default router;
