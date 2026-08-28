export type DurableJourneyKind = "insight" | "compatibility" | "introduction";

export interface DurableJourneyMoment {
  id: string;
  kind: DurableJourneyKind;
  sourceType: "insight_record" | "compatibility_read" | "match_connection";
  sourceId: number | string;
  sourceLabel: string;
  title: string;
  body: string;
  occurredAt: string;
  href: string;
}

interface DurableHistoryRecords {
  insights?: Array<{
    id: number;
    sourceLabel: string;
    status: string;
    createdAt: Date | string;
  }>;
  compatibilityReads?: Array<{
    id: number;
    parsedProfile?: Record<string, unknown> | null;
    createdAt: Date | string;
  }>;
  connections?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
  }>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function connectionStyle(profile: Record<string, unknown> | null | undefined): string | null {
  const value = profile?.["connectionStyle"];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

/**
 * Projects already-owner-scoped durable rows into Journey without copying raw
 * pasted conversations, candidate profile text, numeric alignment, or member PII.
 */
export function durableJourneyMoments({
  insights = [],
  compatibilityReads = [],
  connections = [],
}: DurableHistoryRecords): DurableJourneyMoment[] {
  return [
    ...insights.map((insight) => ({
      id: `insight:${insight.id}`,
      kind: "insight" as const,
      sourceType: "insight_record" as const,
      sourceId: insight.id,
      sourceLabel: "Insight",
      title: insight.sourceLabel.trim() || "Communication insight",
      body: insight.status === "complete"
        ? "A saved communication pattern is ready to revisit."
        : "A communication source was saved and is still being processed.",
      occurredAt: iso(insight.createdAt),
      href: "/insights",
    })),
    ...compatibilityReads.map((read) => {
      const style = connectionStyle(read.parsedProfile);
      return {
        id: `compatibility:${read.id}`,
        kind: "compatibility" as const,
        sourceType: "compatibility_read" as const,
        sourceId: read.id,
        sourceLabel: "Compatibility read",
        title: style ? `Compatibility read: ${style}` : "Compatibility read saved",
        body: "A private candidate-profile interpretation was saved without adding a compatibility score to your Journey.",
        occurredAt: iso(read.createdAt),
        href: "/compatibility-compass",
      };
    }),
    ...connections.map((connection) => ({
      id: `introduction:${connection.id}`,
      kind: "introduction" as const,
      sourceType: "match_connection" as const,
      sourceId: connection.id,
      sourceLabel: "Introduction",
      title: connection.status === "closed" ? "Introduction closed" : "Mutual introduction opened",
      body: connection.status === "closed"
        ? "This introduction remains part of your private history without reopening the conversation."
        : "Both people chose to open a real conversation.",
      occurredAt: iso(connection.createdAt),
      href: `/matches/${connection.id}`,
    })),
  ];
}
