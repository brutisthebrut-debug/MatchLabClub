CREATE TABLE "companion_state" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"persona" varchar DEFAULT 'best_friend' NOT NULL,
	"candor" integer DEFAULT 2 NOT NULL,
	"evolving_summary" text,
	"last_mood" varchar,
	"last_seen_score" integer,
	"last_seen_at" timestamp with time zone,
	"last_proactive_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"grounding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"severity" varchar DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"signal_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companion_commitments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"body" text NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companion_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source" varchar DEFAULT 'proactive' NOT NULL,
	"kind" varchar NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cta_href" varchar,
	"cta_label" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companion_channel_prefs" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"phone" varchar,
	"sms_consent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "companion_messages_user_idx" ON "companion_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "companion_observations_user_idx" ON "companion_observations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "companion_commitments_user_idx" ON "companion_commitments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "companion_notifications_user_idx" ON "companion_notifications" USING btree ("user_id","created_at");