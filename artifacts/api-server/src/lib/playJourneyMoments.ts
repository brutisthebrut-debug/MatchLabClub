export interface PlayJourneyMoment {
  id: string;
  sourceId: string;
  title: string;
  body: string;
  occurredAt: string;
  href: string;
}

interface PlayRecords {
  dailySpark?: Array<{ questionId: string; createdAt: Date | string }>;
  wouldYouRather?: Array<{ promptId: string; createdAt: Date | string }>;
  scenarios?: Array<{ scenarioId: string; createdAt: Date | string }>;
  timeCapsules?: Array<{ id: number; createdAt: Date | string }>;
  imports?: Array<{
    id: number;
    source: string;
    status: string;
    parsedSummary?: Record<string, unknown> | null;
    uploadedAt: Date | string;
  }>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function quizTitle(summary: Record<string, unknown> | null | undefined): string {
  const archetype = summary?.["archetype"];
  return typeof archetype === "string" && archetype.trim()
    ? `Quiz result: ${archetype.trim()}`
    : "Quiz result saved";
}

export function playJourneyMoments({
  dailySpark = [],
  wouldYouRather = [],
  scenarios = [],
  timeCapsules = [],
  imports = [],
}: PlayRecords): PlayJourneyMoment[] {
  const imported = imports.flatMap((item): PlayJourneyMoment[] => {
    if (item.status !== "complete") return [];
    if (item.source === "quiz") {
      return [{
        id: `play:quiz:${item.id}`,
        sourceId: `quiz:${item.id}`,
        title: quizTitle(item.parsedSummary),
        body: "A bounded quiz read was saved to your MatchLab evidence.",
        occurredAt: iso(item.uploadedAt),
        href: "/play?section=quizzes",
      }];
    }
    if (item.source === "preferences-paste") {
      return [{
        id: `play:preferences:${item.id}`,
        sourceId: `preferences:${item.id}`,
        title: "This or That preferences saved",
        body: "Rapid preferences were added to your MatchLab picture.",
        occurredAt: iso(item.uploadedAt),
        href: "/play",
      }];
    }
    return [];
  });

  return [
    ...dailySpark.map((item) => ({
      id: `play:daily-spark:${item.questionId}`,
      sourceId: `daily-spark:${item.questionId}`,
      title: "Daily Spark answered",
      body: "A dated preference signal was added to your MatchLab picture.",
      occurredAt: iso(item.createdAt),
      href: "/play",
    })),
    ...wouldYouRather.map((item) => ({
      id: `play:would-you-rather:${item.promptId}`,
      sourceId: `would-you-rather:${item.promptId}`,
      title: "Would You Rather choice saved",
      body: "A forced tradeoff was added to your preference evidence.",
      occurredAt: iso(item.createdAt),
      href: "/play",
    })),
    ...scenarios.map((item) => ({
      id: `play:scenario:${item.scenarioId}`,
      sourceId: `scenario:${item.scenarioId}`,
      title: "Scenario response saved",
      body: "A communication choice was added to your profile evidence.",
      occurredAt: iso(item.createdAt),
      href: "/play",
    })),
    ...timeCapsules.map((item) => ({
      id: `play:time-capsule:${item.id}`,
      sourceId: `time-capsule:${item.id}`,
      title: "Time Capsule saved",
      body: "A future-facing reflection was saved for you to revisit.",
      occurredAt: iso(item.createdAt),
      href: "/play",
    })),
    ...imported,
  ];
}
