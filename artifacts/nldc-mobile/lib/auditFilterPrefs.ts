import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nldc.auditFilterPrefs";

export type SortOrder = "newest" | "topScore";
export type ScoreRange = "all" | "low" | "medium" | "high";

export interface AuditFilterPrefs {
  query: string;
  sort: SortOrder;
  range: ScoreRange;
}

const DEFAULT_PREFS: AuditFilterPrefs = {
  query: "",
  sort: "newest",
  range: "all",
};

export async function loadAuditFilterPrefs(): Promise<AuditFilterPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AuditFilterPrefs>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : DEFAULT_PREFS.query,
      sort:
        parsed.sort === "newest" || parsed.sort === "topScore"
          ? parsed.sort
          : DEFAULT_PREFS.sort,
      range:
        parsed.range === "all" ||
        parsed.range === "low" ||
        parsed.range === "medium" ||
        parsed.range === "high"
          ? parsed.range
          : DEFAULT_PREFS.range,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveAuditFilterPrefs(
  prefs: AuditFilterPrefs,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore, filter prefs are a nice-to-have
  }
}

export async function clearAuditFilterPrefs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
