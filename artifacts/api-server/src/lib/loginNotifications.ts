import crypto from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { db, loginNotificationsTable } from "@workspace/db";
import { sendMail } from "./mailer";
import { logger } from "./logger";

const THROTTLE_MS = 30 * 24 * 60 * 60 * 1000;

function fingerprint(ip: string, userAgent: string): string {
  return crypto
    .createHash("sha256")
    .update(`${ip}::${userAgent}`)
    .digest("hex");
}

function describeUserAgent(ua: string): string {
  if (!ua) return "an unknown browser";
  const lower = ua.toLowerCase();
  let browser = "Browser";
  if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("safari/")) browser = "Safari";
  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os x") || lower.includes("macintosh"))
    os = "macOS";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("linux")) os = "Linux";
  return `${browser} on ${os}`;
}

export interface NotifyLoginInput {
  userId: string;
  email: string | null;
  firstName: string | null;
  ip: string;
  userAgent: string;
  channel: "web" | "mobile";
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
  const channelLabel = channel === "mobile" ? "the mobile app" : "the web app";

  const text = [
    `Hi ${name},`,
    "",
    `We noticed a new sign-in to your Next Level Dating Club account from ${channelLabel}.`,
    "",
    `When: ${when}`,
    `Device: ${device}`,
    `IP address: ${displayIp}`,
    "",
    "If this was you, no action is needed.",
    "If you don't recognize this sign-in, please change your password right away.",
    "",
    "— Next Level Dating Club",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${name},</p>
    <p>We noticed a new sign-in to your <strong>Next Level Dating Club</strong> account from ${channelLabel}.</p>
    <p style="font-size: 13px; color: #666;">
      <strong>When:</strong> ${when}<br/>
      <strong>Device:</strong> ${device}<br/>
      <strong>IP address:</strong> ${displayIp}
    </p>
    <p>If this was you, no action is needed.</p>
    <p style="font-size: 13px; color: #666;">
      If you don't recognize this sign-in, please change your password right away — someone else may have access to your account.
    </p>
    <p>— Next Level Dating Club</p>
  </body>
</html>`;

  try {
    await sendMail({
      to: email,
      subject: "New sign-in to your Next Level Dating Club account",
      text,
      html,
    });
  } catch (err) {
    logger.error(
      { err, userId },
      "Failed to send new sign-in notification email",
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
