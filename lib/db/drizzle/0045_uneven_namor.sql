CREATE TABLE "billing_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"email" text NOT NULL,
	"product" varchar(32) NOT NULL,
	"tier" varchar(24),
	"kind" varchar(24) NOT NULL,
	"status" varchar(32) NOT NULL,
	"amount_cents" integer,
	"currency" varchar(8),
	"stripe_customer_id" varchar,
	"stripe_checkout_session_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_payment_intent_id" varchar,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"last_stripe_event_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"event_id" varchar PRIMARY KEY NOT NULL,
	"type" varchar(128) NOT NULL,
	"status" varchar(24) DEFAULT 'processing' NOT NULL,
	"error" text,
	"stripe_created_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_entitlements_user_idx" ON "billing_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_entitlements_email_idx" ON "billing_entitlements" USING btree ("email");--> statement-breakpoint
CREATE INDEX "billing_entitlements_customer_idx" ON "billing_entitlements" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_entitlements_status_idx" ON "billing_entitlements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_entitlements_checkout_session_unique" ON "billing_entitlements" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_entitlements_subscription_unique" ON "billing_entitlements" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "stripe_events_status_idx" ON "stripe_events" USING btree ("status");