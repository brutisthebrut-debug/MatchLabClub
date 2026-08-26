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
  wyrAnswersTable,
  dailySparkAnswersTable,
  flagSelectionsTable,
  scenarioResponsesTable,
  predictionResponsesTable,
  timeCapsulesTable,
  wingmanAnswersTable,
  cosmicChartsTable,
  userVerificationsTable,
  careDialectProfilesTable,
  behavioralGrowthEventsTable,
} from "@workspace/db";
import {
  SIGNAL_REGISTRY,
  type ReadinessBreakdown,
  type SignalCounts,
} from "./signalRegistry";
import { loadActivityDays } from "./activityDays";

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

  // Behavioral growth actions: experiments tried, patterns broken, what-changed
  // notes, follow-ups logged, and kept commitments. Each is a content-free row
  // (action type and timestamp), so this reads follow-through without touching
  // any private note. Soft-deleted rows are excluded so a trust-ledger purge
  // drops the signal.
  const behavioralGrowthRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(behavioralGrowthEventsTable)
    .where(
      and(
        eq(behavioralGrowthEventsTable.userId, userId),
        isNull(behavioralGrowthEventsTable.deletedAt),
      ),
    );
  const behavioralGrowthCount = Number(behavioralGrowthRows[0]?.count ?? 0);

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

  // Would You Rather answers count only after the member separately enables
  // matching use. Saving a private answer never moves the matching signal.
  const wyrRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wyrAnswersTable)
    .where(and(
      eq(wyrAnswersTable.userId, userId),
      eq(wyrAnswersTable.matchingUseAllowed, true),
    ));
  const wyrCount = Number(wyrRows[0]?.count ?? 0);

  // Daily Spark answers. One small reflective question a day, answered across
  // days rather than in a burst, builds a steady read on how someone thinks
  // about connection. One row per (user, question), so count(*) is the
  // distinct-question count. We store only the option chosen, never any text.
  const dailySparkRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dailySparkAnswersTable)
    .where(eq(dailySparkAnswersTable.userId, userId));
  const dailySparkCount = Number(dailySparkRows[0]?.count ?? 0);

  // Green and red flags. The selection accumulates in a single row per user, two
  // arrays of flag ids (what they bring, what they look for). The signal is how
  // many distinct flags they have named across both lists; we read only the
  // count of chosen ids here, never any free text.
  const flagRows = await db
    .select({
      bringFlags: flagSelectionsTable.bringFlags,
      seekFlags: flagSelectionsTable.seekFlags,
    })
    .from(flagSelectionsTable)
    .where(eq(flagSelectionsTable.userId, userId))
    .limit(1);
  const flagItems = (() => {
    const row = flagRows[0];
    if (!row) return 0;
    const ids = new Set<string>([
      ...(row.bringFlags ?? []),
      ...(row.seekFlags ?? []),
    ]);
    return ids.size;
  })();

  // Scenario reels: distinct "what would you do" scenarios responded to. One row
  // per (user, scenario) via the unique index, so a plain count is the distinct
  // count. We store only the option chosen, never any free text.
  const scenarioRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scenarioResponsesTable)
    .where(eq(scenarioResponsesTable.userId, userId));
  const scenarioCount = Number(scenarioRows[0]?.count ?? 0);

  // Predict yourself: distinct rounds completed. One row per (user, item) via the
  // unique index, so a plain count is the distinct count. We store only the
  // predicted and actual counts, never which statements were marked true.
  const predictionRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictionResponsesTable)
    .where(eq(predictionResponsesTable.userId, userId));
  const predictionCount = Number(predictionRows[0]?.count ?? 0);

  // Time capsule: notes written to a future partner. Notes accumulate, so a
  // plain row count is the signal. We read only the count here, never the note
  // bodies, which are shown back only to the user who wrote them.
  const capsuleRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(timeCapsulesTable)
    .where(eq(timeCapsulesTable.userId, userId));
  const capsuleCount = Number(capsuleRows[0]?.count ?? 0);

  // Wingman: outside perspectives gathered. One answer row per answered invite,
  // denormalized with the owner's userId, so a plain count is the number of
  // friends who weighed in. We read only the count here, never the individual
  // 1-5 scores, which are only ever surfaced aggregated.
  const wingmanRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wingmanAnswersTable)
    .where(eq(wingmanAnswersTable.userId, userId));
  const wingmanCount = Number(wingmanRows[0]?.count ?? 0);

  // Consistency: distinct days the user showed up and fed ANY signal in the
  // trailing 14-day window. Showing up across days, not in one burst, is its own
  // read on follow-through, so it feeds a small lane. loadActivityDays already
  // returns DISTINCT days across every source, so this reads deduped calendar
  // days only, never what was done on them, and never re-counts the per-lane
  // action counts above.
  const since14 = new Date(Date.now() - 13 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const activeDays14 = (await loadActivityDays(userId, since14)).length;

  // Cosmic Compass: one chart per person, so this is not a row count. The honest
  // signal is engagement with the mirror: one facet for having built a chart,
  // one more for having told us whether the read landed. We read only whether a
  // reaction exists, never the raw birth details, which never leave the compute.
  const cosmicRows = await db
    .select({
      reaction: cosmicChartsTable.reaction,
      relocationOpen: cosmicChartsTable.relocationOpen,
    })
    .from(cosmicChartsTable)
    .where(eq(cosmicChartsTable.userId, userId))
    .limit(1);
  const cosmicFacets =
    cosmicRows.length === 0 ? 0 : cosmicRows[0]?.reaction ? 2 : 1;
  // Relocation openness is a single preference facet, not a row count: one if
  // they opted in, zero otherwise. The chart itself feeds the cosmicProfile lane.
  const relocationFacets =
    cosmicRows.length > 0 && cosmicRows[0]?.relocationOpen ? 1 : 0;

  // Verification: how many Trust & Safety tiers the user has cleared. We read
  // only the result booleans (phone, selfie photo match, and government ID),
  // never the phone number, the photos, or any document, so this lane reflects
  // earned trust without ever holding identifying data.
  const verificationRows = await db
    .select({
      phoneVerified: userVerificationsTable.phoneVerified,
      selfieVerified: userVerificationsTable.selfieVerified,
      idVerified: userVerificationsTable.idVerified,
    })
    .from(userVerificationsTable)
    .where(eq(userVerificationsTable.userId, userId))
    .limit(1);
  const verificationFacets =
    (verificationRows[0]?.phoneVerified ? 1 : 0) +
    (verificationRows[0]?.selfieVerified ? 1 : 0) +
    (verificationRows[0]?.idVerified ? 1 : 0);

  // Care Dialect: one row per user holding their give/receive distributions. The
  // signal is binary (completing the quiz fills the lane), so we read only
  // whether tested data exists (a scored top key), never the raw answers, which
  // are never stored, nor the distribution values themselves. Both axes must be
  // scored to count, mirroring matching (styleFit needs both give and receive),
  // so a partial row never awards the lane while matching still sees it empty.
  const careDialectRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(careDialectProfilesTable)
    .where(
      and(
        eq(careDialectProfilesTable.userId, userId),
        sql`${careDialectProfilesTable.testedGiveTop} is not null`,
        sql`${careDialectProfilesTable.testedReceiveTop} is not null`,
      ),
    );
  const careDialectCount = Number(careDialectRows[0]?.count ?? 0);

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
    wyrAnswered: wyrCount,
    dailySparkAnswered: dailySparkCount,
    flagItems,
    activeDays14,
    scenariosPlayed: scenarioCount,
    predictionsAnswered: predictionCount,
    capsulesWritten: capsuleCount,
    wingmanPerspectives: wingmanCount,
    cosmicFacets,
    relocationFacets,
    verificationFacets,
    careDialect: careDialectCount,
    behavioralGrowthEvents: behavioralGrowthCount,
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
        eq(importedSourcesTable.matchingUseAllowed, true),
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
          eq(importedSourcesTable.matchingUseAllowed, true),
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
      // A lane may aggregate several import sources (e.g. dating-app imports
      // count Hinge + Tinder + Bumble). Sum across `sources` when set, else use
      // the single `source`.
      const keys = ds.sources ?? [ds.source];
      counts[contributor.countKey] = keys.reduce(
        (sum, key) => sum + (importRowsBySource.get(key) ?? 0),
        0,
      );
    } else if (ds.kind === "importSummaryCount") {
      // A summary lane may aggregate several sources (e.g. calendar rhythm
      // counts a pasted `.ics` plus a live `google-calendar` sync). Take the
      // latest summary count per source (latest-wins) and sum across them.
      const keys = ds.sources ?? [ds.source];
      const perSource = await Promise.all(
        keys.map((key) => latestSummaryCount(key, ds.summaryPath)),
      );
      counts[contributor.countKey] = perSource.reduce(
        (sum, value) => sum + value,
        0,
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
          eq(importedSourcesTable.matchingUseAllowed, true),
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
      // For multi-source lanes, recency is the most recent activity across all
      // of its sources (smallest age = most recent timestamp).
      const keys = ds.sources ?? [ds.source];
      const ages = keys
        .map((key) => ageDaysFrom(importLatest.get(key) ?? null))
        .filter((age): age is number => age !== null);
      out[c.id] = ages.length > 0 ? Math.min(...ages) : null;
    } else {
      out[c.id] = ageDaysFrom(firstParty[c.id as string] ?? null);
    }
  }
  return out;
}
