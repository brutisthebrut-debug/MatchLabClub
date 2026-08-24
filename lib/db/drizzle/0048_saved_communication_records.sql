CREATE TABLE "communication_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"lens" varchar(32) NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"generated_by" varchar(24) NOT NULL,
	"confidence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "communication_records_user_lens_uidx" ON "communication_records" USING btree ("user_id","lens");
--> statement-breakpoint
CREATE INDEX "communication_records_user_idx" ON "communication_records" USING btree ("user_id");
