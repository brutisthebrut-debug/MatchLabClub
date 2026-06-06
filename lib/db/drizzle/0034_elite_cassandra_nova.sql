CREATE TABLE "connection_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"sender_user_id" varchar NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low_id" varchar NOT NULL,
	"user_high_id" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"closed_reason" varchar,
	"closed_by_user_id" varchar,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "connection_messages_conn_idx" ON "connection_messages" USING btree ("connection_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_connections_pair_uidx" ON "match_connections" USING btree ("user_low_id","user_high_id");--> statement-breakpoint
CREATE INDEX "match_connections_low_idx" ON "match_connections" USING btree ("user_low_id");--> statement-breakpoint
CREATE INDEX "match_connections_high_idx" ON "match_connections" USING btree ("user_high_id");