const STORAGE_KEY = "nldc:pending-audit-deletes";

export type PendingAuditDelete = {
  id: number;
  scheduledAt: number;
};

function safeRead(): PendingAuditDelete[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingAuditDelete =>
        e != null &&
        typeof e === "object" &&
        typeof (e as PendingAuditDelete).id === "number" &&
        typeof (e as PendingAuditDelete).scheduledAt === "number",
    );
  } catch {
    return [];
  }
}

function safeWrite(entries: PendingAuditDelete[]): void {
  if (typeof window === "undefined") return;
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // ignore quota / private-mode errors
  }
}

export function recordPendingAuditDelete(id: number): void {
  const entries = safeRead().filter((e) => e.id !== id);
  entries.push({ id, scheduledAt: Date.now() });
  safeWrite(entries);
}

export function clearPendingAuditDelete(id: number): void {
  const entries = safeRead().filter((e) => e.id !== id);
  safeWrite(entries);
}

export function drainPendingAuditDeletes(): number[] {
  const entries = safeRead();
  safeWrite([]);
  return entries.map((e) => e.id);
}
