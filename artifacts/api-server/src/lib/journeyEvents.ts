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
import { sql } from "drizzle-orm";
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
