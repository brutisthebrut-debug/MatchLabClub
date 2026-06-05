CREATE TABLE "daily_spark_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"question_id" varchar(64) NOT NULL,
	"choice" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"bring_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seek_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_spark_user_question_idx" ON "daily_spark_answers" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "daily_spark_user_created_idx" ON "daily_spark_answers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "flag_selections_user_idx" ON "flag_selections" USING btree ("user_id");