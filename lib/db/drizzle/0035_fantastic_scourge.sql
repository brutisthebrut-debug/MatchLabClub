CREATE TABLE "profile_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"object_path" varchar NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_pool_membership" ADD COLUMN "reveal_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "profile_photos_user_idx" ON "profile_photos" USING btree ("user_id","ordinal");