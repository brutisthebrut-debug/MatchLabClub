ALTER TABLE "time_capsules" ADD COLUMN "echo_use_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "time_capsules" ADD COLUMN "echo_use_updated_at" timestamp;
ALTER TABLE "time_capsules" ADD COLUMN "learning_confirmed" boolean DEFAULT false NOT NULL;
ALTER TABLE "time_capsules" ADD COLUMN "learning_confirmed_at" timestamp;
ALTER TABLE "time_capsules" ADD COLUMN "matching_use_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "time_capsules" ADD COLUMN "matching_use_updated_at" timestamp;
