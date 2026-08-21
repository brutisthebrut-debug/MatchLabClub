export type PlayJourneyMoment = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  href: string;
};

type DailySparkRecord = {
  questionId: string;
  createdAt: string;
};

type WouldYouRatherRecord = {
  promptId: string;
  createdAt: string;
};

type ScenarioRecord = {
  scenarioId: string;
  createdAt: string;
};

type TimeCapsuleRecord = {
  id: number;
  createdAt: string;
};

type ImportRecord = {
  id: number;
  source: string;
  status: string;
  parsedSummary?: Record<string, unknown> | null;
  uploadedAt: string;
};

type PlayJourneyRecords = {
  dailySpark?: DailySparkRecord[];
  wouldYouRather?: WouldYouRatherRecord[];
  scenarios?: ScenarioRecord[];
  timeCapsules?: TimeCapsuleRecord[];
  imports?: ImportRecord[];
};

function quizTitle(summary: Record<string, unknown> | null | undefined): string {
  const archetype = summary?.archetype;
  return typeof archetype === "string" && archetype.trim().length > 0
    ? `Quiz Lab result: ${archetype.trim()}`
    : "Quiz Lab result saved";
}

export function playJourneyMomentsFromRecords({
  dailySpark = [],
  wouldYouRather = [],
  scenarios = [],
  timeCapsules = [],
  imports = [],
}: PlayJourneyRecords): PlayJourneyMoment[] {
  const importedPlay = imports.flatMap((item): PlayJourneyMoment[] => {
    if (item.status !== "complete") return [];
    if (item.source === "quiz") {
      return [
        {
          id: `play-quiz-${item.id}`,
          title: quizTitle(item.parsedSummary),
          detail:
            "A bounded quiz read was saved to the profile evidence you can review.",
          occurredAt: item.uploadedAt,
          href: "/quizzes",
        },
      ];
    }
    if (item.source === "preferences-paste") {
      return [
        {
          id: `play-preferences-${item.id}`,
          title: "This or That preferences saved",
          detail:
            "A set of rapid preferences was added to your MatchLab picture.",
          occurredAt: item.uploadedAt,
          href: "/this-or-that",
        },
      ];
    }
    return [];
  });

  return [
    ...dailySpark.map((item) => ({
      id: `play-daily-spark-${item.questionId}`,
      title: "Daily Spark answered",
      detail: "A dated preference signal was added to your MatchLab picture.",
      occurredAt: item.createdAt,
      href: "/games/daily-spark",
    })),
    ...wouldYouRather.map((item) => ({
      id: `play-wyr-${item.promptId}`,
      title: "Would You Rather choice saved",
      detail: "A forced tradeoff was added to your preference evidence.",
      occurredAt: item.createdAt,
      href: "/games/would-you-rather",
    })),
    ...scenarios.map((item) => ({
      id: `play-scenario-${item.scenarioId}`,
      title: "Scenario response saved",
      detail: "A communication choice was added to your profile evidence.",
      occurredAt: item.createdAt,
      href: "/games/scenarios",
    })),
    ...timeCapsules.map((item) => ({
      id: `play-time-capsule-${item.id}`,
      title: "Time Capsule saved",
      detail: "A future-facing reflection was saved for you to revisit.",
      occurredAt: item.createdAt,
      href: "/games/time-capsule",
    })),
    ...importedPlay,
  ];
}
