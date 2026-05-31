const STORAGE_KEY = "nldc.skippedStaleAuditIds";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface SkippedEntry {
  ids: number[];
  savedAt: number;
}

export function loadSkippedAuditIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const entry: SkippedEntry = JSON.parse(raw) as SkippedEntry;
    if (Date.now() - entry.savedAt > TTL_MS) return new Set();
    return new Set(entry.ids);
  } catch {
    return new Set();
  }
}

export function saveSkippedAuditIds(ids: Set<number>): void {
  if (typeof window === "undefined") return;
  try {
    if (ids.size === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      const entry: SkippedEntry = { ids: Array.from(ids), savedAt: Date.now() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    }
  } catch {
    // ignore, preference is a nice-to-have
  }
}

export function clearSkippedAuditIds(ids: number[]): void {
  if (ids.length === 0) return;
  const current = loadSkippedAuditIds();
  const changed = ids.some((id) => current.has(id));
  if (!changed) return;
  for (const id of ids) current.delete(id);
  saveSkippedAuditIds(current);
}
