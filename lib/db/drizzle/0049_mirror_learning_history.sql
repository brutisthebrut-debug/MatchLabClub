CREATE TABLE "mirror_learning_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"learning_id" integer,
	"action" varchar(32) NOT NULL,
	"source_type" varchar NOT NULL,
	"source_ref" varchar NOT NULL,
	"source_label" varchar NOT NULL,
	"prior_status" varchar,
	"new_status" varchar,
	"prior_text" text,
	"new_text" text,
	"confidence" integer NOT NULL,
	"matching_use_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mirror_learning_events_user_created_idx" ON "mirror_learning_events" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "mirror_learning_events_learning_idx" ON "mirror_learning_events" USING btree ("learning_id");
