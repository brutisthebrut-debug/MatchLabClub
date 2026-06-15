/**
 * Lightweight .ics (iCalendar) parser for the calendar paste connector
 * (Beat 5). We never fetch a remote URL; the user pastes the raw file
 * contents and we parse event rhythm in memory. The raw text is not
 * persisted, only the structured summary below.
 *
 * Times are treated as wall-clock. We do not convert time zones: for
 * day-of-week and evening-vs-daytime rhythm that approximation is honest
 * and avoids pulling in a tz database for a signal that is directional,
 * not exact.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MAX_EVENTS = 5000;

/** Source strings that feed the single `calendar` readiness lane. */
export type CalendarSource = "calendar-ics" | "google-calendar";

export interface CalendarRhythmSummary {
  source: CalendarSource;
  counts: {
    totalEvents: number;
    timedEvents: number;
    allDayEvents: number;
    recurringEvents: number;
  };
  rhythm: {
    eventsPerWeek: number;
    busiestDay: string | null;
    weekendShare: number;
    eveningShare: number;
    earliestEventAt: string | null;
    latestEventAt: string | null;
    spanDays: number;
  };
  dayBreakdown: { day: string; count: number }[];
  topRecurring: string[];
  reads: string[];
}

/**
 * A single normalized calendar event. Both the .ics paste parser and the live
 * Google Calendar sync reduce their raw inputs to this shape before the shared
 * aggregator runs, so the derived rhythm summary is identical regardless of
 * source. We hold only wall-clock start, whether it had a time, a short
 * truncated title, and whether it recurs — never location, attendees, notes,
 * or any other event content.
 */
export interface NormalizedCalendarEvent {
  start: Date | null;
  hasTime: boolean;
  summary: string;
  recurring: boolean;
}

type RawEvent = NormalizedCalendarEvent;

/**
 * RFC 5545 line unfolding: a line that begins with a space or tab is a
 * continuation of the previous line.
 */
function unfoldLines(raw: string): string[] {
  const lines = raw.split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsDateValue(value: string): { date: Date | null; hasTime: boolean } {
  const m = value
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/);
  if (!m) return { date: null, hasTime: false };
  const [, y, mo, d, hh, mm, ss] = m;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const hasTime = hh !== undefined;
  const date = new Date(
    year,
    month,
    day,
    hh ? Number(hh) : 0,
    mm ? Number(mm) : 0,
    ss ? Number(ss) : 0,
  );
  if (Number.isNaN(date.getTime())) return { date: null, hasTime: false };
  return { date, hasTime };
}

function decodeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim()
    .slice(0, 200);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function parseCalendarIcs(raw: string): CalendarRhythmSummary {
  const lines = unfoldLines(raw);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      cur = { start: null, hasTime: false, summary: "", recurring: false };
      continue;
    }
    if (upper === "END:VEVENT") {
      if (cur) {
        events.push(cur);
        if (events.length >= MAX_EVENTS) break;
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const namePart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const name = (namePart.split(";")[0] ?? "").toUpperCase();
    if (name === "DTSTART") {
      const { date, hasTime } = parseIcsDateValue(value);
      const isDateOnly = /VALUE=DATE(?![-A-Z])/i.test(namePart);
      cur.start = date;
      cur.hasTime = hasTime && !isDateOnly;
    } else if (name === "SUMMARY") {
      cur.summary = decodeText(value);
    } else if (name === "RRULE") {
      cur.recurring = true;
    }
  }

  return summarizeCalendarEvents(events, "calendar-ics");
}

/**
 * Shared aggregator: turns a list of normalized events into the derived rhythm
 * summary. Used by both the .ics paste parser above and the live Google
 * Calendar sync, so the two paths produce an identical summary shape and feed
 * the same `calendar` readiness lane. No raw event content is retained here
 * beyond the directional counts and shares.
 */
export function summarizeCalendarEvents(
  events: NormalizedCalendarEvent[],
  source: CalendarSource,
): CalendarRhythmSummary {
  const valid = events.filter((e) => e.start !== null) as (RawEvent & {
    start: Date;
  })[];

  const totalEvents = valid.length;
  const timedEvents = valid.filter((e) => e.hasTime).length;
  const allDayEvents = totalEvents - timedEvents;
  const recurringEvents = valid.filter((e) => e.recurring).length;

  const dayCounts = new Array(7).fill(0) as number[];
  let weekendCount = 0;
  let eveningCount = 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const e of valid) {
    const dow = e.start.getDay();
    dayCounts[dow] = (dayCounts[dow] ?? 0) + 1;
    if (dow === 0 || dow === 6) weekendCount += 1;
    if (e.hasTime && e.start.getHours() >= 17) eveningCount += 1;
    if (!earliest || e.start < earliest) earliest = e.start;
    if (!latest || e.start > latest) latest = e.start;
  }

  const spanMs = earliest && latest ? latest.getTime() - earliest.getTime() : 0;
  const spanDays = Math.max(0, Math.round(spanMs / 86_400_000));
  const spanWeeks = Math.max(1, spanDays / 7);
  const eventsPerWeek = totalEvents > 0 ? round(totalEvents / spanWeeks) : 0;

  let busiestDayIdx = -1;
  let busiestDayCount = -1;
  for (let i = 0; i < 7; i += 1) {
    if ((dayCounts[i] ?? 0) > busiestDayCount) {
      busiestDayCount = dayCounts[i] ?? 0;
      busiestDayIdx = i;
    }
  }
  const busiestDay =
    busiestDayIdx >= 0 && busiestDayCount > 0
      ? (DAY_NAMES[busiestDayIdx] ?? null)
      : null;

  const weekendShare =
    totalEvents > 0 ? Math.round((weekendCount / totalEvents) * 100) : 0;
  const eveningShare =
    timedEvents > 0 ? Math.round((eveningCount / timedEvents) * 100) : 0;

  const dayBreakdown = DAY_NAMES.map((day, i) => ({
    day,
    count: dayCounts[i] ?? 0,
  }));

  const topRecurring = Array.from(
    new Set(
      valid
        .filter((e) => e.recurring && e.summary)
        .map((e) => e.summary),
    ),
  ).slice(0, 5);

  const reads: string[] = [];
  if (totalEvents > 0) {
    reads.push(
      `You log about ${eventsPerWeek} ${eventsPerWeek === 1 ? "event" : "events"} a week across the window you shared.`,
    );
  }
  if (busiestDay) {
    reads.push(`${busiestDay} is your busiest day.`);
  }
  if (totalEvents > 0) {
    reads.push(
      weekendShare >= 40
        ? `${weekendShare}% of what you schedule lands on the weekend, so your social weight skews late-week.`
        : `Most of your calendar sits on weekdays, with ${weekendShare}% on the weekend.`,
    );
  }
  if (timedEvents > 0) {
    reads.push(
      eveningShare >= 50
        ? `${eveningShare}% of your timed events start after 5pm, so evenings carry most of your plans.`
        : `Your timed events lean earlier in the day, with ${eveningShare}% starting after 5pm.`,
    );
  }
  if (recurringEvents > 0) {
    const example = topRecurring[0];
    reads.push(
      example
        ? `${recurringEvents} recurring ${recurringEvents === 1 ? "ritual" : "rituals"} show up, like "${example}".`
        : `${recurringEvents} recurring ${recurringEvents === 1 ? "ritual" : "rituals"} anchor your week.`,
    );
  }

  return {
    source,
    counts: { totalEvents, timedEvents, allDayEvents, recurringEvents },
    rhythm: {
      eventsPerWeek,
      busiestDay,
      weekendShare,
      eveningShare,
      earliestEventAt: earliest ? earliest.toISOString() : null,
      latestEventAt: latest ? latest.toISOString() : null,
      spanDays,
    },
    dayBreakdown,
    topRecurring,
    reads,
  };
}
