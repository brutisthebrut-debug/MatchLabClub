import { useAuth } from "@workspace/replit-auth-web";
import {
  useListAudits,
  useListMessageCoachingSessions,
  getListAuditsQueryKey,
  getListMessageCoachingSessionsQueryKey,
} from "@workspace/api-client-react";
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

export interface LatestAuditSummary {
  id: number;
  createdAt: string;
  readinessScore: number | null | undefined;
  firstName?: string | null;
}

export interface LatestMessageSessionSummary {
  id: number;
  createdAt: string;
}

export interface SavedContext {
  hasSavedContext: boolean;
  summary: string;
  blueprintResult: BlueprintSaved | null;
  goals: string[];
  progressEntries: Array<{ date?: string; tag?: string; note?: string }>;
  latestAudit: LatestAuditSummary | null;
  latestMessageSession: LatestMessageSessionSummary | null;
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

/**
 * Aggregates the user's saved context across local-storage (blueprint,
 * goals, progress entries) AND server-side data (latest audit, latest
 * message session). `hasSavedContext` is strictly gated on actual
 * context presence, so consumers can drive "Using your saved profile"
 * chips and empty-state pointers from real data.
 */
export function useSavedContext(): SavedContext {
  const { isAuthenticated } = useAuth();

  const { data: audits } = useListAudits(
    { limit: 1 },
    {
      query: {
        enabled: isAuthenticated,
        queryKey: getListAuditsQueryKey({ limit: 1 }),
      },
    },
  );
  const { data: sessions } = useListMessageCoachingSessions({
    query: {
      enabled: isAuthenticated,
      queryKey: getListMessageCoachingSessionsQueryKey(),
    },
  });

  const blueprintResult = loadBlueprintResult();
  const goals = readSavedGoals();
  const progressEntries = readSavedProgressEntries();

  const firstAudit = audits && audits.length > 0 ? audits[0] : null;
  const latestAudit: LatestAuditSummary | null = firstAudit
    ? {
        id: firstAudit.id,
        createdAt: firstAudit.createdAt,
        readinessScore: firstAudit.readinessScore,
        firstName: firstAudit.firstName ?? null,
      }
    : null;

  // API returns sessions ascending by createdAt, so pick the max explicitly.
  let pickedSession: { id: number; createdAt: string } | null = null;
  if (sessions && sessions.length > 0) {
    let bestT = -Infinity;
    for (const s of sessions) {
      const t = Date.parse(s.createdAt);
      if (!Number.isNaN(t) && t > bestT) {
        bestT = t;
        pickedSession = { id: s.id, createdAt: s.createdAt };
      }
    }
    if (pickedSession === null) {
      // All timestamps unparseable, fall back to the last entry in array.
      const last = sessions[sessions.length - 1];
      pickedSession = { id: last.id, createdAt: last.createdAt };
    }
  }
  const latestMessageSession: LatestMessageSessionSummary | null = pickedSession;

  const hasSavedContext =
    blueprintResult !== null ||
    goals.length > 0 ||
    progressEntries.length > 0 ||
    latestAudit !== null ||
    latestMessageSession !== null;

  const parts: string[] = [];
  if (latestAudit) parts.push("Latest audit");
  if (blueprintResult) parts.push("Blueprint");
  if (goals.length > 0) parts.push(`${goals.length} goal${goals.length > 1 ? "s" : ""}`);
  if (latestMessageSession) parts.push("Coached session");
  if (progressEntries.length > 0) {
    parts.push(`${progressEntries.length} progress entr${progressEntries.length > 1 ? "ies" : "y"}`);
  }

  return {
    hasSavedContext,
    summary: parts.join(" · "),
    blueprintResult,
    goals,
    progressEntries,
    latestAudit,
    latestMessageSession,
  };
}
