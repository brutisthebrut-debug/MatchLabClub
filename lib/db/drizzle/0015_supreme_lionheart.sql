CREATE TABLE "mirror_digest_prefs" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"frequency" varchar(16) DEFAULT 'weekly' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"last_score" integer,
	"last_breakdown" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirror_digest_prefs" ADD CONSTRAINT "mirror_digest_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;