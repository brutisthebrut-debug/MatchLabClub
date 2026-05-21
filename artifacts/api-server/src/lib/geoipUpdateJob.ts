import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  db,
  jobHeartbeatsTable,
  geoipAlertStateTable,
  GEOIP_ALERT_STATE_SINGLETON_ID,
} from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";
import { sendMail } from "./mailer";

const execFileAsync = promisify(execFile);

const GEOIP_UPDATE_JOB = "geoip_update";
const DEFAULT_INTERVAL_DAYS = 30;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_KEY_MISSING_ALERT_DAYS = 35;
const DEFAULT_REBREACH_COOLDOWN_MINUTES = 15;

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

function getKeyMissingAlertDays(): number {
  return readPositiveNumberEnv(
    "GEOIP_KEY_MISSING_ALERT_DAYS",
    DEFAULT_KEY_MISSING_ALERT_DAYS,
  );
}

function getRebreachCooldownMs(): number {
  return (
    readPositiveNumberEnv(
      "GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES",
      DEFAULT_REBREACH_COOLDOWN_MINUTES,
    ) *
    60 *
    1000
  );
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

interface GeoipAlertStateRow {
  breached: boolean;
  lastNotifiedAt: Date | null;
  lastClearedAt: Date | null;
}

async function getAlertState(): Promise<GeoipAlertStateRow | null> {
  try {
    const rows = await db
      .select()
      .from(geoipAlertStateTable)
      .where(eq(geoipAlertStateTable.id, GEOIP_ALERT_STATE_SINGLETON_ID))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      breached: row.breached,
      lastNotifiedAt: row.lastNotifiedAt,
      lastClearedAt: row.lastClearedAt,
    };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "GeoIP update job: failed to read alert state",
    );
    return null;
  }
}

async function markBreached(daysSinceUpdate: number, now: Date): Promise<void> {
  await db
    .insert(geoipAlertStateTable)
    .values({
      id: GEOIP_ALERT_STATE_SINGLETON_ID,
      breached: true,
      lastNotifiedAt: now,
      lastDaysSinceUpdate: String(Math.floor(daysSinceUpdate)),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: geoipAlertStateTable.id,
      set: {
        breached: true,
        lastNotifiedAt: now,
        lastDaysSinceUpdate: String(Math.floor(daysSinceUpdate)),
        updatedAt: now,
      },
    });
}

async function markCleared(now: Date): Promise<void> {
  await db
    .update(geoipAlertStateTable)
    .set({
      breached: false,
      lastClearedAt: now,
      updatedAt: now,
    })
    .where(eq(geoipAlertStateTable.id, GEOIP_ALERT_STATE_SINGLETON_ID));
}

async function sendKeyMissingAlert(
  daysSinceUpdate: number,
  lastSuccessAt: Date | null,
): Promise<boolean> {
  const recipient = getFounderRecipient();
  if (!recipient) {
    logger.warn(
      { daysSinceUpdate },
      "GeoIP license key appears missing/expired but FOUNDER_ALERT_EMAIL is not set; skipping alert send",
    );
    return false;
  }
  try {
    await sendMail({
      to: recipient,
      subject: "[NLDC] GeoIP license key missing — location data going stale",
      text: [
        "The MAXMIND_LICENSE_KEY secret is not set on the API server, and",
        `the GeoIP database has not been refreshed in ~${Math.floor(daysSinceUpdate)} days`,
        `(last successful update: ${lastSuccessAt ? lastSuccessAt.toUTCString() : "never"}).`,
        "",
        "Sign-in notification emails will start showing increasingly inaccurate locations",
        "as IP ranges get reassigned.",
        "",
        "To fix:",
        "  1. Get a free key at https://www.maxmind.com/en/geolite2/signup",
        "  2. Set MAXMIND_LICENSE_KEY in the API server secrets",
        "  3. The next scheduled run will refresh the database automatically",
        "",
        "This is a one-time alert. You won't be notified again until the key is",
        "restored and a refresh succeeds (after which a re-breach inside the cooldown",
        "window will also be suppressed).",
      ].join("\n"),
    });
    return true;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "GeoIP key-missing alert email could not be sent; will retry on next check",
    );
    return false;
  }
}

async function sendKeyRestoredEmail(
  firstBreachedAt: Date | null,
  now: Date,
): Promise<void> {
  const recipient = getFounderRecipient();
  if (!recipient) return;
  try {
    await sendMail({
      to: recipient,
      subject: "[NLDC] GeoIP license key restored — location data fresh again",
      text: [
        "A GeoIP database refresh has succeeded, so the MAXMIND_LICENSE_KEY secret",
        "is working again and sign-in notification locations are now up to date.",
        "",
        firstBreachedAt
          ? `Previous alert sent at: ${firstBreachedAt.toUTCString()}`
          : "No prior alert timestamp recorded.",
        `Restored at: ${now.toUTCString()}`,
      ].join("\n"),
    });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "GeoIP key-restored confirmation email could not be sent",
    );
  }
}

export async function checkGeoipKeyMissingAlert(): Promise<
  "alerted" | "suppressed_cooldown" | "suppressed_breached" | "not_due" | "no_heartbeat"
> {
  const licenseKey = process.env["MAXMIND_LICENSE_KEY"]?.trim();
  if (licenseKey) return "not_due";

  const lastSuccessAt = await getLastSuccessAt();
  if (!lastSuccessAt) {
    // We have no baseline for "stale". Don't alert on a fresh install — the
    // setup docs cover the missing-key case explicitly.
    return "no_heartbeat";
  }

  const now = new Date();
  const ageMs = now.getTime() - lastSuccessAt.getTime();
  const thresholdMs = getKeyMissingAlertDays() * 24 * 60 * 60 * 1000;
  if (ageMs < thresholdMs) return "not_due";

  const state = await getAlertState();
  if (state?.breached) return "suppressed_breached";

  // Rebreach cooldown: if we recently cleared an alert, suppress the new one
  // until enough healthy time has passed.
  if (state?.lastClearedAt) {
    const cooldownMs = getRebreachCooldownMs();
    if (now.getTime() - state.lastClearedAt.getTime() < cooldownMs) {
      logger.info(
        { lastClearedAt: state.lastClearedAt, cooldownMs },
        "Suppressing GeoIP key-missing alert — re-breach inside cooldown window",
      );
      // Still record breached=true so we don't keep evaluating cooldown every
      // check, mirroring aiReliabilityAlerts behaviour.
      await markBreached(ageMs / (24 * 60 * 60 * 1000), now);
      return "suppressed_cooldown";
    }
  }

  const daysSinceUpdate = ageMs / (24 * 60 * 60 * 1000);
  const notified = await sendKeyMissingAlert(daysSinceUpdate, lastSuccessAt);
  if (!notified) {
    // Without a recipient or with a delivery failure, leave state unchanged
    // so the next scheduled check retries.
    return "not_due";
  }
  await markBreached(daysSinceUpdate, now);
  return "alerted";
}

export async function runGeoipUpdate(options?: {
  jobName?: string;
}): Promise<boolean> {
  const heartbeatJobName = options?.jobName ?? GEOIP_UPDATE_JOB;
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

    await recordJobHeartbeat(heartbeatJobName);

    logger.info("GeoIP database update completed successfully");

    // Clear any active key-missing alert and notify on recovery.
    const now = new Date();
    const prevState = await getAlertState();
    if (prevState?.breached) {
      await sendKeyRestoredEmail(prevState.lastNotifiedAt, now);
      await markCleared(now);
    }

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

  // If the key is missing and the last successful update is far enough in the
  // past, send a proactive one-time alert before the data goes obviously stale.
  await checkGeoipKeyMissingAlert();

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
