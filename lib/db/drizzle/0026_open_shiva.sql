CREATE TABLE "cosmic_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"birth_date" varchar(10) NOT NULL,
	"birth_time" varchar(5),
	"birth_place" varchar(160) NOT NULL,
	"birth_lat" double precision NOT NULL,
	"birth_lng" double precision NOT NULL,
	"placements" jsonb NOT NULL,
	"reaction" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cosmic_user_idx" ON "cosmic_charts" USING btree ("user_id");