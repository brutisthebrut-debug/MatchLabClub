CREATE TABLE "billing_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"product" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"source" varchar(24) DEFAULT 'stripe' NOT NULL,
	"amount_cents" integer,
	"stripe_customer_id" text,
	"stripe_checkout_session_id" text,
	"stripe_subscription_id" text,
	"access_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_ends_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_stripe_event_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"event_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier_source" varchar(20);--> statement-breakpoint
CREATE INDEX "IDX_billing_entitlements_user_id" ON "billing_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_billing_entitlements_customer_id" ON "billing_entitlements" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_billing_entitlements_checkout_session" ON "billing_entitlements" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_billing_entitlements_subscription" ON "billing_entitlements" USING btree ("stripe_subscription_id");