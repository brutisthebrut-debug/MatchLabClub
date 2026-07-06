/**
 * Per-user consumer OAuth connectors (Strava, Fitbit, Exist).
 *
 * Unlike the Replit-managed Google connection (one account for the whole Repl),
 * these providers authorize each END USER individually, so the connect flow is
 * a standard authorization-code round-trip and we hold each user's tokens
 * ourselves (sealed via `tokenCrypto.ts`, stored in `oauth_tokens`).
 *
 * Everything here is REAL. There is no mock data path: when a provider's
 * client id / secret are not configured the connector reports `configured:
 * false` and the routes refuse to start a flow (503), so the feature ships
 * safely before credentials exist and lights up the moment they are set.
 *
 * Each provider reduces its API response to the shared import summary shape
 * (`{ counts: { items } }`) that the signal registry already understands, so a
 * connector feeds a readiness lane with zero bespoke counting logic. Only the
 * derived count is ever stored; raw activities/attributes are never persisted.
 */

export type TokenAuthStyle = "body" | "basic";

export interface ImportSummary {
  counts: { items: number };
}

export interface NormalizedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  providerUserId: string | null;
  scopes: string[] | null;
}

export interface OAuthProviderConfig {
  /** Provider key: matches oauth_tokens.provider and connector_connections.provider. */
  id: string;
  /** Readiness lane this connector feeds. */
  laneId: string;
  /** The imported_sources.source string derived signal is written to. */
  source: string;
  label: string;
  description: string;
  authUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
  clientIdEnv: string;
  secretEnv: string;
  /** How the token endpoint authenticates the client. Fitbit requires basic. */
  tokenAuth: TokenAuthStyle;
  consentVersion: string;
  /** How the provider delimits scopes in the authorize URL (Strava uses ","). */
  scopeSeparator: string;
  /** The consent contract surfaced to the user before they connect. */
  trust: {
    origin: string;
    seen: string[];
    neverTouched: string[];
  };
  /** Fetch the provider API and reduce it to the shared import summary. */
  fetchAndReduce: (accessToken: string) => Promise<ImportSummary>;
}

export class OAuthConnectorError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "OAuthConnectorError";
    this.code = code;
    this.status = status;
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function fetchJson(
  url: string,
  accessToken: string,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new OAuthConnectorError("provider_unreachable", "Provider unreachable");
  }
  if (res.status === 401) {
    throw new OAuthConnectorError("unauthorized", "Access token rejected", 401);
  }
  if (!res.ok) {
    throw new OAuthConnectorError(
      "provider_error",
      `Provider returned ${res.status}`,
    );
  }
  try {
    return await res.json();
  } catch {
    throw new OAuthConnectorError("bad_response", "Unreadable provider response");
  }
}

export const OAUTH_PROVIDERS: readonly OAuthProviderConfig[] = [
  {
    id: "strava",
    laneId: "vitality",
    source: "strava",
    label: "Strava",
    description:
      "Reads your activity cadence read-only: how often you move over the last month, never routes, maps, or GPS.",
    authUrl: "https://www.strava.com/oauth/authorize",
    tokenUrl: "https://www.strava.com/oauth/token",
    scopes: ["activity:read"],
    clientIdEnv: "STRAVA_CLIENT_ID",
    secretEnv: "STRAVA_CLIENT_SECRET",
    tokenAuth: "body",
    consentVersion: "strava-v1",
    scopeSeparator: ",",
    trust: {
      origin: "The Strava account you connect yourself.",
      seen: [
        "How many activities you logged in the last month",
        "That you connected Strava, used to fill the vitality lane",
      ],
      neverTouched: [
        "Any route, map, GPS track, or location",
        "Your Strava social feed, kudos, or comments",
      ],
    },
    async fetchAndReduce(accessToken) {
      const after = Math.floor((Date.now() - THIRTY_DAYS_MS) / 1000);
      const data = await fetchJson(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
        accessToken,
      );
      const items = Array.isArray(data) ? data.length : 0;
      return { counts: { items } };
    },
  },
  {
    id: "fitbit",
    laneId: "vitality",
    source: "fitbit",
    label: "Fitbit",
    description:
      "Reads your activity cadence read-only: how many workouts you logged in the last month, never heart rate, sleep detail, or weight.",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scopes: ["activity"],
    clientIdEnv: "FITBIT_CLIENT_ID",
    secretEnv: "FITBIT_CLIENT_SECRET",
    tokenAuth: "basic",
    consentVersion: "fitbit-v1",
    scopeSeparator: " ",
    trust: {
      origin: "The Fitbit account you connect yourself.",
      seen: [
        "How many workouts you logged in the last month",
        "That you connected Fitbit, used to fill the vitality lane",
      ],
      neverTouched: [
        "Heart rate, sleep stages, weight, or body metrics",
        "Any raw health record beyond the workout count",
      ],
    },
    async fetchAndReduce(accessToken) {
      const afterDate = new Date(Date.now() - THIRTY_DAYS_MS)
        .toISOString()
        .slice(0, 10);
      const data = (await fetchJson(
        `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${afterDate}&sort=asc&limit=100&offset=0`,
        accessToken,
      )) as { activities?: unknown[] };
      const items = Array.isArray(data.activities) ? data.activities.length : 0;
      return { counts: { items } };
    },
  },
  {
    id: "exist",
    laneId: "exist",
    source: "exist",
    label: "Exist",
    description:
      "Reads how much of your life you actively track in Exist, never the underlying mood, sleep, or productivity values themselves.",
    authUrl: "https://exist.io/oauth2/authorize",
    tokenUrl: "https://exist.io/oauth2/access_token",
    scopes: ["activity_read", "productivity_read", "mood_read"],
    clientIdEnv: "EXIST_CLIENT_ID",
    secretEnv: "EXIST_CLIENT_SECRET",
    tokenAuth: "body",
    consentVersion: "exist-v1",
    scopeSeparator: "+",
    trust: {
      origin: "The Exist account you connect yourself.",
      seen: [
        "How many life attributes you actively track",
        "That you connected Exist, used to fill the life-log lane",
      ],
      neverTouched: [
        "The actual mood, sleep, productivity, or activity values",
        "Any correlation, insight, or note stored in Exist",
      ],
    },
    async fetchAndReduce(accessToken) {
      const data = (await fetchJson(
        "https://exist.io/api/2/attributes/?limit=100",
        accessToken,
      )) as { results?: unknown[] };
      const items = Array.isArray(data.results) ? data.results.length : 0;
      return { counts: { items } };
    },
  },
];

export function getProviderConfig(
  id: string,
): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}

/** True when both the client id and secret env vars are present. */
export function providerConfigured(cfg: OAuthProviderConfig): boolean {
  return Boolean(
    process.env[cfg.clientIdEnv]?.trim() && process.env[cfg.secretEnv]?.trim(),
  );
}

/** Build the provider authorize URL the user is redirected to. */
export function buildAuthorizeUrl(
  cfg: OAuthProviderConfig,
  state: string,
  redirectUri: string,
): string {
  const clientId = process.env[cfg.clientIdEnv]?.trim() ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: cfg.scopes.join(cfg.scopeSeparator),
    state,
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

function normalizeTokenResponse(json: Record<string, unknown>): NormalizedTokens {
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) {
    throw new OAuthConnectorError("no_access_token", "No access token returned");
  }
  const refreshToken =
    typeof json.refresh_token === "string" ? json.refresh_token : null;
  let expiresAt: Date | null = null;
  if (typeof json.expires_at === "number") {
    expiresAt = new Date(json.expires_at * 1000);
  } else if (typeof json.expires_in === "number") {
    expiresAt = new Date(Date.now() + json.expires_in * 1000);
  }
  let providerUserId: string | null = null;
  if (typeof json.user_id === "string") providerUserId = json.user_id;
  else if (
    json.athlete &&
    typeof json.athlete === "object" &&
    "id" in (json.athlete as Record<string, unknown>)
  ) {
    providerUserId = String((json.athlete as Record<string, unknown>).id);
  }
  const scopes =
    typeof json.scope === "string"
      ? json.scope.split(/[,\s+]+/).filter(Boolean)
      : null;
  return { accessToken, refreshToken, expiresAt, providerUserId, scopes };
}

async function tokenRequest(
  cfg: OAuthProviderConfig,
  params: Record<string, string>,
): Promise<NormalizedTokens> {
  const clientId = process.env[cfg.clientIdEnv]?.trim();
  const secret = process.env[cfg.secretEnv]?.trim();
  if (!clientId || !secret) {
    throw new OAuthConnectorError(
      "not_configured",
      `${cfg.label} is not configured`,
      503,
    );
  }
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (cfg.tokenAuth === "basic") {
    headers.Authorization =
      "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64");
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", secret);
  }
  let res: Response;
  try {
    res = await fetch(cfg.tokenUrl, { method: "POST", headers, body });
  } catch {
    throw new OAuthConnectorError("provider_unreachable", "Provider unreachable");
  }
  if (!res.ok) {
    throw new OAuthConnectorError(
      "token_exchange_failed",
      `Token exchange returned ${res.status}`,
    );
  }
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new OAuthConnectorError("bad_response", "Unreadable token response");
  }
  return normalizeTokenResponse(json);
}

/** Exchange an authorization code for tokens. */
export function exchangeCodeForTokens(
  cfg: OAuthProviderConfig,
  code: string,
  redirectUri: string,
): Promise<NormalizedTokens> {
  return tokenRequest(cfg, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

/** Exchange a refresh token for a fresh access token. */
export function refreshAccessToken(
  cfg: OAuthProviderConfig,
  refreshToken: string,
): Promise<NormalizedTokens> {
  return tokenRequest(cfg, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
