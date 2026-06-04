ALTER TABLE "user_verifications" ADD COLUMN "selfie_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_verifications" ADD COLUMN "selfie_verified_at" timestamp;