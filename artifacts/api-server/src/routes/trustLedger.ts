import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  compatibilityReadsTable,
  journalEntriesTable,
  postDateNotesTable,
  wellnessAnswersTable,
  wellnessTagsTable,
  importedSourcesTable,
  datingWinsTable,
  auditsTable,
  auditReportVersionsTable,
  messageCoachingSessionsTable,
  lifePulsesTable,
} from "@workspace/db";
import {
  GetTrustLedgerResponse,
  PurgeTrustSourceResponse,
} from "@workspace/api-zod";
import { SIGNAL_REGISTRY } from "../lib/signalRegistry";
import { collectSignalCounts } from "../lib/signalCounts";
import { computeBreakdown } from "../lib/readiness";

const router: IRouter = Router();

/**
 * The visible trust ledger. One entry per signal source the product can hold,
 * derived live from the signal registry and the same per-user counts that drive
 * Match Readiness, so the number a user sees here is exactly the number moving
 * their readiness, and a newly registered source appears automatically. Sources
 * with nothing stored are still listed (held: false) so the user sees the full
 * picture of what the machine could know, never a half-empty page.
 */
router.get("/me/trust-ledger", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const counts = await collectSignalCounts(userId);
  const breakdown = computeBreakdown(counts);

  // Raw stored counts, i.e. exactly how many rows a purge would remove for each
  // source. This is what `held`/`purgeable` must key off, NOT the readiness
  // signal `count`: a source can hold data (a one-line journal note, an
  // unreflected post-date stub, an import whose summary number is 0) that does
  // not move readiness, and the user must still be able to see and purge it.
  const importStoredBySource = new Map<string, number>();
  const importRows = await db
    .select({
      source: importedSourcesTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(importedSourcesTable)
    .where(eq(importedSourcesTable.userId, userId))
    .groupBy(importedSourcesTable.source);
  for (const row of importRows) {
    importStoredBySource.set(row.source, Number(row.count ?? 0));
  }

  const entries = await Promise.all(
    SIGNAL_REGISTRY.map(async (c) => {
      const count = counts[c.countKey] ?? 0;
      const coverage = breakdown[c.id] ?? 0;
      const ds = c.dataSource;
      let storedCount = 0;
      if (ds.kind === "importRows" || ds.kind === "importSummaryCount") {
        storedCount = importStoredBySource.get(ds.source) ?? 0;
      } else {
        storedCount = await FIRST_PARTY_SOURCES[c.id]!.countStored(db, userId);
      }
      const held = storedCount > 0;
      return {
        id: c.id,
        label: c.label,
        origin: c.trust.origin,
        noun: c.trust.noun,
        held,
        count,
        storedCount,
        coverage,
        summary: c.describe(coverage),
        dimensions: [...c.dimensions],
        seen: [...c.trust.seen],
        neverTouched: [...c.trust.neverTouched],
        actionLabel: c.action.label,
        actionHref: c.action.href,
        purgeable: held,
      };
    }),
  );

  res.json(
    GetTrustLedgerResponse.parse({
      generatedAt: new Date().toISOString(),
      entries,
    }),
  );
});

/**
 * How each first-party source's stored rows are hard-deleted. Import-backed
 * sources are handled separately by their `imported_sources.source` string, so
 * they are not listed here. Audits clear their report versions first (the
 * versions table references an audit id, not a user id) and then the audits
 * themselves, mirroring the cascade used by account deletion.
 */
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbClient = typeof db;

/**
 * Each first-party source pairs a `countStored` reader with a `purge` writer.
 * They MUST target the same rows: `countStored` is exactly the count of rows
 * `purge` would remove (both filter by userId only, with no readiness
 * narrowing), so `held`/`purgeable` in the ledger can never claim a source is
 * empty while a purge would still delete something, or vice versa.
 */
async function countBy(
  client: DbClient,
  table: Parameters<DbClient["delete"]>[0],
  predicate: ReturnType<typeof eq>,
): Promise<number> {
  const rows = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(predicate);
  return Number(rows[0]?.count ?? 0);
}

const FIRST_PARTY_SOURCES: Record<
  string,
  {
    countStored: (client: DbClient, userId: string) => Promise<number>;
    purge: (tx: TxClient, userId: string) => Promise<number>;
  }
> = {
  compass: {
    countStored: (client, userId) =>
      countBy(client, compatibilityReadsTable, eq(compatibilityReadsTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(compatibilityReadsTable)
        .where(eq(compatibilityReadsTable.userId, userId))
        .returning({ id: compatibilityReadsTable.id });
      return rows.length;
    },
  },
  journal: {
    countStored: (client, userId) =>
      countBy(client, journalEntriesTable, eq(journalEntriesTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, userId))
        .returning({ id: journalEntriesTable.id });
      return rows.length;
    },
  },
  wellness: {
    countStored: async (client, userId) => {
      const [answers, tags] = await Promise.all([
        countBy(client, wellnessAnswersTable, eq(wellnessAnswersTable.userId, userId)),
        countBy(client, wellnessTagsTable, eq(wellnessTagsTable.userId, userId)),
      ]);
      return answers + tags;
    },
    purge: async (tx, userId) => {
      const [answers, tags] = await Promise.all([
        tx
          .delete(wellnessAnswersTable)
          .where(eq(wellnessAnswersTable.userId, userId))
          .returning({ id: wellnessAnswersTable.id }),
        tx
          .delete(wellnessTagsTable)
          .where(eq(wellnessTagsTable.userId, userId))
          .returning({ id: wellnessTagsTable.id }),
      ]);
      return answers.length + tags.length;
    },
  },
  postDate: {
    countStored: (client, userId) =>
      countBy(client, postDateNotesTable, eq(postDateNotesTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(postDateNotesTable)
        .where(eq(postDateNotesTable.userId, userId))
        .returning({ id: postDateNotesTable.id });
      return rows.length;
    },
  },
  wins: {
    countStored: (client, userId) =>
      countBy(client, datingWinsTable, eq(datingWinsTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(datingWinsTable)
        .where(eq(datingWinsTable.userId, userId))
        .returning({ id: datingWinsTable.id });
      return rows.length;
    },
  },
  audits: {
    // The user-facing unit is the audit; report versions are child rows that the
    // purge clears alongside them, so held keys off the audit count.
    countStored: (client, userId) =>
      countBy(client, auditsTable, eq(auditsTable.userId, userId)),
    purge: async (tx, userId) => {
      const owned = await tx
        .select({ id: auditsTable.id })
        .from(auditsTable)
        .where(eq(auditsTable.userId, userId));
      const ids = owned.map((a) => a.id);
      let versionsRemoved = 0;
      if (ids.length > 0) {
        const versions = await tx
          .delete(auditReportVersionsTable)
          .where(inArray(auditReportVersionsTable.auditId, ids))
          .returning({ id: auditReportVersionsTable.id });
        versionsRemoved = versions.length;
      }
      const audits = await tx
        .delete(auditsTable)
        .where(eq(auditsTable.userId, userId))
        .returning({ id: auditsTable.id });
      return audits.length + versionsRemoved;
    },
  },
  coaching: {
    countStored: (client, userId) =>
      countBy(client, messageCoachingSessionsTable, eq(messageCoachingSessionsTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(messageCoachingSessionsTable)
        .where(eq(messageCoachingSessionsTable.userId, userId))
        .returning({ id: messageCoachingSessionsTable.id });
      return rows.length;
    },
  },
  lifePulse: {
    countStored: (client, userId) =>
      countBy(client, lifePulsesTable, eq(lifePulsesTable.userId, userId)),
    purge: async (tx, userId) => {
      const rows = await tx
        .delete(lifePulsesTable)
        .where(eq(lifePulsesTable.userId, userId))
        .returning({ id: lifePulsesTable.id });
      return rows.length;
    },
  },
};

// Fail fast at boot if a first-party signal source has no source handler.
// Without this, a newly registered first-party contributor would show up in the
// ledger yet 404 on delete (and have no stored-count reader). Keeping the guard
// here means the registry and the source map can never silently drift apart.
const MISSING_PURGE_HANDLERS = SIGNAL_REGISTRY.filter(
  (c) => c.dataSource.kind === "firstParty" && !FIRST_PARTY_SOURCES[c.id],
).map((c) => c.id);
if (MISSING_PURGE_HANDLERS.length > 0) {
  throw new Error(
    `Trust ledger: first-party signal sources without a purge handler: ${MISSING_PURGE_HANDLERS.join(", ")}`,
  );
}

/**
 * Purge every row behind one signal source. The whole delete runs inside a
 * single transaction so the source goes fully or not at all, and it drops that
 * source's contribution to Match Readiness on the next read. Import-backed
 * sources delete their `imported_sources` rows by source string; first-party
 * sources use the per-id map above. Reuses the same hard-delete safeguards as
 * account deletion. Unknown ids are 404, anonymous callers 401.
 */
router.delete("/me/trust-ledger/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const id = req.params["id"];
  const contributor = SIGNAL_REGISTRY.find((c) => c.id === id);
  if (!contributor || typeof id !== "string") {
    res.status(404).json({ error: "No signal source matches that id." });
    return;
  }

  const ds = contributor.dataSource;
  let removed = 0;

  if (ds.kind === "importRows" || ds.kind === "importSummaryCount") {
    const rows = await db
      .delete(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.userId, userId),
          eq(importedSourcesTable.source, ds.source),
        ),
      )
      .returning({ id: importedSourcesTable.id });
    removed = rows.length;
  } else {
    const source = FIRST_PARTY_SOURCES[contributor.id];
    if (!source) {
      res.status(404).json({ error: "No signal source matches that id." });
      return;
    }
    removed = await db.transaction(async (tx) => source.purge(tx, userId));
  }

  req.log.info(
    { userId, source: contributor.id, removed },
    "Purged a trust-ledger signal source",
  );

  res.json(
    PurgeTrustSourceResponse.parse({
      success: true,
      id: contributor.id,
      removed,
    }),
  );
});

export default router;
