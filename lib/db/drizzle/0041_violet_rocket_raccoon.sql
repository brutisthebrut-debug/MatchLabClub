CREATE TABLE "data_permission_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"resource_type" varchar(48) NOT NULL,
	"resource_id" varchar(120) NOT NULL,
	"purpose" varchar(24) NOT NULL,
	"granted" boolean NOT NULL,
	"actor_type" varchar(24) NOT NULL,
	"actor_id" varchar,
	"reason" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wellness_answers" ALTER COLUMN "consent_level" SET DEFAULT 'coaching';--> statement-breakpoint
UPDATE "wellness_answers" SET "consent_level" = 'coaching' WHERE "consent_level" <> 'coaching';--> statement-breakpoint
ALTER TABLE "wellness_answers" ADD COLUMN "echo_use_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_answers" ADD COLUMN "mirror_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_answers" ADD COLUMN "matching_use_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_answers" ADD COLUMN "research_use_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_answers" ADD COLUMN "permission_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "IDX_data_permission_events_user_resource" ON "data_permission_events" USING btree ("user_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "IDX_data_permission_events_user_created" ON "data_permission_events" USING btree ("user_id","created_at");
