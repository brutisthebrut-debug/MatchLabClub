CREATE TABLE "prediction_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"item_id" varchar(64) NOT NULL,
	"predicted" integer NOT NULL,
	"actual" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_user_item_idx" ON "prediction_responses" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "prediction_user_created_idx" ON "prediction_responses" USING btree ("user_id","created_at");