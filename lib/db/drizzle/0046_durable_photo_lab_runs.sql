CREATE TABLE "photo_lab_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_photo_ids" integer[] DEFAULT '{}' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "photo_lab_runs_user_created_idx" ON "photo_lab_runs" USING btree ("user_id","created_at");