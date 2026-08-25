CREATE TABLE "journey_experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"tried_at" timestamp,
	"readiness_recorded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "journey_experiments_user_created_idx" ON "journey_experiments" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "journey_experiments_user_status_idx" ON "journey_experiments" USING btree ("user_id","status");
