import crypto from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { db, loginNotificationsTable, pushTokensTable } from "@workspace/db";
import { sendMail } from "./mailer";
import { logger } from "./logger";
import { describeIpLocation } from "./geoLocation";
import { describeUserAgent as describeUa } from "./userAgent";
import { sendExpoPushNotifications } from "./expoPush";

export const NEW_SIGN_IN_NOTIFICATION_TYPE = "new-sign-in";

const THROTTLE_MS = 30 * 24 * 60 * 60 * 1000;

function fingerprint(ip: string, userAgent: string): string {
  return crypto
    .createHash("sha256")
    .update(`${ip}::${userAgent}`)
    .digest("hex");
}

function describeUserAgent(ua: string): string {
  return describeUa(ua) ?? "an unknown browser";
}

export interface NotifyLoginInput {
  userId: string;
  email: string | null;
  firstName: string | null;
  ip: string;
  userAgent: string;
  channel: "web" | "mobile";
  /**
   * Expo push token of the device performing the sign-in, if known. When
   * provided, this token is excluded from the new-sign-in push notification
   * recipients so the signing-in device doesn't notify itself.
   */
  excludePushToken?: string | null;
}

export async function notifySignInIfNew(input: NotifyLoginInput): Promise<void> {
  const { userId, email, firstName, ip, userAgent, channel } = input;
  if (!email) return;

  const fp = fingerprint(ip || "unknown", userAgent || "unknown");
  const now = new Date();
  const cutoff = new Date(now.getTime() - THROTTLE_MS);

  const existing = await db
    .select({ lastNotifiedAt: loginNotificationsTable.lastNotifiedAt })
    .from(loginNotificationsTable)
    .where(
      and(
        eq(loginNotificationsTable.userId, userId),
        eq(loginNotificationsTable.fingerprint, fp),
        gte(loginNotificationsTable.lastNotifiedAt, cutoff),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db
    .insert(loginNotificationsTable)
    .values({ userId, fingerprint: fp, lastNotifiedAt: now })
    .onConflictDoUpdate({
      target: [
        loginNotificationsTable.userId,
        loginNotificationsTable.fingerprint,
      ],
      set: { lastNotifiedAt: now },
    });

  const name = firstName?.trim() || "there";
  const when = now.toUTCString();
  const device = describeUserAgent(userAgent);
  const displayIp = ip || "unknown";
  const displayLocation = describeIpLocation(ip);
  const channelLabel = channel === "mobile" ? "the mobile app" : "the web app";

  // Plain-text: "Berlin, DE (1.2.3.4)" when location known, otherwise just the IP
  const displayIpLine = displayLocation ? `${displayLocation} (${displayIp})` : displayIp;

  const text = [
    `Hi ${name},`,
    "",
    `We noticed a new sign-in to your MatchLab Club account from ${channelLabel}.`,
    "",
    `When:      ${when}`,
    `Device:    ${device}`,
    `Location:  ${displayIpLine}`,
    "",
    "If this was you, you're all set, no action needed.",
    "If you don't recognize this sign-in, please change your password immediately.",
    "",
    "Stay safe,",
    "The MatchLab Club team",
  ].join("\n");

  // HTML: show location as the label with raw IP as tooltip; fall back to just the IP
  const htmlIpField = displayLocation
    ? `<span title="${displayIp}">${displayLocation}</span>`
    : displayIp;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.7; color: #1a1a2e; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
    <div style="margin-bottom: 28px;">
      <span style="font-size: 18px; font-weight: 700; color: #7c5cbf;">MatchLab Club</span>
    </div>
    <p style="margin: 0 0 16px;">Hi ${name},</p>
    <p style="margin: 0 0 20px;">We noticed a new sign-in to your <strong>MatchLab Club</strong> account from <strong>${channelLabel}</strong>.</p>
    <div style="background: #f5f3ff; border-left: 3px solid #7c5cbf; border-radius: 6px; padding: 14px 18px; margin: 0 0 20px; font-size: 13px; color: #444;">
      <div style="margin-bottom: 6px;"><strong>When:</strong> ${when}</div>
      <div style="margin-bottom: 6px;"><strong>Device:</strong> ${device}</div>
      <div><strong>Location:</strong> ${htmlIpField}</div>
    </div>
    <p style="margin: 0 0 12px;">If this was you, you're all set, no action needed.</p>
    <p style="font-size: 13px; color: #666; margin: 0 0 24px;">
      If you <em>don't</em> recognize this sign-in, please change your password immediately, someone else may have access to your account.
    </p>
    <p style="margin: 0; color: #888; font-size: 13px;">Stay safe,<br/>The MatchLab Club team</p>
  </body>
</html>`;

  try {
    await sendMail({
      to: email,
      subject: "New sign-in to your MatchLab Club account",
      text,
      html,
    });
  } catch (err) {
    logger.error(
      { err, userId },
      "Failed to send new sign-in notification email",
    );
  }

  await sendNewSignInPushNotification({
    userId,
    device,
    displayLocation: displayLocation ?? displayIp,
    excludePushToken: input.excludePushToken ?? null,
  });
}

async function sendNewSignInPushNotification(opts: {
  userId: string;
  device: string;
  displayLocation: string | null;
  excludePushToken: string | null;
}): Promise<void> {
  const { userId, device, displayLocation, excludePushToken } = opts;

  let tokenRows: { token: string }[];
  try {
    tokenRows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));
  } catch (err) {
    logger.error(
      { err, userId },
      "Failed to fetch push tokens for new sign-in notification",
    );
    return;
  }

  if (tokenRows.length === 0) return;

  const { Expo } = (await import("expo-server-sdk")) as typeof import("expo-server-sdk");

  const messages = tokenRows
    .filter((r) => r.token !== excludePushToken)
    .filter((r) => Expo.isExpoPushToken(r.token))
    .map((r) => ({
      to: r.token,
      title: "New sign-in detected",
      body: displayLocation ? `${device} · ${displayLocation}` : device,
      sound: "default" as const,
      data: { type: NEW_SIGN_IN_NOTIFICATION_TYPE, screen: "/sessions" },
    }));

  if (messages.length === 0) return;

  try {
    await sendExpoPushNotifications(messages);
    logger.info(
      { userId, tokenCount: messages.length },
      "Sent new sign-in push notification",
    );
  } catch (err) {
    logger.error(
      { err, userId },
      "Failed to send new sign-in push notification",
    );
  }
}

export function extractClientIp(headers: Record<string, unknown>, fallback?: string): string {
  const fwd = headers["x-forwarded-for"];
  if (typeof fwd === "string") {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return fallback || "";
}
