CREATE TABLE "life_pulses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"anonymous_claim_token" varchar,
	"sleep" integer NOT NULL,
	"energy" integer NOT NULL,
	"social" integer NOT NULL,
	"money" integer NOT NULL,
	"headspace" integer NOT NULL,
	"note" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "life_pulses_user_created_idx" ON "life_pulses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "life_pulses_anon_created_idx" ON "life_pulses" USING btree ("anonymous_claim_token","created_at");