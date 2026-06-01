CREATE TABLE "journey_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"user_id" varchar,
	"anon_id" varchar(128),
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IDX_journey_events_type_created" ON "journey_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "IDX_journey_events_created" ON "journey_events" USING btree ("created_at");