import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";

type Executor = Pick<typeof db, "execute">;

export type MemberDataDisposition = {
  table: string;
  owner:
    | { kind: "columns"; columns: readonly string[] }
    | { kind: "email"; column: string }
    | { kind: "audit-child" }
    | { kind: "connection-child" }
    | { kind: "session-json" };
  export: "current-contract" | "sanitized" | "omit-security-secret";
  omitColumns?: readonly string[];
  retention: "account-lifetime" | "short-lived-security";
  consent: "member-record" | "ai-derived";
};

const direct = (
  table: string,
  columns: readonly string[] = ["user_id"],
  options: Partial<Omit<MemberDataDisposition, "table" | "owner">> = {},
): MemberDataDisposition => ({
  table,
  owner: { kind: "columns", columns },
  export: "current-contract",
  retention: "account-lifetime",
  consent: "member-record",
  ...options,
});

/**
 * First-party member-data safety registry for current main.
 *
 * The existing typed account export remains authoritative for response shape.
 * This registry is the deletion and consent-revocation safety net, and its
 * drift test rejects a new directly user-linked table until its disposition
 * is declared here.
 */
export const MEMBER_DATA_REGISTRY: readonly MemberDataDisposition[] = [
  { table: "audit_report_versions", owner: { kind: "audit-child" }, export: "current-contract", retention: "account-lifetime", consent: "ai-derived" },
  { table: "connection_messages", owner: { kind: "connection-child" }, export: "current-contract", retention: "account-lifetime", consent: "member-record" },
  direct("oauth_tokens", ["user_id"], { export: "omit-security-secret", retention: "short-lived-security" }),
  { table: "sessions", owner: { kind: "session-json" }, export: "sanitized", omitColumns: ["sess"], retention: "short-lived-security", consent: "member-record" },
  direct("data_export_tokens", ["user_id"], { export: "omit-security-secret", retention: "short-lived-security" }),
  direct("push_tokens", ["user_id"], { export: "sanitized", omitColumns: ["token"], retention: "short-lived-security" }),
  direct("login_notifications", ["user_id"], { export: "sanitized", omitColumns: ["fingerprint"], retention: "short-lived-security" }),
  direct("audits"),
  direct("dating_profiles"),
  direct("message_coaching_sessions", ["user_id"], { consent: "ai-derived" }),
  direct("coach_follow_ups"),
  direct("email_insights", ["user_id"], { consent: "ai-derived" }),
  direct("waitlist"),
  direct("life_pulses"),
  direct("journal_entries"),
  direct("post_date_notes"),
  direct("wellness_answers"),
  direct("wellness_inferences", ["user_id"], { consent: "ai-derived" }),
  direct("wellness_tags"),
  direct("compatibility_reads", ["user_id"], { consent: "ai-derived" }),
  direct("care_dialect_profiles"),
  direct("imported_sources"),
  direct("connector_connections"),
  direct("referrals", ["inviter_user_id", "invitee_user_id"]),
  direct("ai_usage_counters"),
  direct("match_preferences"),
  direct("match_pool_membership"),
  direct("match_proposals", ["user_id", "proposed_to_user_id"]),
  direct("match_connections", ["user_low_id", "user_high_id"]),
  direct("profile_photos"),
  direct("photo_lab_runs"),
  direct("dating_wins"),
  direct("behavioral_growth_events"),
  direct("journey_experiments"),
  direct("journey_follow_ups"),
  direct("mirror_learnings"),
  direct("mirror_learning_events"),
  direct("communication_records"),
  direct("wyr_answers"),
  direct("daily_spark_answers"),
  direct("flag_selections"),
  direct("scenario_responses"),
  direct("prediction_responses"),
  direct("time_capsules"),
  direct("wingman_answers"),
  direct("wingman_self_ratings"),
  direct("wingman_invites"),
  direct("cosmic_charts"),
  direct("user_verifications", ["user_id"], { export: "sanitized", omitColumns: ["stripe_verification_session_id"] }),
  direct("user_reports", ["reporter_user_id", "reported_user_id"]),
  direct("user_blocks", ["blocker_user_id", "blocked_user_id"]),
  direct("matching_readiness_snapshots"),
  direct("matching_nudge_state"),
  direct("mirror_digest_prefs"),
  direct("journey_events"),
  direct("companion_state", ["user_id"], { consent: "ai-derived" }),
  direct("companion_messages", ["user_id"], { consent: "ai-derived" }),
  direct("companion_observations", ["user_id"], { consent: "ai-derived" }),
  direct("companion_commitments"),
  direct("companion_notifications", ["user_id"], { consent: "ai-derived" }),
  direct("companion_channel_prefs"),
  direct("billing_entitlements"),
  { table: "purchase_interest", owner: { kind: "email", column: "email" }, export: "sanitized", omitColumns: ["stripe_session_id"], retention: "account-lifetime", consent: "member-record" },
] as const;

export const MEMBER_DATA_TABLE_NAMES = MEMBER_DATA_REGISTRY.map(
  (entry) => entry.table,
);

function identifier(name: string) {
  return sql.identifier(name);
}

function ownershipWhere(
  entry: MemberDataDisposition,
  userId: string,
  email: string | null,
): SQL | null {
  if (entry.owner.kind === "columns") {
    return sql.join(
      entry.owner.columns.map((column) => sql`${identifier(column)} = ${userId}`),
      sql` OR `,
    );
  }
  if (entry.owner.kind === "email") {
    if (!email) return null;
    return sql`lower(${identifier(entry.owner.column)}) = ${email.trim().toLowerCase()}`;
  }
  if (entry.owner.kind === "session-json") {
    return sql`(${identifier("sess")} -> \'user\' ->> \'id\') = ${userId}`;
  }
  if (entry.owner.kind === "audit-child") {
    return sql`${identifier("audit_id")} IN (
      SELECT ${identifier("id")} FROM ${identifier("audits")}
      WHERE ${identifier("user_id")} = ${userId}
    )`;
  }
  return sql`${identifier("connection_id")} IN (
    SELECT ${identifier("id")} FROM ${identifier("match_connections")}
    WHERE ${identifier("user_low_id")} = ${userId}
       OR ${identifier("user_high_id")} = ${userId}
  )`;
}

function resultRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * Final hard-delete safety net. Existing typed per-feature deletes may run
 * first for stable receipt counts; this removes any registered row left over.
 */
export async function purgeRegisteredMemberData(
  executor: Executor,
  userId: string,
  email: string | null,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const entry of MEMBER_DATA_REGISTRY) {
    const where = ownershipWhere(entry, userId, email);
    if (!where) {
      counts[entry.table] = 0;
      continue;
    }
    const result = await executor.execute(
      sql`DELETE FROM ${identifier(entry.table)} WHERE ${where} RETURNING 1`,
    );
    counts[entry.table] = resultRows(result).length;
  }
  return counts;
}

/** Remove pending AI-derived records when account-level AI consent is revoked. */
export async function purgeRevokedAiDerivedData(
  executor: Executor,
  userId: string,
): Promise<void> {
  await executor.execute(sql`
    DELETE FROM ${identifier("wellness_inferences")}
    WHERE ${identifier("user_id")} = ${userId}
      AND ${identifier("status")} = 'pending'
  `);
  await executor.execute(sql`
    DELETE FROM ${identifier("companion_observations")}
    WHERE ${identifier("user_id")} = ${userId}
      AND ${identifier("dismissed_at")} IS NULL
  `);
}
