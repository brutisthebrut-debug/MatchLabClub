CREATE TABLE "user_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_user_id" varchar NOT NULL,
	"blocked_user_id" varchar NOT NULL,
	"reason" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_user_id" varchar NOT NULL,
	"reported_user_id" varchar NOT NULL,
	"reason" varchar NOT NULL,
	"context" varchar,
	"note" varchar(1000),
	"status" varchar DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_pair_uidx" ON "user_blocks" USING btree ("blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "user_reports_reported_idx" ON "user_reports" USING btree ("reported_user_id");--> statement-breakpoint
CREATE INDEX "user_reports_reporter_idx" ON "user_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "user_reports_status_created_idx" ON "user_reports" USING btree ("status","created_at" DESC NULLS LAST);