ALTER TABLE "match_proposals" ADD COLUMN "founder_review_status" varchar DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_proposals" ADD COLUMN "founder_review_note" text;--> statement-breakpoint
ALTER TABLE "match_proposals" ADD COLUMN "founder_reviewed_by" varchar;--> statement-breakpoint
ALTER TABLE "match_proposals" ADD COLUMN "founder_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_proposals" ADD COLUMN "introduced_at" timestamp with time zone;--> statement-breakpoint
UPDATE "match_proposals"
SET
  "founder_review_note" = substring("summary" from position('FOUNDER:' in "summary")),
  "summary" = rtrim(left("summary", position('FOUNDER:' in "summary") - 1))
WHERE "summary" LIKE '%FOUNDER:%';--> statement-breakpoint
UPDATE "match_proposals"
SET "founder_review_status" = 'sent', "introduced_at" = "updated_at"
WHERE "status" <> 'proposed';
