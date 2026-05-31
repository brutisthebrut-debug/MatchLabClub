import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  audits: "nldc.anon.auditIds",
  profiles: "nldc.anon.profileIds",
  messageSessions: "nldc.anon.messageSessionIds",
  insights: "nldc.anon.insightIds",
  journalEntries: "nldc.anon.journalEntryIds",
  postDateNotes: "nldc.anon.postDateNoteIds",
} as const;

export type AnonymousKind = keyof typeof KEYS;

async function safeRead(key: string): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => Number.isInteger(x) && x > 0);
  } catch {
    return [];
  }
}

async function safeWrite(key: string, ids: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage may be unavailable, swallow
  }
}

export async function rememberAnonymousId(
  kind: AnonymousKind,
  id: number,
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const key = KEYS[kind];
  const existing = await safeRead(key);
  if (existing.includes(id)) return;
  await safeWrite(key, [...existing, id]);
}

export async function readAnonymousIds(): Promise<{
  auditIds: number[];
  profileIds: number[];
  messageSessionIds: number[];
  insightIds: number[];
  journalEntryIds: number[];
  postDateNoteIds: number[];
}> {
  const [
    auditIds,
    profileIds,
    messageSessionIds,
    insightIds,
    journalEntryIds,
    postDateNoteIds,
  ] = await Promise.all([
    safeRead(KEYS.audits),
    safeRead(KEYS.profiles),
    safeRead(KEYS.messageSessions),
    safeRead(KEYS.insights),
    safeRead(KEYS.journalEntries),
    safeRead(KEYS.postDateNotes),
  ]);
  return {
    auditIds,
    profileIds,
    messageSessionIds,
    insightIds,
    journalEntryIds,
    postDateNoteIds,
  };
}

export async function clearAnonymousIds(): Promise<void> {
  await Promise.all(
    Object.values(KEYS).map(async (key) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // ignore
      }
    }),
  );
}

export async function hasAnyAnonymousIds(): Promise<boolean> {
  const ids = await readAnonymousIds();
  return (
    ids.auditIds.length > 0 ||
    ids.profileIds.length > 0 ||
    ids.messageSessionIds.length > 0 ||
    ids.insightIds.length > 0 ||
    ids.journalEntryIds.length > 0 ||
    ids.postDateNoteIds.length > 0
  );
}
