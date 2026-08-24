CREATE TABLE "mirror_learnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"source_ref" varchar NOT NULL,
	"source_label" varchar NOT NULL,
	"observation" text NOT NULL,
	"proposed_learning" text NOT NULL,
	"member_learning" text,
	"status" varchar DEFAULT 'proposed' NOT NULL,
	"confidence" integer NOT NULL,
	"matching_use_approved" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mirror_learnings_user_source_uidx" ON "mirror_learnings" USING btree ("user_id","source_type","source_ref");
--> statement-breakpoint
CREATE INDEX "mirror_learnings_user_status_idx" ON "mirror_learnings" USING btree ("user_id","status");

