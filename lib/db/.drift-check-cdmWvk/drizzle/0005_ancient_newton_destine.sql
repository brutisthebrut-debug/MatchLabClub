CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"inviter_user_id" varchar NOT NULL,
	"invitee_user_id" varchar,
	"ref_code" varchar NOT NULL,
	"surface" varchar,
	"landed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_up_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_inviter_idx" ON "referrals" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "referrals_invitee_idx" ON "referrals" USING btree ("invitee_user_id");