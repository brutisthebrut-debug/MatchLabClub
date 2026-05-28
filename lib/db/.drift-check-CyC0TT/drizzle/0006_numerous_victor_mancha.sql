ALTER TABLE "imported_sources" ALTER COLUMN "source" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_content_consent_updated_at" timestamp with time zone;