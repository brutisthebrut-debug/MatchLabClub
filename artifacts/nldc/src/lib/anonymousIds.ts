const KEYS = {
  audits: "nldc:anon:auditIds",
  profiles: "nldc:anon:profileIds",
  messageSessions: "nldc:anon:messageSessionIds",
  insights: "nldc:anon:insightIds",
} as const;

export type AnonymousKind = keyof typeof KEYS;

function safeRead(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => Number.isInteger(x) && x > 0);
  } catch {
    return [];
  }
}

function safeWrite(key: string, ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage may be unavailable (private mode, etc.) — swallow.
  }
}

export function rememberAnonymousId(kind: AnonymousKind, id: number): void {
  if (!Number.isInteger(id) || id <= 0) return;
  const key = KEYS[kind];
  const existing = safeRead(key);
  if (existing.includes(id)) return;
  safeWrite(key, [...existing, id]);
}

export function readAnonymousIds(): {
  auditIds: number[];
  profileIds: number[];
  messageSessionIds: number[];
  insightIds: number[];
} {
  return {
    auditIds: safeRead(KEYS.audits),
    profileIds: safeRead(KEYS.profiles),
    messageSessionIds: safeRead(KEYS.messageSessions),
    insightIds: safeRead(KEYS.insights),
  };
}

export function clearAnonymousIds(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(KEYS)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function hasAnyAnonymousIds(): boolean {
  const { auditIds, profileIds, messageSessionIds, insightIds } = readAnonymousIds();
  return (
    auditIds.length > 0 ||
    profileIds.length > 0 ||
    messageSessionIds.length > 0 ||
    insightIds.length > 0
  );
}
