ALTER TABLE "match_connections" ADD COLUMN "date_planned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "match_connections" ADD COLUMN "date_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "post_date_notes" ADD COLUMN "connection_id" uuid;
--> statement-breakpoint
CREATE INDEX "post_date_notes_connection_user_idx" ON "post_date_notes" USING btree ("connection_id","user_id");
