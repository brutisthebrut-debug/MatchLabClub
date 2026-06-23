CREATE TABLE "behavioral_growth_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "behavioral_growth_user_created_idx" ON "behavioral_growth_events" USING btree ("user_id","created_at");