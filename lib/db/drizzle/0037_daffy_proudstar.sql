CREATE TABLE "care_dialect_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"self_give" varchar(32),
	"self_receive" varchar(32),
	"tested_give_dist" jsonb,
	"tested_give_top" varchar(32),
	"tested_receive_dist" jsonb,
	"tested_receive_top" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "care_dialect_profiles_user_idx" ON "care_dialect_profiles" USING btree ("user_id");