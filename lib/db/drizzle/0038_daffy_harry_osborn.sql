CREATE TABLE "connector_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(48) NOT NULL,
	"lane_id" varchar(48) NOT NULL,
	"source" varchar(48) NOT NULL,
	"status" varchar(24) DEFAULT 'connected' NOT NULL,
	"scopes" jsonb,
	"consent_version" varchar(24),
	"last_sync_at" timestamp,
	"last_success_at" timestamp,
	"last_error_code" varchar(64),
	"derived_import_id" integer,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "connector_connections_user_provider_idx" ON "connector_connections" USING btree ("user_id","provider");