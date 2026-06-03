CREATE TABLE "wingman_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"warmth" integer NOT NULL,
	"humor" integer NOT NULL,
	"drive" integer NOT NULL,
	"openness" integer NOT NULL,
	"steadiness" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wingman_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"friend_label" varchar(60),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wingman_self_ratings" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"warmth" integer NOT NULL,
	"humor" integer NOT NULL,
	"drive" integer NOT NULL,
	"openness" integer NOT NULL,
	"steadiness" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wingman_answer_invite_idx" ON "wingman_answers" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "wingman_answer_user_idx" ON "wingman_answers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wingman_invite_user_created_idx" ON "wingman_invites" USING btree ("user_id","created_at");