import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nldc.skippedStaleAuditIds";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface SkippedEntry {
  ids: number[];
  savedAt: number;
}

export async function loadSkippedAuditIds(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const entry: SkippedEntry = JSON.parse(raw) as SkippedEntry;
    if (Date.now() - entry.savedAt > TTL_MS) return new Set();
    return new Set(entry.ids);
  } catch {
    return new Set();
  }
}

export async function saveSkippedAuditIds(ids: Set<number>): Promise<void> {
  try {
    if (ids.size === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      const entry: SkippedEntry = { ids: Array.from(ids), savedAt: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    }
  } catch {
    // ignore — preference is a nice-to-have
  }
}
