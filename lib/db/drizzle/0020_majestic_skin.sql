ALTER TABLE "companion_state" ADD COLUMN "last_reacted_score" integer;--> statement-breakpoint
ALTER TABLE "companion_state" ADD COLUMN "last_reacted_coverage" jsonb;--> statement-breakpoint
ALTER TABLE "companion_state" ADD COLUMN "last_reacted_at" timestamp with time zone;