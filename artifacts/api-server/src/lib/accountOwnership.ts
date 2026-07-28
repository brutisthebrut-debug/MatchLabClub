/**
 * Canonical inventory for account ownership.
 *
 * Every schema table with a `user_id` column belongs here. Account deletion
 * iterates this list directly, and a schema-level test compares it with the
 * Drizzle schema so a new user-owned table cannot quietly escape erasure.
 */
export const ACCOUNT_DELETE_USER_ID_TABLES = [
  "ai_usage_counters",
  "audits",
  "behavioral_growth_events",
  "care_dialect_profiles",
  "coach_follow_ups",
  "companion_channel_prefs",
  "companion_commitments",
  "companion_messages",
  "companion_notifications",
  "companion_observations",
  "companion_state",
  "compatibility_reads",
  "connector_connections",
  "cosmic_charts",
  "daily_spark_answers",
  "data_export_tokens",
  "data_permission_events",
  "dating_profiles",
  "dating_wins",
  "email_insights",
  "flag_selections",
  "imported_sources",
  "journal_entries",
  "journey_events",
  "life_pulses",
  "login_notifications",
  "match_pool_membership",
  "match_preferences",
  "match_proposals",
  "matching_nudge_state",
  "matching_readiness_snapshots",
  "message_coaching_sessions",
  "mirror_digest_prefs",
  "oauth_tokens",
  "post_date_notes",
  "prediction_responses",
  "profile_photos",
  "push_tokens",
  "scenario_responses",
  "sessions",
  "time_capsules",
  "user_verifications",
  "waitlist",
  "wellness_answers",
  "wellness_inferences",
  "wellness_tags",
  "wingman_answers",
  "wingman_invites",
  "wingman_self_ratings",
  "wyr_answers",
] as const;

/**
 * These rows are deleted with the account but never exported because they
 * contain live credentials or device-delivery tokens.
 */
export const ACCOUNT_EXPORT_REDACTED_USER_ID_TABLES = [
  "data_export_tokens",
  "oauth_tokens",
  "push_tokens",
] as const;

/**
 * These tables need a safer or broader export query than `WHERE user_id = ?`.
 * Sessions omit the session id/payload, verification omits the provider
 * session id, and waitlist also includes an email-only pre-account row.
 */
export const ACCOUNT_EXPORT_SPECIAL_USER_ID_TABLES = [
  "match_proposals",
  "sessions",
  "user_verifications",
  "waitlist",
] as const;

const nonDirectExportTables = new Set<string>([
  ...ACCOUNT_EXPORT_REDACTED_USER_ID_TABLES,
  ...ACCOUNT_EXPORT_SPECIAL_USER_ID_TABLES,
]);

export const ACCOUNT_EXPORT_DIRECT_USER_ID_TABLES =
  ACCOUNT_DELETE_USER_ID_TABLES.filter(
    (tableName) => !nonDirectExportTables.has(tableName),
  );
