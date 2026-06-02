/**
 * First-party journey instrumentation. A thin, fail-open helper around the
 * `journey_events` table so any route can record a meaningful step a person
 * takes without risking the request: recording is fire-and-forget and never
 * throws. The founder summary turns the raw rows into counts over time plus a
 * recent feed, which complements the derived readiness-to-revenue funnel.
 *
 * Privacy: callers pass only small derived props (a tool name, a path, a score
 * delta), never raw user content or PII.
 */
import { db, journeyEventsTable, JOURNEY_EVENT_TYPES } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import type { JourneyEventType } from "@workspace/db";
import { logger } from "./logger";

const VALID_TYPES = new Set<string>(JOURNEY_EVENT_TYPES);

export interface RecordJourneyEventInput {
  eventType: JourneyEventType;
  userId?: string | null;
  anonId?: string | null;
  props?: Record<string, unknown> | null;
}

/**
 * Record a journey event. Fire-and-forget: the returned promise always resolves,
 * never rejects, so callers can `void recordJourneyEvent(...)` from any hot path
 * without a try/catch. An unknown event type or a DB error is logged and dropped.
 */
export async function recordJourneyEvent(
  input: RecordJourneyEventInput,
): Promise<void> {
  try {
    if (!VALID_TYPES.has(input.eventType)) {
      logger.warn({ eventType: input.eventType }, "recordJourneyEvent: unknown event type dropped");
      return;
    }
    await db.insert(journeyEventsTable).values({
      eventType: input.eventType,
      userId: input.userId ?? null,
      anonId: input.anonId ?? null,
      props: input.props ?? null,
    });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), eventType: input.eventType },
      "recordJourneyEvent failed; dropped",
    );
  }
}

export interface JourneyEventCount {
  eventType: JourneyEventType;
  today: number;
  last7d: number;
  last30d: number;
}

export interface JourneyEventFeedItem {
  id: number;
  eventType: string;
  userId: string | null;
  anonId: string | null;
  props: Record<string, unknown> | null;
  createdAt: string;
}

export interface JourneyEventsSummary {
  counts: JourneyEventCount[];
  totals: { today: number; last7d: number; last30d: number };
  recent: JourneyEventFeedItem[];
}

/**
 * Aggregate journey events into per-type counts over today / 7d / 30d windows,
 * plus a recent feed. Fail-open: returns a zeroed summary on any error so the
 * founder view never breaks.
 */
export async function summarizeJourneyEvents(
  recentLimit = 50,
): Promise<JourneyEventsSummary> {
  const emptyCounts = (): JourneyEventCount[] =>
    JOURNEY_EVENT_TYPES.map((t) => ({ eventType: t, today: 0, last7d: 0, last30d: 0 }));

  // Counts and the recent feed are computed independently so a failure in one
  // (e.g. an unsupported aggregate in a given environment) never blanks the
  // other. Each section is fail-open and degrades to its zeroed/empty form.
  let counts: JourneyEventCount[] = emptyCounts();
  try {
    const countRows = await db
      .select({
        eventType: journeyEventsTable.eventType,
        today: sql<number>`count(*) filter (where ${journeyEventsTable.createdAt} >= date_trunc('day', now()))::int`,
        last7d: sql<number>`count(*) filter (where ${journeyEventsTable.createdAt} >= now() - interval '7 days')::int`,
        last30d: sql<number>`count(*) filter (where ${journeyEventsTable.createdAt} >= now() - interval '30 days')::int`,
      })
      .from(journeyEventsTable)
      .groupBy(journeyEventsTable.eventType);

    const byType = new Map(countRows.map((r) => [r.eventType, r]));
    counts = JOURNEY_EVENT_TYPES.map((t) => {
      const row = byType.get(t);
      return {
        eventType: t,
        today: Number(row?.today ?? 0),
        last7d: Number(row?.last7d ?? 0),
        last30d: Number(row?.last30d ?? 0),
      };
    });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "summarizeJourneyEvents: counts failed; returning zeroed counts",
    );
    counts = emptyCounts();
  }

  const totals = counts.reduce(
    (acc, c) => ({
      today: acc.today + c.today,
      last7d: acc.last7d + c.last7d,
      last30d: acc.last30d + c.last30d,
    }),
    { today: 0, last7d: 0, last30d: 0 },
  );

  let recent: JourneyEventFeedItem[] = [];
  try {
    const recentRows = await db
      .select()
      .from(journeyEventsTable)
      .orderBy(sql`${journeyEventsTable.createdAt} desc`)
      .limit(Math.max(1, Math.min(200, recentLimit)));

    recent = recentRows.map((r) => ({
      id: Number(r.id),
      eventType: r.eventType,
      userId: r.userId ?? null,
      anonId: r.anonId ?? null,
      props: (r.props as Record<string, unknown> | null) ?? null,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : new Date(r.createdAt as unknown as string).toISOString(),
    }));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "summarizeJourneyEvents: recent feed failed; returning empty feed",
    );
    recent = [];
  }

  return { counts, totals, recent };
}

export interface UserJourneySummary {
  signalsFedThisWeek: number;
  readinessGainedThisWeek: number;
  toolsCompletedThisWeek: number;
  hasHistory: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A user-scoped weekly momentum recap built only from the caller's own journey
 * events. We pull the caller's recent rows by a simple equality predicate, then
 * compute the 7-day window in JS rather than via a SQL interval/group-by, so the
 * same code path works under the test harness (which cannot evaluate interval
 * filters) and in production. Only derived counts leave this function; raw event
 * props are never returned. Fail-open: any error degrades to an empty summary so
 * the surface that calls it never breaks.
 */
export async function summarizeUserJourney(
  userId: string,
  now: Date = new Date(),
): Promise<UserJourneySummary> {
  const empty: UserJourneySummary = {
    signalsFedThisWeek: 0,
    readinessGainedThisWeek: 0,
    toolsCompletedThisWeek: 0,
    hasHistory: false,
  };
  if (!userId) return empty;

  try {
    const rows = await db
      .select({
        eventType: journeyEventsTable.eventType,
        props: journeyEventsTable.props,
        createdAt: journeyEventsTable.createdAt,
      })
      .from(journeyEventsTable)
      .where(eq(journeyEventsTable.userId, userId))
      .orderBy(desc(journeyEventsTable.createdAt))
      .limit(500);

    const cutoff = now.getTime() - WEEK_MS;
    let signalsFedThisWeek = 0;
    let readinessGainedThisWeek = 0;
    let toolsCompletedThisWeek = 0;
    for (const row of rows) {
      const ts =
        row.createdAt instanceof Date
          ? row.createdAt.getTime()
          : new Date(row.createdAt as unknown as string).getTime();
      if (Number.isNaN(ts) || ts < cutoff) continue;
      if (row.eventType === "signal_fed") {
        signalsFedThisWeek += 1;
      } else if (row.eventType === "tool_completed") {
        toolsCompletedThisWeek += 1;
      } else if (row.eventType === "readiness_gained") {
        const props = (row.props as Record<string, unknown> | null) ?? null;
        const delta = Number(props?.delta ?? 0);
        if (Number.isFinite(delta) && delta > 0) {
          readinessGainedThisWeek += delta;
        }
      }
    }

    return {
      signalsFedThisWeek,
      readinessGainedThisWeek: Math.round(readinessGainedThisWeek),
      toolsCompletedThisWeek,
      hasHistory: rows.length > 0,
    };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "summarizeUserJourney failed; returning empty summary",
    );
    return empty;
  }
}

export interface UserJourneyTotals {
  signalsFed: number;
  toolsCompleted: number;
}

/**
 * All-time totals of the caller's own signal-feeding and tool-completion events,
 * used to drive achievement unlocks. Scoped strictly to the caller by an equality
 * predicate and counted DB-side with filtered aggregates so the figure is a true
 * all-time count with no row cap (a high-activity user must never be undercounted
 * into a stuck unlock). Only the two derived counts leave this function.
 * Fail-open: any error degrades to zeros so the unlock board never breaks the page.
 */
export async function countUserJourneyTotals(
  userId: string,
): Promise<UserJourneyTotals> {
  const empty: UserJourneyTotals = { signalsFed: 0, toolsCompleted: 0 };
  if (!userId) return empty;

  try {
    const [row] = await db
      .select({
        signalsFed: sql<number>`count(*) filter (where ${journeyEventsTable.eventType} = 'signal_fed')::int`,
        toolsCompleted: sql<number>`count(*) filter (where ${journeyEventsTable.eventType} = 'tool_completed')::int`,
      })
      .from(journeyEventsTable)
      .where(eq(journeyEventsTable.userId, userId));

    return {
      signalsFed: Number(row?.signalsFed ?? 0),
      toolsCompleted: Number(row?.toolsCompleted ?? 0),
    };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "countUserJourneyTotals failed; returning zeros",
    );
    return empty;
  }
}
