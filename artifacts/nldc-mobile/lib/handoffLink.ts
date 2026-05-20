import { readAnonymousIds } from "./anonymousIds";

const QUERY_PARAM = "nldc_handoff";

interface PendingHandoff {
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

function getWebBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export async function buildMobileHandoffShareUrl(handoff: string): Promise<string> {
  const ids = await readAnonymousIds();
  const payload: PendingHandoff = {
    handoff,
    auditIds: ids.auditIds,
    profileIds: ids.profileIds,
    messageSessionIds: ids.messageSessionIds,
    insightIds: ids.insightIds,
    followUpIds: [],
  };
  const param = b64urlEncode(JSON.stringify(payload));
  const base = getWebBaseUrl();
  return `${base}/?${QUERY_PARAM}=${param}`;
}
