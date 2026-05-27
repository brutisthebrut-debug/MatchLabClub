CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL,
	"user_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" varchar,
	"channel" varchar
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"first_name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" text NOT NULL,
	"orientation" text,
	"dating_goal" text NOT NULL,
	"current_apps" text[] DEFAULT '{}' NOT NULL,
	"bio" text NOT NULL,
	"prompts" text,
	"recent_message_sample" text,
	"photo_count" integer,
	"relationship_history" text,
	"biggest_challenge" text,
	"source_app" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"readiness_score" integer,
	"report" jsonb,
	"report_generated_at" timestamp,
	"previous_report" jsonb,
	"previous_readiness_score" integer,
	"previous_report_generated_at" timestamp,
	"raw_ocr_text" text,
	"ocr_corrections" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_report_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_id" integer NOT NULL,
	"readiness_score" integer NOT NULL,
	"report" jsonb NOT NULL,
	"change_summary" jsonb,
	"engine_version" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dating_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"platform" text NOT NULL,
	"bio" text NOT NULL,
	"prompts" text,
	"photo_count" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"session_id" integer,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_coaching_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"match_name" text NOT NULL,
	"conversation_context" text NOT NULL,
	"your_last_message" text NOT NULL,
	"goal" text,
	"source_app" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"source_label" text NOT NULL,
	"source_app" text,
	"pasted_content" text NOT NULL,
	"consent_given" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"podcast_source" text,
	"interested_in" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	"activation_email_sent_at" timestamp,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text,
	"email" text NOT NULL,
	"source" text NOT NULL,
	"interest" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_interest" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text,
	"email" text NOT NULL,
	"product" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"source" text,
	"promo_code" text,
	"stripe_session_id" text,
	"status" text DEFAULT 'interest' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_metrics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"tool_name" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"first_try_ok" integer DEFAULT 0 NOT NULL,
	"retried_ok" integer DEFAULT 0 NOT NULL,
	"fallbacks" integer DEFAULT 0 NOT NULL,
	"validation_failures" integer DEFAULT 0 NOT NULL,
	"avg_attempts" double precision DEFAULT 0 NOT NULL,
	"avg_duration_ms" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tool_name" text NOT NULL,
	"mode" text NOT NULL,
	"model" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"validated" boolean,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tool_alert_state" (
	"tool_name" text PRIMARY KEY NOT NULL,
	"breached" boolean DEFAULT false NOT NULL,
	"first_breached_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	"last_cleared_at" timestamp with time zone,
	"last_recent_total" integer DEFAULT 0 NOT NULL,
	"last_recent_first_try_success_rate" real DEFAULT 0 NOT NULL,
	"consecutive_send_failures" integer DEFAULT 0 NOT NULL,
	"last_send_failure_at" timestamp with time zone,
	"last_send_failure_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_alert_thresholds" (
	"tool_name" text PRIMARY KEY NOT NULL,
	"window_size" integer NOT NULL,
	"min_sample" integer NOT NULL,
	"threshold" double precision NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_alert_threshold_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tool_name" text NOT NULL,
	"action" text NOT NULL,
	"old_window_size" integer,
	"old_min_sample" integer,
	"old_threshold" double precision,
	"new_window_size" integer,
	"new_min_sample" integer,
	"new_threshold" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_tokens" (
	"token" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "handoff_token_redemptions" (
	"jti" varchar PRIMARY KEY NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_rate_limit_hits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"hit_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_notifications" (
	"user_id" varchar NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"last_notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_learned_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"pattern" text NOT NULL,
	"replacement" text NOT NULL,
	"scope" text,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"learned_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_rule_review_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"action" text NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"pattern" text NOT NULL,
	"replacement" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_heartbeats" (
	"job_name" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geoip_alert_state" (
	"id" text PRIMARY KEY NOT NULL,
	"breached" boolean DEFAULT false NOT NULL,
	"last_notified_at" timestamp with time zone,
	"last_cleared_at" timestamp with time zone,
	"last_days_since_update" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "founder_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" double precision NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_export_tokens" ADD CONSTRAINT "data_export_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_notifications" ADD CONSTRAINT "login_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_session_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_audits_first_name_trgm" ON "audits" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "IDX_audits_bio_trgm" ON "audits" USING gin ("bio" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "IDX_audit_report_versions_audit_id" ON "audit_report_versions" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "IDX_coach_follow_ups_user" ON "coach_follow_ups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_coach_follow_ups_anon" ON "coach_follow_ups" USING btree ("anonymous_claim_token");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_request_metrics_daily_day_tool_idx" ON "ai_request_metrics_daily" USING btree ("day","tool_name");--> statement-breakpoint
CREATE INDEX "ai_alert_threshold_changes_created_at_idx" ON "ai_alert_threshold_changes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_data_export_tokens_user" ON "data_export_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_handoff_token_redemptions_expires_at" ON "handoff_token_redemptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_handoff_rate_limit_hits_key" ON "handoff_rate_limit_hits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "IDX_handoff_rate_limit_hits_expires_at" ON "handoff_rate_limit_hits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_login_notifications_user_fp" ON "login_notifications" USING btree ("user_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_ocr_learned_rules_kind_pattern_scope" ON "ocr_learned_rules" USING btree ("kind","pattern","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_push_tokens_token" ON "push_tokens" USING btree ("token");