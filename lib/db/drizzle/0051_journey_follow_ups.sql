CREATE TABLE "journey_follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" integer NOT NULL,
	"source_label" varchar(500) NOT NULL,
	"question" text NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"answered_at" timestamp,
	"readiness_recorded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "journey_follow_ups_user_created_idx" ON "journey_follow_ups" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "journey_follow_ups_user_status_idx" ON "journey_follow_ups" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "journey_follow_ups_source_idx" ON "journey_follow_ups" USING btree ("user_id","source_type","source_id");
