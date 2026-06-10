CREATE TABLE "wellness_inferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"dimension" varchar(40) NOT NULL,
	"inferred_question_id" varchar(120) NOT NULL,
	"question_text" text NOT NULL,
	"suggested_answer" text NOT NULL,
	"source_kind" varchar(40) NOT NULL,
	"rationale" text,
	"mode" varchar(20) DEFAULT 'deterministic' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wellness_inferences_user_status_idx" ON "wellness_inferences" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "wellness_inferences_user_qid_idx" ON "wellness_inferences" USING btree ("user_id","inferred_question_id");