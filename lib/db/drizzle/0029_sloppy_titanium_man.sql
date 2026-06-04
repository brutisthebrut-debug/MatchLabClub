ALTER TABLE "user_verifications" ADD COLUMN "id_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_verifications" ADD COLUMN "id_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_verifications" ADD COLUMN "age_over_18" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_verifications" ADD COLUMN "stripe_verification_session_id" varchar;