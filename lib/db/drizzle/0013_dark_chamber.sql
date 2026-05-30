ALTER TABLE "leads" ADD COLUMN "status" text DEFAULT 'New' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "status_updated_at" timestamp;