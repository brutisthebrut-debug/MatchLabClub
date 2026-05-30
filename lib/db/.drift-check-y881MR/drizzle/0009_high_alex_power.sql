CREATE TABLE "match_pool_membership" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"status" varchar DEFAULT 'off' NOT NULL,
	"ready_at" timestamp with time zone,
	"paused_reason" varchar,
	"tier" varchar,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_preferences" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"age_min" integer,
	"age_max" integer,
	"distance_km" integer,
	"gender_preference" varchar,
	"deal_breakers" text[],
	"must_haves" text[],
	"city_hint" varchar,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"proposed_to_user_id" varchar,
	"source" varchar NOT NULL,
	"compatibility_score" integer NOT NULL,
	"summary" text,
	"status" varchar DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "match_proposals_user_created_idx" ON "match_proposals" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "match_proposals_status_idx" ON "match_proposals" USING btree ("status");