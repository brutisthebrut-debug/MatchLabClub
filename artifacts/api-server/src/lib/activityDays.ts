// Activity days: the single source of truth for which first-party tables count
// as "showing up". This powers two things off one query:
//   1. the activity streak (a gamification lens, in streak.ts), and
//   2. the consistency readiness lane (distinct active days in a trailing window).
//
// Every new signal-feeding source or game MUST add its consent-cleared rows to
// the UNION below so approved activity counts toward both the streak and
// consistency. Keeping one list here means a new contributor never silently
// drops out of either or bypasses its matching permission boundary.
//
// We only ever read the calendar day a row was created on, never any of its
// content. The optional `sinceDay` (a YYYY-MM-DD string) trims the result to a
// trailing window; day strings sort lexically, so a text comparison is correct.

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function loadActivityDays(
  userId: string,
  sinceDay: string | null = null,
): Promise<string[]> {
  const result = await db.execute<{ day: string }>(sql`
    SELECT DISTINCT day FROM (
      SELECT to_char(created_at, 'YYYY-MM-DD') AS day FROM compatibility_reads WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM journal_entries WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM post_date_notes WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM wellness_answers WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM dating_wins WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM message_coaching_sessions WHERE user_id = ${userId}
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM life_pulses WHERE user_id = ${userId}
      UNION ALL SELECT to_char(uploaded_at, 'YYYY-MM-DD') FROM imported_sources WHERE user_id = ${userId} AND matching_use_allowed = true AND deleted_at IS NULL
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM audits WHERE user_id = ${userId} AND report_generated_at IS NOT NULL
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM wyr_answers WHERE user_id = ${userId} AND matching_use_allowed = true
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM scenario_responses WHERE user_id = ${userId} AND matching_use_allowed = true
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM prediction_responses WHERE user_id = ${userId} AND matching_use_allowed = true
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM time_capsules WHERE user_id = ${userId} AND matching_use_allowed = true
      UNION ALL SELECT to_char(created_at, 'YYYY-MM-DD') FROM wingman_invites WHERE user_id = ${userId}
    ) t
    WHERE ${sinceDay}::text IS NULL OR day >= ${sinceDay}
  `);
  return (result.rows ?? [])
    .map((r) => r.day)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
}
