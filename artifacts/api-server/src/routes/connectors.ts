import { Router, type IRouter } from "express";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  importedSourcesTable,
} from "@workspace/db";
import { GetConnectorsResponse } from "@workspace/api-zod";
import { requireFounder } from "../middlewares/founderAuth";
import {
  syncGoogleCalendarRhythm,
  GoogleCalendarError,
} from "../lib/googleCalendar";

const router: IRouter = Router();

/**
 * Data connectors surface. Live data is opt-in and, for Phase 1, founder-gated:
 * the Replit-managed Google connection is ONE account for the whole Repl (the
 * founder's), so a per-end-user live sync would attach the founder's calendar
 * to whoever called it. The read-only Google Calendar sync therefore lives
 * behind the founder key and attaches to the founder's own signed-in account;
 * the universal `.ics` paste path (in `imports.ts`) stays available to everyone.
 *
 * Only product state and derived counts are ever exposed or stored here. The
 * derived calendar rhythm itself flows through `imported_sources`
 * (source = `google-calendar`) so it aggregates into the single `calendar`
 * readiness lane alongside pasted `.ics`. We never store Google tokens (they are
 * Replit-managed) and never store raw events.
 */

const GOOGLE_PROVIDER = "google-calendar" as const;
const GOOGLE_LANE = "calendar" as const;
const GOOGLE_SOURCE = "google-calendar" as const;
const GOOGLE_CONSENT_VERSION = "google-calendar-v1";
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

const GOOGLE_DESCRIPTION =
  "Reads your calendar rhythm read-only: how full your week is and when you tend to be free, never the events themselves.";

type ConnectorStatusShape = {
  provider: typeof GOOGLE_PROVIDER;
  laneId: string;
  label: string;
  status: "available" | "connected" | "error" | "disconnected";
  live: boolean;
  founderOnly: boolean;
  derivedCount: number | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  description: string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The derived calendar-event count the live Google sync currently contributes. */
async function googleDerivedCount(userId: string): Promise<number | null> {
  const rows = await db
    .select({
      summary: importedSourcesTable.parsedSummary,
    })
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.userId, userId),
        eq(importedSourcesTable.source, GOOGLE_SOURCE),
        isNull(importedSourcesTable.deletedAt),
      ),
    )
    .orderBy(desc(importedSourcesTable.uploadedAt));
  const latest = rows[0]?.summary as
    | { counts?: { totalEvents?: number } }
    | undefined
    | null;
  if (!latest) return null;
  return Number(latest.counts?.totalEvents ?? 0);
}

/** Build the live Google Calendar connector status for one signed-in user. */
async function buildGoogleStatus(userId: string): Promise<ConnectorStatusShape> {
  const [conn] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.userId, userId),
        eq(connectorConnectionsTable.provider, GOOGLE_PROVIDER),
      ),
    );
  const derivedCount = await googleDerivedCount(userId);
  const status = (conn?.status ?? "available") as ConnectorStatusShape["status"];
  return {
    provider: GOOGLE_PROVIDER,
    laneId: GOOGLE_LANE,
    label: "Google Calendar",
    status,
    live: status === "connected",
    founderOnly: true,
    derivedCount,
    lastSyncAt: toIso(conn?.lastSyncAt ?? null),
    lastSuccessAt: toIso(conn?.lastSuccessAt ?? null),
    lastErrorCode: conn?.lastErrorCode ?? null,
    description: GOOGLE_DESCRIPTION,
  };
}

/** The signed-out demo connector list, clearly flagged, never a real account. */
function demoStatus(): ConnectorStatusShape {
  return {
    provider: GOOGLE_PROVIDER,
    laneId: GOOGLE_LANE,
    label: "Google Calendar",
    status: "available",
    live: false,
    founderOnly: true,
    derivedCount: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    description: GOOGLE_DESCRIPTION,
  };
}

/**
 * Read-only connector status for the caller. Auth-aware: signed-in users get
 * their own live state, signed-out callers get a clearly flagged demo so the
 * page is never empty. Live controls are founder-gated and live on the founder
 * endpoints below; this is status only.
 */
router.get("/me/connectors", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const connectors = userId ? [await buildGoogleStatus(userId)] : [demoStatus()];
  res.json(
    GetConnectorsResponse.parse({
      generatedAt: new Date().toISOString(),
      isDemo: !userId,
      connectors,
    }),
  );
});

function humanError(code: string): string {
  switch (code) {
    case "not_connected":
      return "Google Calendar is not connected for this Repl, or access was revoked. Connect it in the integration settings, then try again.";
    case "google_api_error":
      return "Google Calendar did not respond as expected. Try again in a moment.";
    case "bad_response":
      return "Google Calendar returned an unreadable response. Try again in a moment.";
    case "proxy_request_failed":
    case "client_init_failed":
      return "Could not reach Google Calendar. Try again in a moment.";
    default:
      return "Calendar sync failed. Try again in a moment.";
  }
}

/** Mark the connection errored, preserving any prior success/connect history. */
async function recordGoogleError(userId: string, code: string): Promise<void> {
  const now = new Date();
  await db
    .insert(connectorConnectionsTable)
    .values({
      userId,
      provider: GOOGLE_PROVIDER,
      laneId: GOOGLE_LANE,
      source: GOOGLE_SOURCE,
      status: "error",
      scopes: GOOGLE_SCOPES,
      consentVersion: GOOGLE_CONSENT_VERSION,
      lastSyncAt: now,
      lastErrorCode: code,
      connectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        connectorConnectionsTable.userId,
        connectorConnectionsTable.provider,
      ],
      set: { status: "error", lastSyncAt: now, lastErrorCode: code, updatedAt: now },
    });
}

/**
 * Founder-gated live Google Calendar sync. Reads the founder's primary calendar
 * read-only through the managed proxy, reduces it to the derived rhythm summary,
 * and stores ONLY that summary as a latest-wins `google-calendar` import row,
 * which feeds the shared `calendar` readiness lane. Requires the founder to be
 * signed in so the derived signal attaches to their own account.
 */
router.post(
  "/founder/connectors/google-calendar/sync",
  requireFounder,
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(400).json({
        error: "Sign in to the founder account before connecting the calendar.",
      });
      return;
    }

    let summary;
    try {
      summary = await syncGoogleCalendarRhythm();
    } catch (err) {
      const code = err instanceof GoogleCalendarError ? err.code : "sync_failed";
      await recordGoogleError(userId, code);
      req.log.error({ err, code }, "Google Calendar sync failed");
      res.status(502).json({ error: humanError(code), code });
      return;
    }

    const now = new Date();
    const inserted = await db.transaction(async (tx) => {
      await tx
        .delete(importedSourcesTable)
        .where(
          and(
            eq(importedSourcesTable.userId, userId),
            eq(importedSourcesTable.source, GOOGLE_SOURCE),
          ),
        );
      const [row] = await tx
        .insert(importedSourcesTable)
        .values({
          userId,
          anonymousClaimToken: null,
          source: GOOGLE_SOURCE,
          status: "complete",
          originalFilename: null,
          parsedSummary: summary as unknown as Record<string, unknown>,
          processedAt: now,
        })
        .returning();
      return row;
    });

    await db
      .insert(connectorConnectionsTable)
      .values({
        userId,
        provider: GOOGLE_PROVIDER,
        laneId: GOOGLE_LANE,
        source: GOOGLE_SOURCE,
        status: "connected",
        scopes: GOOGLE_SCOPES,
        consentVersion: GOOGLE_CONSENT_VERSION,
        lastSyncAt: now,
        lastSuccessAt: now,
        lastErrorCode: null,
        derivedImportId: inserted?.id ?? null,
        connectedAt: now,
        disconnectedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          connectorConnectionsTable.userId,
          connectorConnectionsTable.provider,
        ],
        set: {
          status: "connected",
          source: GOOGLE_SOURCE,
          laneId: GOOGLE_LANE,
          scopes: GOOGLE_SCOPES,
          consentVersion: GOOGLE_CONSENT_VERSION,
          lastSyncAt: now,
          lastSuccessAt: now,
          lastErrorCode: null,
          derivedImportId: inserted?.id ?? null,
          disconnectedAt: null,
          updatedAt: now,
        },
      });

    req.log.info(
      { userId, events: summary.counts.totalEvents },
      "Synced Google Calendar rhythm",
    );

    const status = await buildGoogleStatus(userId);
    res.json(
      GetConnectorsResponse.parse({
        generatedAt: new Date().toISOString(),
        isDemo: false,
        connectors: [status],
      }),
    );
  },
);

/**
 * Founder-gated disconnect: purges the founder's `google-calendar` derived rows
 * (the universal `.ics` paste rows are untouched) and marks the connection
 * disconnected. The shared `calendar` lane immediately reflects the lower count.
 */
router.post(
  "/founder/connectors/google-calendar/disconnect",
  requireFounder,
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(400).json({
        error: "Sign in to the founder account before disconnecting.",
      });
      return;
    }

    const now = new Date();
    const removed = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(importedSourcesTable)
        .where(
          and(
            eq(importedSourcesTable.userId, userId),
            eq(importedSourcesTable.source, GOOGLE_SOURCE),
          ),
        )
        .returning({ id: importedSourcesTable.id });
      await tx
        .update(connectorConnectionsTable)
        .set({
          status: "disconnected",
          lastErrorCode: null,
          derivedImportId: null,
          disconnectedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(connectorConnectionsTable.userId, userId),
            eq(connectorConnectionsTable.provider, GOOGLE_PROVIDER),
          ),
        );
      return rows.length;
    });

    req.log.info({ userId, removed }, "Disconnected Google Calendar");

    const status = await buildGoogleStatus(userId);
    res.json(
      GetConnectorsResponse.parse({
        generatedAt: new Date().toISOString(),
        isDemo: false,
        connectors: [status],
      }),
    );
  },
);

/**
 * Founder-only aggregate connector health for the control center. Reports
 * lifecycle counts, last sync/last success timestamps, and per-provider rollups
 * across all accounts. No raw content, no per-request writes: this is a pure
 * read over `connector_connections` product state.
 */
router.get(
  "/founder/connectors",
  requireFounder,
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(connectorConnectionsTable);

    const byProvider = new Map<
      string,
      {
        provider: string;
        total: number;
        connected: number;
        error: number;
        disconnected: number;
        lastSyncAt: Date | null;
        lastSuccessAt: Date | null;
      }
    >();

    let connected = 0;
    let errored = 0;
    let disconnected = 0;
    let lastSyncAt: Date | null = null;

    const maxDate = (a: Date | null, b: Date | null): Date | null => {
      if (!a) return b;
      if (!b) return a;
      return a.getTime() >= b.getTime() ? a : b;
    };

    for (const row of rows) {
      const p =
        byProvider.get(row.provider) ??
        {
          provider: row.provider,
          total: 0,
          connected: 0,
          error: 0,
          disconnected: 0,
          lastSyncAt: null as Date | null,
          lastSuccessAt: null as Date | null,
        };
      p.total += 1;
      if (row.status === "connected") {
        p.connected += 1;
        connected += 1;
      } else if (row.status === "error") {
        p.error += 1;
        errored += 1;
      } else if (row.status === "disconnected") {
        p.disconnected += 1;
        disconnected += 1;
      }
      const rowSync = row.lastSyncAt ? new Date(row.lastSyncAt) : null;
      const rowSuccess = row.lastSuccessAt ? new Date(row.lastSuccessAt) : null;
      p.lastSyncAt = maxDate(p.lastSyncAt, rowSync);
      p.lastSuccessAt = maxDate(p.lastSuccessAt, rowSuccess);
      lastSyncAt = maxDate(lastSyncAt, rowSync);
      byProvider.set(row.provider, p);
    }

    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        total: rows.length,
        connected,
        error: errored,
        disconnected,
      },
      lastSyncAt: toIso(lastSyncAt),
      providers: Array.from(byProvider.values()).map((p) => ({
        provider: p.provider,
        total: p.total,
        connected: p.connected,
        error: p.error,
        disconnected: p.disconnected,
        lastSyncAt: toIso(p.lastSyncAt),
        lastSuccessAt: toIso(p.lastSuccessAt),
      })),
    });
  },
);

export default router;
