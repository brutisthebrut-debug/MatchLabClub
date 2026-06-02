/**
 * Per-user signal counts, the data-to-signal half of the readiness pipeline.
 *
 * This is the single place that turns a user's stored data into the raw counts
 * the registry normalizes into coverage. Both the readiness score and the
 * visible trust ledger read from here, so the count a user sees in the ledger
 * is exactly the count that moves their Match Readiness. We never read raw
 * imported content: import sources are counted by row, and summary-backed
 * sources read only a single derived number out of the latest parsed summary.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  compatibilityReadsTable,
  journalEntriesTable,
  postDateNotesTable,
  wellnessAnswersTable,
  importedSourcesTable,
  datingWinsTable,
  auditsTable,
  messageCoachingSessionsTable,
  lifePulsesTable,
} from "@workspace/db";
import {
  SIGNAL_REGISTRY,
  type ReadinessBreakdown,
  type SignalCounts,
} from "./signalRegistry";

// Minimum substantive journal length (chars) to count toward readiness. A
// lazy one-liner should not move the needle; a real reflection should.
export const SUBSTANTIVE_JOURNAL_CHARS = 120;

/**
 * Collect every contributor's raw count for one user. First-party sources use
 * bespoke queries against their dedicated table; import-backed sources are
 * derived from the registry's data-source descriptors, so a new import or paste
 * connector is a registry entry plus a capture route, with no counting logic to
 * hand-wire here.
 */
export async function collectSignalCounts(
  userId: string,
): Promise<SignalCounts> {
  const compassRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(compatibilityReadsTable)
    .where(eq(compatibilityReadsTable.userId, userId));
  const compassCount = Number(compassRows[0]?.count ?? 0);

  // Only substantive journal entries count: a real reflection moves readiness,
  // a one-line note does not.
  const journalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, userId),
        isNull(journalEntriesTable.deletedAt),
        sql`char_length(trim(${journalEntriesTable.body})) >= ${SUBSTANTIVE_JOURNAL_CHARS}`,
      ),
    );
  const journalCount = Number(journalRows[0]?.count ?? 0);

  const wellnessRows = await db
    .select({
      count: sql<number>`count(distinct ${wellnessAnswersTable.dimension})::int`,
    })
    .from(wellnessAnswersTable)
    .where(eq(wellnessAnswersTable.userId, userId));
  const wellnessDistinct = Number(wellnessRows[0]?.count ?? 0);

  // Only post-date notes the user actually reflected on count: an outcome set
  // or a filled reflection field. An empty stub does not.
  const postDateRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postDateNotesTable)
    .where(
      and(
        eq(postDateNotesTable.userId, userId),
        isNull(postDateNotesTable.deletedAt),
        sql`(
          ${postDateNotesTable.outcome} is not null
          or char_length(trim(coalesce(${postDateNotesTable.whatWentWell}, ''))) > 0
          or char_length(trim(coalesce(${postDateNotesTable.whatDidnt}, ''))) > 0
        )`,
      ),
    );
  const postDateReflected = Number(postDateRows[0]?.count ?? 0);

  const winsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(datingWinsTable)
    .where(
      and(
        eq(datingWinsTable.userId, userId),
        isNull(datingWinsTable.deletedAt),
      ),
    );
  const winsCount = Number(winsRows[0]?.count ?? 0);

  // Profile audits that reached a generated report. Running an audit (profile or
  // photo screenshot) teaches the engine how the user presents themselves, so
  // it feeds the same readiness meter as every other source.
  const auditsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.userId, userId),
        isNull(auditsTable.deletedAt),
        sql`${auditsTable.reportGeneratedAt} is not null`,
      ),
    );
  const auditsCount = Number(auditsRows[0]?.count ?? 0);

  // Message coaching sessions. How a person actually talks is signal the matching
  // brain uses, not just how they describe their texting style.
  const coachingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messageCoachingSessionsTable)
    .where(eq(messageCoachingSessionsTable.userId, userId));
  const coachingCount = Number(coachingRows[0]?.count ?? 0);

  // Life pulse check-ins. Energy and headspace over time shape when someone is
  // genuinely ready to date, so the rhythm feeds the brain too.
  const lifePulseRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lifePulsesTable)
    .where(eq(lifePulsesTable.userId, userId));
  const lifePulseCount = Number(lifePulseRows[0]?.count ?? 0);

  // First-party counts: each comes from a bespoke query against a dedicated
  // table above, keyed here by the contributor's countKey.
  const counts = {
    compass: compassCount,
    journal: journalCount,
    wellnessDistinct,
    postDateReflected,
    wins: winsCount,
    audits: auditsCount,
    coaching: coachingCount,
    lifePulse: lifePulseCount,
  } as SignalCounts;

  // Import-backed counts, derived from the registry's data-source descriptors so
  // a new import or paste connector is a registry entry plus a capture route,
  // with no counting logic to hand-wire here. We never read the raw imported
  // content: importRows counts how many sources were imported, and
  // importSummaryCount reads only a single derived number out of the latest
  // row's parsed summary. Soft-deleted rows are excluded so removing a source
  // (one toggle purges) drops its signal.
  const importRowsBySource = new Map<string, number>();
  const rowGroups = await db
    .select({
      source: importedSourcesTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.userId, userId),
        isNull(importedSourcesTable.deletedAt),
      ),
    )
    .groupBy(importedSourcesTable.source);
  for (const row of rowGroups) {
    importRowsBySource.set(row.source, Number(row.count ?? 0));
  }

  async function latestSummaryCount(
    source: string,
    summaryPath: readonly [string, string],
  ): Promise<number> {
    const rows = await db
      .select({
        value: sql<number>`coalesce((${importedSourcesTable.parsedSummary}->${summaryPath[0]}->>${summaryPath[1]})::int, 0)`,
      })
      .from(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.userId, userId),
          eq(importedSourcesTable.source, source),
          isNull(importedSourcesTable.deletedAt),
        ),
      )
      .orderBy(desc(importedSourcesTable.uploadedAt))
      .limit(1);
    return Number(rows[0]?.value ?? 0);
  }

  for (const contributor of SIGNAL_REGISTRY) {
    const ds = contributor.dataSource;
    if (ds.kind === "importRows") {
      counts[contributor.countKey] = importRowsBySource.get(ds.source) ?? 0;
    } else if (ds.kind === "importSummaryCount") {
      counts[contributor.countKey] = await latestSummaryCount(
        ds.source,
        ds.summaryPath,
      );
    }
  }

  return counts;
}

/** Days since a timestamp, never negative. */
function ageDaysFrom(ts: Date | string | null | undefined): number | null {
  if (ts == null) return null;
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
}

/**
 * Per-lane recency: how many days since each decaying lane last received signal,
 * keyed by contributor id. Only lanes that declare a `decayHalfLifeDays` are
 * queried, so this is free for durable lanes and only runs when freshness decay
 * is actually switched on. A lane with no contributions maps to null (nothing to
 * fade). We read only the MAX timestamp per lane, never any row content, so this
 * surfaces recency without touching what the user actually wrote or imported.
 */
export async function collectSignalRecency(
  userId: string,
): Promise<Partial<Record<keyof ReadinessBreakdown, number | null>>> {
  const decaying = SIGNAL_REGISTRY.filter(
    (c) => (c.decayHalfLifeDays ?? 0) > 0,
  );
  if (decaying.length === 0) return {};

  // Latest activity per import source, in one grouped query (covers calendar,
  // receipts, hinge import, instagram tone, and any future import lane).
  const importLatest = new Map<string, Date>();
  const needsImport = decaying.some(
    (c) =>
      c.dataSource.kind === "importRows" ||
      c.dataSource.kind === "importSummaryCount",
  );
  if (needsImport) {
    const rows = await db
      .select({
        source: importedSourcesTable.source,
        latest: sql<string | null>`max(${importedSourcesTable.uploadedAt})`,
      })
      .from(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.userId, userId),
          isNull(importedSourcesTable.deletedAt),
        ),
      )
      .groupBy(importedSourcesTable.source);
    for (const r of rows) {
      if (r.latest) importLatest.set(r.source, new Date(r.latest));
    }
  }

  // Latest first-party timestamp per lane: MAX(created_at) from each dedicated
  // table, soft-deleted rows excluded so a purged source stops counting as
  // recent. One small grouped helper keeps each lane a one-liner.
  const firstParty: Partial<Record<string, Date | null>> = {};
  const decayingIds = new Set(decaying.map((c) => c.id as string));

  async function latestFor(
    id: string,
    query: () => Promise<{ latest: string | null }[]>,
  ): Promise<void> {
    if (!decayingIds.has(id)) return;
    const rows = await query();
    const latest = rows[0]?.latest;
    firstParty[id] = latest ? new Date(latest) : null;
  }

  await latestFor("compass", () =>
    db
      .select({ latest: sql<string | null>`max(${compatibilityReadsTable.createdAt})` })
      .from(compatibilityReadsTable)
      .where(
        and(
          eq(compatibilityReadsTable.userId, userId),
          isNull(compatibilityReadsTable.deletedAt),
        ),
      ),
  );
  await latestFor("wins", () =>
    db
      .select({ latest: sql<string | null>`max(${datingWinsTable.createdAt})` })
      .from(datingWinsTable)
      .where(
        and(eq(datingWinsTable.userId, userId), isNull(datingWinsTable.deletedAt)),
      ),
  );
  await latestFor("postDate", () =>
    db
      .select({ latest: sql<string | null>`max(${postDateNotesTable.createdAt})` })
      .from(postDateNotesTable)
      .where(
        and(
          eq(postDateNotesTable.userId, userId),
          isNull(postDateNotesTable.deletedAt),
        ),
      ),
  );
  await latestFor("coaching", () =>
    db
      .select({
        latest: sql<string | null>`max(${messageCoachingSessionsTable.createdAt})`,
      })
      .from(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId)),
  );
  await latestFor("lifePulse", () =>
    db
      .select({ latest: sql<string | null>`max(${lifePulsesTable.createdAt})` })
      .from(lifePulsesTable)
      .where(eq(lifePulsesTable.userId, userId)),
  );

  const out: Partial<Record<keyof ReadinessBreakdown, number | null>> = {};
  for (const c of decaying) {
    const ds = c.dataSource;
    if (ds.kind === "importRows" || ds.kind === "importSummaryCount") {
      out[c.id] = ageDaysFrom(importLatest.get(ds.source) ?? null);
    } else {
      out[c.id] = ageDaysFrom(firstParty[c.id as string] ?? null);
    }
  }
  return out;
}
