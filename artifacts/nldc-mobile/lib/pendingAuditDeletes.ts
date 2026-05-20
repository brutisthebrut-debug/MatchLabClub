import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nldc:pending-audit-deletes";

export type PendingAuditDelete = {
  id: number;
  scheduledAt: number;
};

async function safeRead(): Promise<PendingAuditDelete[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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

async function safeWrite(entries: PendingAuditDelete[]): Promise<void> {
  try {
    if (entries.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // ignore storage errors
  }
}

export async function recordPendingAuditDelete(id: number): Promise<void> {
  const entries = (await safeRead()).filter((e) => e.id !== id);
  entries.push({ id, scheduledAt: Date.now() });
  await safeWrite(entries);
}

export async function clearPendingAuditDelete(id: number): Promise<void> {
  const entries = (await safeRead()).filter((e) => e.id !== id);
  await safeWrite(entries);
}

export async function drainPendingAuditDeletes(): Promise<number[]> {
  const entries = await safeRead();
  await safeWrite([]);
  return entries.map((e) => e.id);
}
