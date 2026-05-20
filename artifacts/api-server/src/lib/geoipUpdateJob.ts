import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, jobHeartbeatsTable } from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";
import { sendMail } from "./mailer";

const execFileAsync = promisify(execFile);

const GEOIP_UPDATE_JOB = "geoip_update";
const DEFAULT_INTERVAL_DAYS = 30;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getIntervalDays(): number {
  return readPositiveNumberEnv("GEOIP_UPDATE_INTERVAL_DAYS", DEFAULT_INTERVAL_DAYS);
}

function getFounderRecipient(): string | null {
  const v =
    process.env["FOUNDER_ALERT_EMAIL"]?.trim() ||
    process.env["FOUNDER_EMAIL"]?.trim();
  return v && v.length > 0 ? v : null;
}

async function getLastSuccessAt(): Promise<Date | null> {
  try {
    const rows = await db
      .select({ lastSuccessAt: jobHeartbeatsTable.lastSuccessAt })
      .from(jobHeartbeatsTable)
      .where(eq(jobHeartbeatsTable.jobName, GEOIP_UPDATE_JOB))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return row.lastSuccessAt instanceof Date
      ? row.lastSuccessAt
      : new Date(row.lastSuccessAt as unknown as string);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "GeoIP update job: failed to read last heartbeat",
    );
    return null;
  }
}

function isDue(lastSuccessAt: Date | null, intervalDays: number): boolean {
  if (!lastSuccessAt) return true;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() - lastSuccessAt.getTime() >= intervalMs;
}

export async function runGeoipUpdate(): Promise<boolean> {
  const licenseKey = process.env["MAXMIND_LICENSE_KEY"]?.trim();
  if (!licenseKey) {
    logger.warn(
      "MAXMIND_LICENSE_KEY is not set — skipping GeoIP database update. " +
        "Set this secret to enable automatic monthly location-data refreshes.",
    );
    return false;
  }

  logger.info("Starting GeoIP database update");

  const scriptPath = path.join(
    process.cwd(),
    "node_modules/geoip-lite/scripts/updatedb.js",
  );

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, `license_key=${licenseKey}`],
      {
        cwd: process.cwd(),
        timeout: 10 * 60 * 1000,
        env: process.env,
      },
    );

    if (stdout) logger.info({ stdout }, "GeoIP updater stdout");
    if (stderr) logger.warn({ stderr }, "GeoIP updater stderr");

    await recordJobHeartbeat(GEOIP_UPDATE_JOB);

    logger.info("GeoIP database update completed successfully");

    const recipient = getFounderRecipient();
    if (recipient) {
      try {
        await sendMail({
          to: recipient,
          subject: "GeoIP database updated successfully",
          text:
            "The GeoIP database on the API server has been refreshed with the latest MaxMind GeoLite2 data.\n\n" +
            "Sign-in location lookups will now reflect current IP-to-location mappings.\n\n" +
            `Updated at: ${new Date().toUTCString()}`,
        });
      } catch (mailErr) {
        logger.warn(
          { err: mailErr instanceof Error ? mailErr.message : String(mailErr) },
          "GeoIP update succeeded but confirmation email could not be sent",
        );
      }
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "GeoIP database update failed");

    const recipient = getFounderRecipient();
    if (recipient) {
      try {
        await sendMail({
          to: recipient,
          subject: "GeoIP database update FAILED",
          text:
            "The scheduled GeoIP database update failed on the API server.\n\n" +
            `Error: ${message}\n\n` +
            "Sign-in location data may become stale. Check MAXMIND_LICENSE_KEY is valid " +
            "and run `pnpm --filter @workspace/api-server run update-geoip` manually to retry.\n\n" +
            `Attempted at: ${new Date().toUTCString()}`,
        });
      } catch (mailErr) {
        logger.warn(
          { err: mailErr instanceof Error ? mailErr.message : String(mailErr) },
          "GeoIP update failed and the failure notification email also could not be sent",
        );
      }
    }

    return false;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

async function checkAndRun(): Promise<void> {
  const intervalDays = getIntervalDays();
  const lastSuccessAt = await getLastSuccessAt();

  if (!isDue(lastSuccessAt, intervalDays)) {
    const nextRunAt = lastSuccessAt
      ? new Date(
          lastSuccessAt.getTime() + intervalDays * 24 * 60 * 60 * 1000,
        ).toUTCString()
      : "unknown";
    logger.debug(
      { lastSuccessAt, intervalDays, nextRunAt },
      "GeoIP update not due yet",
    );
    return;
  }

  await runGeoipUpdate();
}

export function startGeoipUpdateJob(): void {
  if (scheduledTimer) return;

  void checkAndRun();

  scheduledTimer = setInterval(() => {
    void checkAndRun();
  }, CHECK_INTERVAL_MS);

  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { intervalDays: getIntervalDays(), checkIntervalHours: 24 },
    "Started GeoIP update job (checks daily, runs monthly)",
  );
}

export function stopGeoipUpdateJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
