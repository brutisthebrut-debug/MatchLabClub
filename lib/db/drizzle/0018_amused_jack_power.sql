-- Remove any pre-existing duplicate internal proposals before enforcing
-- uniqueness, so the index below can be created on DBs that accrued duplicates
-- while the discover engine was not yet race-safe. Keep the newest row per
-- ordered (user_id, proposed_to_user_id) pair (created_at desc, then id desc as
-- a deterministic tiebreaker); delete the rest. Only touches source='internal'.
DELETE FROM "match_proposals"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "user_id", "proposed_to_user_id"
        ORDER BY "created_at" DESC, "id" DESC
      ) AS rn
    FROM "match_proposals"
    WHERE "source" = 'internal'
  ) ranked
  WHERE ranked.rn > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "match_proposals_internal_pair_uidx" ON "match_proposals" USING btree ("user_id","proposed_to_user_id") WHERE "match_proposals"."source" = 'internal';
