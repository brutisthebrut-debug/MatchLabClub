// Sentry MUST initialize before any application module is imported so its
// auto-instrumentation can wrap them. In ESM, static imports are evaluated
// before the importing module's body runs, so we cannot rely on placing
// `Sentry.init()` at the top of this file, by the time it executes, `app`
// has already been loaded. Isolating init in a separate module that we
// import first guarantees correct ordering.
import "./sentry";
import * as Sentry from "@sentry/node";

import app from "./app";
import { logger } from "./lib/logger";
import { startAiMetricsRetentionJob } from "./lib/aiMetricsRetention";
import { startDataExportTokenCleanupJob } from "./lib/dataExportTokenCleanup";
import { startHandoffRedemptionCleanupJob } from "./lib/handoffRedemptionCleanup";
import { startAiReliabilityAlertsJob } from "./lib/aiReliabilityAlerts";
import { startAuditTrashPurgeJob } from "./lib/auditTrashPurge";
import { startAuditVersionPurgeJob } from "./lib/auditVersionPurge";
import { refreshLearnedRulesCache } from "./lib/ocrLearning";
import { startOcrLearningJob } from "./lib/ocrLearningJob";
import { startAuditTrashPushJob } from "./lib/auditTrashPushJob";
import { startGeoipUpdateJob } from "./lib/geoipUpdateJob";
import { startMatchingNudgeJob } from "./lib/matchingNudgeJob";
import { startMirrorDigestJob } from "./lib/mirrorDigestJob";
import { startImportRecoveryJob } from "./lib/importRecoveryJob";
import { startAutoProposalJob } from "./lib/autoProposalJob";
import { startCompanionNudgeJob } from "./lib/companionNudgeJob";
import { initStripe } from "./lib/initStripe";

Sentry.setupExpressErrorHandler(app);

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAiMetricsRetentionJob();
  startDataExportTokenCleanupJob();
  startHandoffRedemptionCleanupJob();
  startAiReliabilityAlertsJob();
  startAuditTrashPurgeJob();
  startAuditVersionPurgeJob();
  startAuditTrashPushJob();
  startGeoipUpdateJob();
  startMatchingNudgeJob();
  startMirrorDigestJob();
  startImportRecoveryJob();
  startAutoProposalJob();
  startCompanionNudgeJob();
  refreshLearnedRulesCache().catch((err) =>
    logger.warn({ err }, "Initial OCR learned-rules load failed"),
  );
  startOcrLearningJob();
  void initStripe();
});
