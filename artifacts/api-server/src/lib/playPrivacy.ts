import {
  db,
  careDialectProfilesTable,
  dailySparkAnswersTable,
  flagSelectionsTable,
  journeyEventsTable,
  predictionResponsesTable,
  scenarioResponsesTable,
  timeCapsulesTable,
  wyrAnswersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type DeleteExecutor = Pick<typeof db, "delete">;

export const PLAY_PRIVACY_TABLE_NAMES = [
  "wyr_answers",
  "daily_spark_answers",
  "flag_selections",
  "scenario_responses",
  "prediction_responses",
  "time_capsules",
  "care_dialect_profiles",
  "journey_events",
] as const;

export type PlayPrivacyTableName = (typeof PLAY_PRIVACY_TABLE_NAMES)[number];

/**
 * Hard-delete the direct first-party records created by Play and the derived
 * Journey instrumentation that describes those saves. Quiz Lab and This or
 * That live in imported_sources and are purged by the owning account workflow.
 *
 * Both account-deletion endpoints call this one registry so a selected Play
 * table cannot silently disappear from one path. Counts are returned for the
 * confirmed GDPR receipt; no raw activity content is logged.
 */
export async function purgePlayData(
  executor: DeleteExecutor,
  userId: string,
): Promise<Record<PlayPrivacyTableName, number>> {
  const [
    wyr,
    dailySpark,
    flags,
    scenarios,
    predictions,
    timeCapsules,
    careDialect,
    journeyEvents,
  ] = await Promise.all([
    executor
      .delete(wyrAnswersTable)
      .where(eq(wyrAnswersTable.userId, userId))
      .returning({ id: wyrAnswersTable.id }),
    executor
      .delete(dailySparkAnswersTable)
      .where(eq(dailySparkAnswersTable.userId, userId))
      .returning({ id: dailySparkAnswersTable.id }),
    executor
      .delete(flagSelectionsTable)
      .where(eq(flagSelectionsTable.userId, userId))
      .returning({ id: flagSelectionsTable.id }),
    executor
      .delete(scenarioResponsesTable)
      .where(eq(scenarioResponsesTable.userId, userId))
      .returning({ id: scenarioResponsesTable.id }),
    executor
      .delete(predictionResponsesTable)
      .where(eq(predictionResponsesTable.userId, userId))
      .returning({ id: predictionResponsesTable.id }),
    executor
      .delete(timeCapsulesTable)
      .where(eq(timeCapsulesTable.userId, userId))
      .returning({ id: timeCapsulesTable.id }),
    executor
      .delete(careDialectProfilesTable)
      .where(eq(careDialectProfilesTable.userId, userId))
      .returning({ id: careDialectProfilesTable.id }),
    executor
      .delete(journeyEventsTable)
      .where(eq(journeyEventsTable.userId, userId))
      .returning({ id: journeyEventsTable.id }),
  ]);

  return {
    wyr_answers: wyr.length,
    daily_spark_answers: dailySpark.length,
    flag_selections: flags.length,
    scenario_responses: scenarios.length,
    prediction_responses: predictions.length,
    time_capsules: timeCapsules.length,
    care_dialect_profiles: careDialect.length,
    journey_events: journeyEvents.length,
  };
}
