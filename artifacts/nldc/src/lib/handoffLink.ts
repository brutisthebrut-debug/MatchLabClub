import { readAnonymousIds } from "./anonymousIds";

const SESSION_KEY = "nldc:pendingHandoff";
const QUERY_PARAM = "nldc_handoff";

export interface PendingHandoff {
  handoff: string;
  auditIds: number[];
  profileIds: number[];
  messageSessionIds: number[];
  insightIds: number[];
  followUpIds: number[];
}

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return decodeURIComponent(
    escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)),
  );
}

function sanitizeIds(xs: unknown): number[] {
  if (!Array.isArray(xs)) return [];
  return xs.filter((x): x is number => Number.isInteger(x) && (x as number) > 0);
}

export function encodePendingHandoffParam(payload: PendingHandoff): string {
  return b64urlEncode(JSON.stringify(payload));
}

export function decodePendingHandoffParam(raw: string): PendingHandoff | null {
  try {
    const parsed = JSON.parse(b64urlDecode(raw)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.handoff !== "string" || p.handoff.length === 0) return null;
    return {
      handoff: p.handoff,
      auditIds: sanitizeIds(p.auditIds),
      profileIds: sanitizeIds(p.profileIds),
      messageSessionIds: sanitizeIds(p.messageSessionIds),
      insightIds: sanitizeIds(p.insightIds),
      followUpIds: sanitizeIds(p.followUpIds),
    };
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL that carries a signed handoff token plus the
 * anonymous-row IDs the originating browser has in localStorage. The
 * receiving browser only needs this URL to claim the same rows after login.
 */
export function buildHandoffShareUrl(handoff: string): string {
  const ids = readAnonymousIds();
  const payload: PendingHandoff = { handoff, ...ids };
  const param = encodePendingHandoffParam(payload);
  if (typeof window === "undefined") {
    return `?${QUERY_PARAM}=${param}`;
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.pathname = "/";
  url.searchParams.set(QUERY_PARAM, param);
  return url.toString();
}

/**
 * If a handoff param is present in the current URL, parse it, stash it in
 * sessionStorage so it survives the OIDC login round-trip, and strip the
 * param from the address bar so it isn't accidentally re-shared.
 */
export function capturePendingHandoffFromUrl(): PendingHandoff | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get(QUERY_PARAM);
  if (!raw) return null;
  const payload = decodePendingHandoffParam(raw);
  url.searchParams.delete(QUERY_PARAM);
  try {
    window.history.replaceState(
      null,
      "",
      url.pathname + (url.search ? url.search : "") + url.hash,
    );
  } catch {
    // ignore replaceState failures
  }
  if (!payload) return null;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable
  }
  return payload;
}

export function readPendingHandoff(): PendingHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.handoff !== "string" || p.handoff.length === 0) return null;
    return {
      handoff: p.handoff,
      auditIds: sanitizeIds(p.auditIds),
      profileIds: sanitizeIds(p.profileIds),
      messageSessionIds: sanitizeIds(p.messageSessionIds),
      insightIds: sanitizeIds(p.insightIds),
      followUpIds: sanitizeIds(p.followUpIds),
    };
  } catch {
    return null;
  }
}

export function clearPendingHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
