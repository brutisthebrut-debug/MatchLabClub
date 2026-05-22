CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"title" varchar(200),
	"body" text NOT NULL,
	"mood" varchar(32),
	"tag" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "post_date_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"match_name" varchar(120),
	"what_happened" text NOT NULL,
	"felt_good" text[] DEFAULT '{}' NOT NULL,
	"felt_off" text[] DEFAULT '{}' NOT NULL,
	"outcome" varchar(80),
	"pattern_read" text,
	"coach_insight" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "journal_entries_user_created_idx" ON "journal_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_entries_anon_created_idx" ON "journal_entries" USING btree ("anonymous_claim_token","created_at");--> statement-breakpoint
CREATE INDEX "post_date_notes_user_created_idx" ON "post_date_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "post_date_notes_anon_created_idx" ON "post_date_notes" USING btree ("anonymous_claim_token","created_at");