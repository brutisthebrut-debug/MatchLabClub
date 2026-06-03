CREATE TABLE "scenario_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"scenario_id" varchar(64) NOT NULL,
	"option_id" varchar(16) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_user_scenario_idx" ON "scenario_responses" USING btree ("user_id","scenario_id");--> statement-breakpoint
CREATE INDEX "scenario_user_created_idx" ON "scenario_responses" USING btree ("user_id","created_at");