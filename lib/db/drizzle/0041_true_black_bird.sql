ALTER TABLE "post_date_notes" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "match_connections" ADD COLUMN "date_planned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_connections" ADD COLUMN "date_completed_at" timestamp with time zone;--> statement-breakpoint
