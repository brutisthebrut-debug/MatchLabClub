CREATE TABLE "compatibility_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"source_kind" varchar(20) NOT NULL,
	"raw_text" text NOT NULL,
	"parsed_profile" jsonb,
	"result_json" jsonb,
	"overall_alignment" integer,
	"mode" varchar(20) DEFAULT 'fallback' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "imported_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"source" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'uploaded' NOT NULL,
	"original_filename" varchar(255),
	"parsed_summary" jsonb,
	"error" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_content_consent_granted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_content_consent_granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_content_consent_revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "compatibility_reads_user_idx" ON "compatibility_reads" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "compatibility_reads_anon_idx" ON "compatibility_reads" USING btree ("anonymous_claim_token");--> statement-breakpoint
CREATE INDEX "imported_sources_user_idx" ON "imported_sources" USING btree ("user_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "imported_sources_anon_idx" ON "imported_sources" USING btree ("anonymous_claim_token");--> statement-breakpoint
CREATE INDEX "imported_sources_status_idx" ON "imported_sources" USING btree ("status");