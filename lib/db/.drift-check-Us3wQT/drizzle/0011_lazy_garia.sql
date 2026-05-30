CREATE TABLE "dating_wins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"category" varchar(32) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "matching_readiness_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"day" date NOT NULL,
	"score" integer NOT NULL,
	"breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_nudge_state" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"last_nudged_at" timestamp with time zone,
	"last_seen_score" integer
);
--> statement-breakpoint
CREATE INDEX "dating_wins_user_created_idx" ON "dating_wins" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "dating_wins_anon_created_idx" ON "dating_wins" USING btree ("anonymous_claim_token","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matching_readiness_snapshots_user_day_idx" ON "matching_readiness_snapshots" USING btree ("user_id","day");