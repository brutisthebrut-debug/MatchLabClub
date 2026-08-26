ALTER TABLE "prediction_responses" ADD COLUMN "echo_use_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "prediction_responses" ADD COLUMN "echo_use_updated_at" timestamp;
ALTER TABLE "prediction_responses" ADD COLUMN "learning_confirmed" boolean DEFAULT false NOT NULL;
ALTER TABLE "prediction_responses" ADD COLUMN "learning_confirmed_at" timestamp;
ALTER TABLE "prediction_responses" ADD COLUMN "matching_use_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "prediction_responses" ADD COLUMN "matching_use_updated_at" timestamp;
