ALTER TABLE "user_reports" ALTER COLUMN "reported_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reports" ADD COLUMN "subject_type" varchar DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reports" ADD COLUMN "external_app" varchar;--> statement-breakpoint
ALTER TABLE "user_reports" ADD COLUMN "external_label" varchar;