/**
 * Live Google Calendar reader. Uses the Replit-managed connection (the Repl's
 * single Google account, the founder's) via the connectors proxy, so no OAuth
 * tokens are ever held by this app. We perform READ-ONLY event list calls and
 * immediately reduce each event to a {@link NormalizedCalendarEvent}: a
 * wall-clock start, whether it had a time, and whether it recurs. We do NOT
 * keep the event title, description, location, or attendees for the live path
 * — the derived rhythm summary is the only thing that ever leaves this module.
 *
 * The client is created fresh on every call. Connection tokens expire, so this
 * module must never be cached or reused across requests.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  summarizeCalendarEvents,
  type CalendarRhythmSummary,
  type NormalizedCalendarEvent,
} from "./calendarParser";

const CONNECTOR = "google-calendar";
/** Window we read around "now" to characterise rhythm. Directional, not exact. */
const LOOKBACK_DAYS = 180;
const LOOKAHEAD_DAYS = 90;
const PAGE_SIZE = 2500;
const MAX_PAGES = 4;
const MAX_EVENTS = 6000;

export class GoogleCalendarError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleCalendarError";
    this.code = code;
  }
}

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  status?: string;
  start?: GoogleEventDateTime;
  recurringEventId?: string;
  recurrence?: string[];
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

/**
 * Parse a Google start value into wall-clock components, deliberately ignoring
 * the timezone offset so day-of-week and evening detection reflect the user's
 * intended local time (mirrors how the .ics parser treats wall-clock).
 */
function parseGoogleStart(start: GoogleEventDateTime | undefined): {
  date: Date | null;
  hasTime: boolean;
} {
  if (!start) return { date: null, hasTime: false };
  const value = start.dateTime ?? start.date;
  if (!value) return { date: null, hasTime: false };
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return { date: null, hasTime: false };
  const [, y, mo, d, hh, mm, ss] = m;
  const hasTime = hh !== undefined && start.dateTime !== undefined;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    hh ? Number(hh) : 0,
    mm ? Number(mm) : 0,
    ss ? Number(ss) : 0,
  );
  if (Number.isNaN(date.getTime())) return { date: null, hasTime: false };
  return { date, hasTime };
}

function normalize(event: GoogleEvent): NormalizedCalendarEvent {
  const { date, hasTime } = parseGoogleStart(event.start);
  return {
    start: date,
    hasTime,
    // The live path intentionally keeps no event text.
    summary: "",
    recurring: Boolean(event.recurringEventId),
  };
}

/**
 * Read the primary calendar's events through the managed proxy and reduce them
 * to a derived rhythm summary. Throws {@link GoogleCalendarError} with a stable
 * `code` the route layer records as the connector's `lastErrorCode`.
 */
export async function syncGoogleCalendarRhythm(): Promise<CalendarRhythmSummary> {
  const now = Date.now();
  const timeMin = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
  const timeMax = new Date(now + LOOKAHEAD_DAYS * 86_400_000).toISOString();

  const events: NormalizedCalendarEvent[] = [];
  let pageToken: string | undefined;
  let connectors: ReplitConnectors;
  try {
    connectors = new ReplitConnectors();
  } catch (err) {
    throw new GoogleCalendarError(
      "client_init_failed",
      err instanceof Error ? err.message : "Failed to init connectors client",
    );
  }

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: String(PAGE_SIZE),
      // Ask Google to send only the fields we reduce; never titles/notes.
      fields:
        "items(status,start(date,dateTime),recurringEventId),nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);

    let response: Response;
    try {
      response = await connectors.proxy(
        CONNECTOR,
        `/calendar/v3/calendars/primary/events?${params.toString()}`,
      );
    } catch (err) {
      throw new GoogleCalendarError(
        "proxy_request_failed",
        err instanceof Error ? err.message : "Proxy request failed",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new GoogleCalendarError(
        "not_connected",
        "Google Calendar is not connected for this Repl, or access was revoked.",
      );
    }
    if (!response.ok) {
      throw new GoogleCalendarError(
        "google_api_error",
        `Google Calendar API returned ${response.status}.`,
      );
    }

    let body: GoogleEventsResponse;
    try {
      body = (await response.json()) as GoogleEventsResponse;
    } catch {
      throw new GoogleCalendarError(
        "bad_response",
        "Google Calendar returned an unreadable response.",
      );
    }

    for (const item of body.items ?? []) {
      if (item.status === "cancelled") continue;
      events.push(normalize(item));
      if (events.length >= MAX_EVENTS) break;
    }

    if (events.length >= MAX_EVENTS || !body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return summarizeCalendarEvents(events, "google-calendar");
}
