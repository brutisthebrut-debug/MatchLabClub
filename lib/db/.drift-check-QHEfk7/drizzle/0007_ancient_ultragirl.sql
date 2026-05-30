CREATE TABLE "ai_usage_counters" (
	"user_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_counters_user_id_date_provider_pk" PRIMARY KEY("user_id","date","provider")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_counters" ADD CONSTRAINT "ai_usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_ai_usage_counters_user_date" ON "ai_usage_counters" USING btree ("user_id","date");