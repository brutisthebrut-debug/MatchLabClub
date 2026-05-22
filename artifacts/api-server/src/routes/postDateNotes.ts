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

type Row = typeof postDateNotesTable.$inferSelect;

function toIso(d: Date | string | null): string | null {
  if (d === null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function serialize(row: Row) {
  return {
    id: row.id,
    dateAt: toIso(row.dateAt),
    personLabel: row.personLabel,
    platform: row.platform,
    summary: row.summary,
    whatWentWell: row.whatWentWell ?? "",
    whatDidnt: row.whatDidnt ?? "",
    followUpPlanned: Boolean(row.followUpPlanned),
    outcome: row.outcome,
    linkedAuditId: row.linkedAuditId,
    createdAt: toIso(row.createdAt) ?? "",
    updatedAt: toIso(row.updatedAt) ?? "",
    deletedAt: toIso(row.deletedAt),
  };
}

function parseIdParam(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(v ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.get("/post-date-notes", async (req, res): Promise<void> => {
  const params = ListPostDateNotesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const view = params.data.view ?? "active";
  const limit = params.data.limit ?? 50;
  const offset = params.data.offset ?? 0;
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const outcome = typeof req.query["outcome"] === "string" ? req.query["outcome"] : "";
  const platform =
    typeof req.query["platform"] === "string" ? req.query["platform"].trim() : "";
  const dateFrom = params.data.dateFrom ? new Date(params.data.dateFrom) : null;
  const dateTo = params.data.dateTo ? new Date(params.data.dateTo) : null;

  const filters: SQL[] = [ownerScope(req)];
  if (view === "active") filters.push(isNull(postDateNotesTable.deletedAt) as SQL);
  else if (view === "trash") filters.push(isNotNull(postDateNotesTable.deletedAt) as SQL);
  if (q.length > 0) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    filters.push(
      or(
        sql`${postDateNotesTable.summary} ILIKE ${like}`,
        sql`${postDateNotesTable.whatWentWell} ILIKE ${like}`,
        sql`${postDateNotesTable.whatDidnt} ILIKE ${like}`,
        sql`${postDateNotesTable.personLabel} ILIKE ${like}`,
      ) as SQL,
    );
  }
  if (outcome.length > 0) {
    filters.push(eq(postDateNotesTable.outcome, outcome) as SQL);
  }
  if (platform.length > 0) {
    filters.push(eq(postDateNotesTable.platform, platform) as SQL);
  }
  // Range applies to dateAt when present, otherwise createdAt.
  if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
    filters.push(
      sql`COALESCE(${postDateNotesTable.dateAt}, ${postDateNotesTable.createdAt}) >= ${dateFrom}`,
    );
  }
  if (dateTo && !Number.isNaN(dateTo.getTime())) {
    filters.push(
      sql`COALESCE(${postDateNotesTable.dateAt}, ${postDateNotesTable.createdAt}) <= ${dateTo}`,
    );
  }

  const whereClause = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(postDateNotesTable)
      .where(whereClause)
      .orderBy(
        sql`COALESCE(${postDateNotesTable.dateAt}, ${postDateNotesTable.createdAt}) DESC`,
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postDateNotesTable)
      .where(whereClause),
  ]);

  res.json({ notes: rows.map(serialize), total: totalRow[0]?.n ?? 0 });
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
      dateAt: parsed.data.dateAt ? new Date(parsed.data.dateAt) : null,
      personLabel: parsed.data.personLabel ?? null,
      platform: parsed.data.platform ?? null,
      summary: parsed.data.summary,
      whatWentWell: parsed.data.whatWentWell ?? "",
      whatDidnt: parsed.data.whatDidnt ?? "",
      followUpPlanned: parsed.data.followUpPlanned ?? false,
      outcome: parsed.data.outcome ?? null,
      linkedAuditId: parsed.data.linkedAuditId ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted!));
});

router.patch("/post-date-notes/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
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
  if (parsed.data.dateAt !== undefined)
    patch.dateAt = parsed.data.dateAt ? new Date(parsed.data.dateAt) : null;
  if (parsed.data.personLabel !== undefined)
    patch.personLabel = parsed.data.personLabel ?? null;
  if (parsed.data.platform !== undefined)
    patch.platform = parsed.data.platform ?? null;
  if (parsed.data.summary !== undefined) patch.summary = parsed.data.summary;
  if (parsed.data.whatWentWell !== undefined)
    patch.whatWentWell = parsed.data.whatWentWell;
  if (parsed.data.whatDidnt !== undefined) patch.whatDidnt = parsed.data.whatDidnt;
  if (parsed.data.followUpPlanned !== undefined)
    patch.followUpPlanned = parsed.data.followUpPlanned;
  if (parsed.data.outcome !== undefined) patch.outcome = parsed.data.outcome ?? null;
  if (parsed.data.linkedAuditId !== undefined)
    patch.linkedAuditId = parsed.data.linkedAuditId ?? null;
  if (restore) patch.deletedAt = null;

  const [updated] = await db
    .update(postDateNotesTable)
    .set(patch)
    .where(eq(postDateNotesTable.id, id))
    .returning();
  res.json(serialize(updated!));
});

router.delete("/post-date-notes/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
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
  res.json({ success: true as const, deletedId: id });
});

router.post("/post-date-notes/:id/restore", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(postDateNotesTable)
    .where(and(eq(postDateNotesTable.id, id), ownerScope(req)) as SQL);
  if (!existing) {
    res.status(404).json({ error: "Post-date note not found" });
    return;
  }
  const [restored] = await db
    .update(postDateNotesTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(postDateNotesTable.id, id))
    .returning();
  res.json(serialize(restored!));
});

export default router;
