import { readSavedGoals, readSavedProgressEntries } from "@/lib/contextBuilder";

export interface BlueprintSaved {
  firstImpression?: string;
  repeatingPattern?: string;
  communicationStyle?: string;
  attractionPattern?: string;
  comfortNeeds?: string;
  riskLoop?: string;
  growthEdge?: string;
}

export interface SavedContext {
  hasSavedContext: boolean;
  summary: string;
  blueprintResult: BlueprintSaved | null;
  goals: string[];
  progressEntries: Array<{ date?: string; tag?: string; note?: string }>;
}

function loadBlueprintResult(): BlueprintSaved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("nldc_blueprint_result");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as BlueprintSaved)
      : null;
  } catch {
    return null;
  }
}

export function useSavedContext(): SavedContext {
  const blueprintResult = loadBlueprintResult();
  const goals = readSavedGoals();
  const progressEntries = readSavedProgressEntries();

  const hasSavedContext = blueprintResult !== null || goals.length > 0;

  const parts: string[] = [];
  if (blueprintResult) parts.push("Blueprint");
  if (goals.length > 0) parts.push(`${goals.length} goal${goals.length > 1 ? "s" : ""}`);
  if (progressEntries.length > 0) parts.push(`${progressEntries.length} progress entr${progressEntries.length > 1 ? "ies" : "y"}`);

  return {
    hasSavedContext,
    summary: parts.join(" · "),
    blueprintResult,
    goals,
    progressEntries,
  };
}
