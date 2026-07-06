import { Router, type IRouter, type Request } from "express";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  importedSourcesTable,
  oauthTokensTable,
  type OauthToken,
} from "@workspace/db";
import { GetConnectorsResponse } from "@workspace/api-zod";
import { requireFounder } from "../middlewares/founderAuth";
import {
  syncGoogleCalendarRhythm,
  GoogleCalendarError,
} from "../lib/googleCalendar";
import {
  OAUTH_PROVIDERS,
  getProviderConfig,
  providerConfigured,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  OAuthConnectorError,
  type OAuthProviderConfig,
  type NormalizedTokens,
} from "../lib/oauthConnectors";
import { signOAuthState, verifyOAuthState } from "../lib/oauthState";
import { sealToken, openToken } from "../lib/tokenCrypto";

const router: IRouter = Router();

/**
 * Data connectors surface. Two kinds live here:
 *
 *  - The Replit-managed Google Calendar sync is founder-gated: the Google
 *    connection is ONE account for the whole Repl (the founder's), so a
 *    per-end-user live sync would attach the founder's calendar to whoever
 *    called it. It attaches to the founder's own signed-in account instead;
 *    the universal `.ics` paste path (in `imports.ts`) stays available to all.
 *
 *  - Per-user consumer connectors (Strava, Fitbit, Exist) authorize each END
 *    USER individually through a standard OAuth code flow. We hold each user's
 *    tokens sealed in `oauth_tokens` (never plaintext), sync read-only, and
 *    store ONLY the derived count. Each provider is gated behind its own
 *    client id / secret: unconfigured providers report `configured: false` and
 *    refuse to start a flow, so the feature ships safely before credentials
 *    exist.
 *
 * Only product state and derived counts are ever exposed or stored here. The
 * derived signal itself flows through `imported_sources` so it aggregates into
 * a single readiness lane alongside any pasted equivalent. Raw events, tracks,
 * activities, and attributes are never stored.
 */

const GOOGLE_PROVIDER = "google-calendar" as const;
const GOOGLE_LANE = "calendar" as const;
const GOOGLE_SOURCE = "google-calendar" as const;
const GOOGLE_CONSENT_VERSION = "google-calendar-v1";
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

const GOOGLE_DESCRIPTION =
  "Reads your calendar rhythm read-only: how full your week is and when you tend to be free, never the events themselves.";

type ConnectorStatusShape = {
  provider: string;
  laneId: string;
  label: string;
  status: "available" | "connected" | "error" | "disconnected";
  live: boolean;
  founderOnly: boolean;
  configured: boolean;
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

/** Absolute origin for building OAuth redirect URIs that survive round-trips. */
function baseUrl(req: Request): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (domains && domains.length > 0) return `https://${domains[0]}`;
  const proto = req.protocol || "https";
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

function callbackUri(req: Request, providerId: string): string {
  return `${baseUrl(req)}/api/me/connectors/${providerId}/callback`;
}

// ---------------------------------------------------------------------------
// Google Calendar (founder-managed, one account for the whole Repl)
// ---------------------------------------------------------------------------

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
    configured: true,
    derivedCount,
    lastSyncAt: toIso(conn?.lastSyncAt ?? null),
    lastSuccessAt: toIso(conn?.lastSuccessAt ?? null),
    lastErrorCode: conn?.lastErrorCode ?? null,
    description: GOOGLE_DESCRIPTION,
  };
}

/** The signed-out demo Google entry, clearly flagged, never a real account. */
function demoGoogleStatus(): ConnectorStatusShape {
  return {
    provider: GOOGLE_PROVIDER,
    laneId: GOOGLE_LANE,
    label: "Google Calendar",
    status: "available",
    live: false,
    founderOnly: true,
    configured: true,
    derivedCount: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    description: GOOGLE_DESCRIPTION,
  };
}

// ---------------------------------------------------------------------------
// Per-user OAuth connectors (Strava, Fitbit, Exist)
// ---------------------------------------------------------------------------

/** The derived item count a per-user OAuth connector currently contributes. */
async function oauthDerivedCount(
  userId: string,
  cfg: OAuthProviderConfig,
): Promise<number | null> {
  const rows = await db
    .select({ summary: importedSourcesTable.parsedSummary })
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.userId, userId),
        eq(importedSourcesTable.source, cfg.source),
        isNull(importedSourcesTable.deletedAt),
      ),
    )
    .orderBy(desc(importedSourcesTable.uploadedAt));
  const latest = rows[0]?.summary as
    | { counts?: { items?: number } }
    | undefined
    | null;
  if (!latest) return null;
  return Number(latest.counts?.items ?? 0);
}

async function buildOAuthStatus(
  userId: string,
  cfg: OAuthProviderConfig,
): Promise<ConnectorStatusShape> {
  const [conn] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.userId, userId),
        eq(connectorConnectionsTable.provider, cfg.id),
      ),
    );
  const derivedCount = await oauthDerivedCount(userId, cfg);
  const status = (conn?.status ?? "available") as ConnectorStatusShape["status"];
  return {
    provider: cfg.id,
    laneId: cfg.laneId,
    label: cfg.label,
    status,
    live: status === "connected",
    founderOnly: false,
    configured: providerConfigured(cfg),
    derivedCount,
    lastSyncAt: toIso(conn?.lastSyncAt ?? null),
    lastSuccessAt: toIso(conn?.lastSuccessAt ?? null),
    lastErrorCode: conn?.lastErrorCode ?? null,
    description: cfg.description,
  };
}

function demoOAuthStatus(cfg: OAuthProviderConfig): ConnectorStatusShape {
  return {
    provider: cfg.id,
    laneId: cfg.laneId,
    label: cfg.label,
    status: "available",
    live: false,
    founderOnly: false,
    configured: providerConfigured(cfg),
    derivedCount: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    description: cfg.description,
  };
}

/** All connector statuses for a signed-in user (Google + every OAuth provider). */
async function buildAllStatuses(
  userId: string,
): Promise<ConnectorStatusShape[]> {
  const [google, ...oauth] = await Promise.all([
    buildGoogleStatus(userId),
    ...OAUTH_PROVIDERS.map((cfg) => buildOAuthStatus(userId, cfg)),
  ]);
  return [google, ...oauth];
}

/** Store freshly issued tokens for a user, sealed. Upserts on (user, provider). */
async function storeTokens(
  userId: string,
  cfg: OAuthProviderConfig,
  tokens: NormalizedTokens,
): Promise<void> {
  const now = new Date();
  const sealedAccess = sealToken(tokens.accessToken);
  const sealedRefresh = tokens.refreshToken
    ? sealToken(tokens.refreshToken)
    : null;
  const scopes = tokens.scopes ?? [...cfg.scopes];
  await db
    .insert(oauthTokensTable)
    .values({
      userId,
      provider: cfg.id,
      accessToken: sealedAccess,
      refreshToken: sealedRefresh,
      scopes,
      expiresAt: tokens.expiresAt,
      providerUserId: tokens.providerUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [oauthTokensTable.userId, oauthTokensTable.provider],
      set: {
        accessToken: sealedAccess,
        refreshToken: sealedRefresh,
        scopes,
        expiresAt: tokens.expiresAt,
        providerUserId: tokens.providerUserId,
        updatedAt: now,
      },
    });
}

/**
 * Persist a refreshed access token. Providers that rotate refresh tokens
 * (Strava) return a new one; those that do not (Fitbit sometimes) leave the
 * previously stored sealed refresh token in place so the next refresh works.
 */
async function persistRefreshedTokens(
  userId: string,
  cfg: OAuthProviderConfig,
  fresh: NormalizedTokens,
  prev: OauthToken,
): Promise<void> {
  const now = new Date();
  const sealedAccess = sealToken(fresh.accessToken);
  const sealedRefresh = fresh.refreshToken
    ? sealToken(fresh.refreshToken)
    : prev.refreshToken;
  await db
    .update(oauthTokensTable)
    .set({
      accessToken: sealedAccess,
      refreshToken: sealedRefresh,
      expiresAt: fresh.expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(oauthTokensTable.userId, userId),
        eq(oauthTokensTable.provider, cfg.id),
      ),
    );
}

/** Unseal a usable access token, refreshing proactively when near expiry. */
async function ensureFreshAccessToken(
  userId: string,
  cfg: OAuthProviderConfig,
  tokenRow: OauthToken,
): Promise<string> {
  const access = openToken(tokenRow.accessToken);
  const nearExpiry =
    tokenRow.expiresAt != null &&
    tokenRow.expiresAt.getTime() - Date.now() < 60_000;
  if (access && !nearExpiry) return access;
  const refresh = openToken(tokenRow.refreshToken);
  if (!refresh) {
    if (access) return access;
    throw new OAuthConnectorError(
      "reauth_required",
      "Reconnect this source",
      401,
    );
  }
  const fresh = await refreshAccessToken(cfg, refresh);
  await persistRefreshedTokens(userId, cfg, fresh, tokenRow);
  return fresh.accessToken;
}

/** Mark a connector connection errored, preserving prior success history. */
async function recordOAuthError(
  userId: string,
  cfg: OAuthProviderConfig,
  code: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(connectorConnectionsTable)
    .values({
      userId,
      provider: cfg.id,
      laneId: cfg.laneId,
      source: cfg.source,
      status: "error",
      scopes: [...cfg.scopes],
      consentVersion: cfg.consentVersion,
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

/** Mark a connector connection connected after a successful sync. */
async function recordOAuthConnected(
  userId: string,
  cfg: OAuthProviderConfig,
  derivedImportId: number | null,
  at: Date,
): Promise<void> {
  await db
    .insert(connectorConnectionsTable)
    .values({
      userId,
      provider: cfg.id,
      laneId: cfg.laneId,
      source: cfg.source,
      status: "connected",
      scopes: [...cfg.scopes],
      consentVersion: cfg.consentVersion,
      lastSyncAt: at,
      lastSuccessAt: at,
      lastErrorCode: null,
      derivedImportId,
      connectedAt: at,
      disconnectedAt: null,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: [
        connectorConnectionsTable.userId,
        connectorConnectionsTable.provider,
      ],
      set: {
        status: "connected",
        source: cfg.source,
        laneId: cfg.laneId,
        scopes: [...cfg.scopes],
        consentVersion: cfg.consentVersion,
        lastSyncAt: at,
        lastSuccessAt: at,
        lastErrorCode: null,
        derivedImportId,
        disconnectedAt: null,
        updatedAt: at,
      },
    });
}

/**
 * Read the provider API read-only, reduce it to the derived count, and store
 * ONLY that count as a latest-wins import row feeding the connector's lane.
 * Retries once with a forced token refresh on a 401.
 */
async function syncProvider(
  userId: string,
  cfg: OAuthProviderConfig,
): Promise<number> {
  const [tokenRow] = await db
    .select()
    .from(oauthTokensTable)
    .where(
      and(
        eq(oauthTokensTable.userId, userId),
        eq(oauthTokensTable.provider, cfg.id),
      ),
    );
  if (!tokenRow) {
    throw new OAuthConnectorError("not_connected", "Connect this source first", 404);
  }

  let accessToken = await ensureFreshAccessToken(userId, cfg, tokenRow);
  let summary;
  try {
    summary = await cfg.fetchAndReduce(accessToken);
  } catch (err) {
    if (err instanceof OAuthConnectorError && err.code === "unauthorized") {
      const refresh = openToken(tokenRow.refreshToken);
      if (!refresh) {
        throw new OAuthConnectorError(
          "reauth_required",
          "Reconnect this source",
          401,
        );
      }
      const fresh = await refreshAccessToken(cfg, refresh);
      await persistRefreshedTokens(userId, cfg, fresh, tokenRow);
      accessToken = fresh.accessToken;
      summary = await cfg.fetchAndReduce(accessToken);
    } else {
      throw err;
    }
  }

  const now = new Date();
  const inserted = await db.transaction(async (tx) => {
    await tx
      .delete(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.userId, userId),
          eq(importedSourcesTable.source, cfg.source),
        ),
      );
    const [row] = await tx
      .insert(importedSourcesTable)
      .values({
        userId,
        anonymousClaimToken: null,
        source: cfg.source,
        status: "complete",
        originalFilename: null,
        parsedSummary: summary as unknown as Record<string, unknown>,
        processedAt: now,
      })
      .returning();
    return row;
  });

  await recordOAuthConnected(userId, cfg, inserted?.id ?? null, now);
  return summary.counts.items;
}

function humanOAuthError(cfg: OAuthProviderConfig, code: string): string {
  switch (code) {
    case "not_connected":
      return `${cfg.label} is not connected. Connect it first, then sync.`;
    case "reauth_required":
      return `${cfg.label} needs to be reconnected. Connect it again to refresh access.`;
    case "not_configured":
      return `${cfg.label} is not available yet.`;
    case "provider_unreachable":
      return `Could not reach ${cfg.label}. Try again in a moment.`;
    default:
      return `${cfg.label} sync failed. Try again in a moment.`;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Read-only connector status for the caller. Auth-aware: signed-in users get
 * their own live state across every connector, signed-out callers get a clearly
 * flagged demo so the page is never empty. The Google lane's live controls stay
 * founder-gated; the OAuth lanes' connect/sync/disconnect controls are per-user.
 */
router.get("/me/connectors", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const connectors = userId
    ? await buildAllStatuses(userId)
    : [demoGoogleStatus(), ...OAUTH_PROVIDERS.map(demoOAuthStatus)];
  res.json(
    GetConnectorsResponse.parse({
      generatedAt: new Date().toISOString(),
      isDemo: !userId,
      connectors,
    }),
  );
});

/**
 * Start a per-user OAuth flow. Requires the user to be signed in so the
 * connection can only ever attach to their own account. Redirects the browser
 * to the provider's authorize page with a signed, identity-bound state.
 */
router.get(
  "/me/connectors/:provider/connect",
  (req, res): void => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in to connect a data source." });
      return;
    }
    const cfg = getProviderConfig(req.params.provider);
    if (!cfg) {
      res.status(404).json({ error: "Unknown connector." });
      return;
    }
    if (!providerConfigured(cfg)) {
      res.status(503).json({ error: `${cfg.label} is not available yet.` });
      return;
    }
    const state = signOAuthState(userId, cfg.id);
    res.redirect(buildAuthorizeUrl(cfg, state, callbackUri(req, cfg.id)));
  },
);

/**
 * OAuth callback. Verifies the signed state and that it belongs to the current
 * signed-in user, exchanges the code for tokens, seals and stores them, runs an
 * initial sync, and redirects back to the Connection Center. All failures land
 * back on the page with an error code instead of a raw error.
 */
router.get(
  "/me/connectors/:provider/callback",
  async (req, res): Promise<void> => {
    const appBase = baseUrl(req);
    const providerId = req.params.provider;
    const back = (params: string): void =>
      res.redirect(`${appBase}/connections?${params}`);

    const cfg = getProviderConfig(providerId);
    if (!cfg) {
      back(`connector=${encodeURIComponent(providerId)}&error=unknown`);
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      back(`connector=${cfg.id}&error=signin`);
      return;
    }
    const state = verifyOAuthState(req.query.state);
    if (!state || state.userId !== userId || state.provider !== cfg.id) {
      back(`connector=${cfg.id}&error=state`);
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      back(`connector=${cfg.id}&error=denied`);
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(
        cfg,
        code,
        callbackUri(req, cfg.id),
      );
      await storeTokens(userId, cfg, tokens);
      await syncProvider(userId, cfg);
    } catch (err) {
      const codeStr =
        err instanceof OAuthConnectorError ? err.code : "connect_failed";
      await recordOAuthError(userId, cfg, codeStr).catch(() => {});
      req.log.error({ err, provider: cfg.id }, "OAuth connect failed");
      back(`connector=${cfg.id}&error=connect`);
      return;
    }

    back(`connector=${cfg.id}&connected=1`);
  },
);

/**
 * Manually re-sync a connected per-user OAuth connector. No background job runs;
 * refresh happens on connect and on demand here.
 */
router.post(
  "/me/connectors/:provider/sync",
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }
    const cfg = getProviderConfig(req.params.provider);
    if (!cfg) {
      res.status(404).json({ error: "Unknown connector." });
      return;
    }
    if (!providerConfigured(cfg)) {
      res.status(503).json({ error: `${cfg.label} is not available yet.` });
      return;
    }

    try {
      await syncProvider(userId, cfg);
    } catch (err) {
      const code =
        err instanceof OAuthConnectorError ? err.code : "sync_failed";
      await recordOAuthError(userId, cfg, code).catch(() => {});
      req.log.error({ err, provider: cfg.id, code }, "Connector sync failed");
      const httpStatus =
        err instanceof OAuthConnectorError &&
        (err.status === 404 || err.status === 401)
          ? err.status
          : 502;
      res.status(httpStatus).json({ error: humanOAuthError(cfg, code), code });
      return;
    }

    const connectors = await buildAllStatuses(userId);
    res.json(
      GetConnectorsResponse.parse({
        generatedAt: new Date().toISOString(),
        isDemo: false,
        connectors,
      }),
    );
  },
);

/**
 * Disconnect a per-user OAuth connector: purge the user's derived import rows
 * for this provider, delete the sealed tokens, and mark the connection
 * disconnected. The readiness lane immediately reflects the lower count.
 */
router.post(
  "/me/connectors/:provider/disconnect",
  async (req, res): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }
    const cfg = getProviderConfig(req.params.provider);
    if (!cfg) {
      res.status(404).json({ error: "Unknown connector." });
      return;
    }

    const now = new Date();
    const removed = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(importedSourcesTable)
        .where(
          and(
            eq(importedSourcesTable.userId, userId),
            eq(importedSourcesTable.source, cfg.source),
          ),
        )
        .returning({ id: importedSourcesTable.id });
      await tx
        .delete(oauthTokensTable)
        .where(
          and(
            eq(oauthTokensTable.userId, userId),
            eq(oauthTokensTable.provider, cfg.id),
          ),
        );
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
            eq(connectorConnectionsTable.provider, cfg.id),
          ),
        );
      return rows.length;
    });

    req.log.info({ userId, provider: cfg.id, removed }, "Disconnected connector");

    const connectors = await buildAllStatuses(userId);
    res.json(
      GetConnectorsResponse.parse({
        generatedAt: new Date().toISOString(),
        isDemo: false,
        connectors,
      }),
    );
  },
);

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

/** Mark the Google connection errored, preserving any prior success history. */
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
