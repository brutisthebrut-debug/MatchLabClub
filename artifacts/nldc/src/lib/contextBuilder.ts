/**
 * Shared context builder for AI-powered tools.
 *
 * Combines whatever the user has done in the app — form values, saved results,
 * selected goals, progress entries, and the current tool's name — into a
 * single, clean object that the server-side AI helper can consume.
 *
 * Pure function. No side effects. Safe to call from any page.
 */

export interface ProgressEntryLike {
  date?: string;
  tag?: string;
  note?: string;
  status?: string;
}

export interface BuildContextInput {
  toolName: string;
  formValues?: Record<string, unknown>;
  savedResults?: Record<string, unknown>;
  goals?: string[];
  progressEntries?: ProgressEntryLike[];
  extras?: Record<string, unknown>;
}

export interface BuiltAiContext {
  toolName: string;
  formValues: Record<string, unknown>;
  savedResults: Record<string, unknown>;
  goals: string[];
  progressEntries: Array<{ date?: string; tag?: string; note?: string }>;
  extras: Record<string, unknown>;
}

function pruneEmpty<T extends Record<string, unknown>>(obj: T | undefined): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function normalizeEntries(entries?: ProgressEntryLike[]) {
  if (!entries || entries.length === 0) return [];
  return entries
    .filter((e) => (e.note ?? "").trim().length > 0)
    .slice(0, 12)
    .map((e) => ({
      ...(e.date ? { date: e.date } : {}),
      ...(e.tag ? { tag: e.tag } : {}),
      note: (e.note ?? "").slice(0, 400),
    }));
}

export function buildAiContext(input: BuildContextInput): BuiltAiContext {
  return {
    toolName: input.toolName,
    formValues: pruneEmpty(input.formValues),
    savedResults: pruneEmpty(input.savedResults),
    goals: (input.goals ?? []).filter((g) => g.trim().length > 0),
    progressEntries: normalizeEntries(input.progressEntries),
    extras: pruneEmpty(input.extras),
  };
}

/**
 * Read progress entries that may be cached in localStorage from the
 * ProgressTimeline page. Safe to call from any tool — returns [] if missing
 * or malformed.
 */
export function readSavedProgressEntries(): ProgressEntryLike[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("nldc:progress:entries");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProgressEntryLike[];
  } catch {
    return [];
  }
}

/**
 * Read saved tool results (e.g. last audit summary) from localStorage.
 */
export function readSavedResults(toolName: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`nldc:results:${toolName}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readSavedGoals(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("nldc:goals");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((g): g is string => typeof g === "string");
    return [];
  } catch {
    return [];
  }
}
