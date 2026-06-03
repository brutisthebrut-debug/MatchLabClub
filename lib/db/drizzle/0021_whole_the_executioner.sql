CREATE TABLE "wyr_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"prompt_id" varchar(64) NOT NULL,
	"choice" varchar(1) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wyr_user_prompt_idx" ON "wyr_answers" USING btree ("user_id","prompt_id");--> statement-breakpoint
CREATE INDEX "wyr_user_created_idx" ON "wyr_answers" USING btree ("user_id","created_at");