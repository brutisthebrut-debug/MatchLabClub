CREATE TABLE "founder_action_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"method" varchar(12) NOT NULL,
	"path" varchar(512) NOT NULL,
	"status_code" integer NOT NULL,
	"ip" varchar(128),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(24) DEFAULT 'member' NOT NULL;--> statement-breakpoint
CREATE INDEX "founder_action_logs_actor_created_idx" ON "founder_action_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "founder_action_logs_created_idx" ON "founder_action_logs" USING btree ("created_at");