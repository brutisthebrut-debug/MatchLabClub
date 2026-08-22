ALTER TABLE "imported_sources" ADD COLUMN "echo_use_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imported_sources" ADD COLUMN "echo_use_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "imported_sources" ADD COLUMN "learning_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imported_sources" ADD COLUMN "learning_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "imported_sources" ADD COLUMN "matching_use_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imported_sources" ADD COLUMN "matching_use_updated_at" timestamp;