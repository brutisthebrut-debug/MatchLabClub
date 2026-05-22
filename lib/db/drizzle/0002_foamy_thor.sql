CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"prompt" text,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"mood" smallint,
	"linked_audit_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "post_date_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"date_at" timestamp,
	"person_label" varchar(120),
	"platform" varchar(40),
	"summary" text NOT NULL,
	"what_went_well" text DEFAULT '' NOT NULL,
	"what_didnt" text DEFAULT '' NOT NULL,
	"follow_up_planned" boolean DEFAULT false NOT NULL,
	"outcome" varchar(32),
	"linked_audit_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "journal_entries_user_created_idx" ON "journal_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_entries_anon_created_idx" ON "journal_entries" USING btree ("anonymous_claim_token","created_at");--> statement-breakpoint
CREATE INDEX "post_date_notes_user_created_idx" ON "post_date_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "post_date_notes_anon_created_idx" ON "post_date_notes" USING btree ("anonymous_claim_token","created_at");--> statement-breakpoint
CREATE INDEX "post_date_notes_user_date_idx" ON "post_date_notes" USING btree ("user_id","date_at");