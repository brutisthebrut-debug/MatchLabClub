CREATE TABLE "wellness_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"question_id" varchar(120) NOT NULL,
	"dimension" varchar(40) NOT NULL,
	"category" varchar(80),
	"question_text" text NOT NULL,
	"answer" text NOT NULL,
	"consent_level" varchar(20) DEFAULT 'coaching' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wellness_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"tag" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"category" varchar(40) NOT NULL,
	"approved_for_matching" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wellness_answers_user_dim_idx" ON "wellness_answers" USING btree ("user_id","dimension");--> statement-breakpoint
CREATE INDEX "wellness_answers_anon_idx" ON "wellness_answers" USING btree ("anonymous_claim_token");--> statement-breakpoint
CREATE INDEX "wellness_tags_user_idx" ON "wellness_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wellness_tags_user_tag_idx" ON "wellness_tags" USING btree ("user_id","tag");