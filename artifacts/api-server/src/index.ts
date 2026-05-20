import app from "./app";
import { logger } from "./lib/logger";
import { startAiMetricsRetentionJob } from "./lib/aiMetricsRetention";
import { startDataExportTokenCleanupJob } from "./lib/dataExportTokenCleanup";
import { startHandoffRedemptionCleanupJob } from "./lib/handoffRedemptionCleanup";
import { startAiReliabilityAlertsJob } from "./lib/aiReliabilityAlerts";
import { startAuditTrashPurgeJob } from "./lib/auditTrashPurge";

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
});
