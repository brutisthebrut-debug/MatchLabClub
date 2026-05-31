import { desc, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  pushTokensTable,
  matchingReadinessSnapshotsTable,
  mirrorDigestPrefsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";
import { sendExpoPushNotifications, isValidExpoPushToken } from "./expoPush";
import { sendMail } from "./mailer";
import { generate } from "./aiService";
import { buildMirrorPortrait, buildMirrorDigest } from "./aiEngine";
import type { MirrorDigest } from "./aiEngine";
import { computeNextActions } from "./readiness";
import {
  computeReadiness,
  computeOutcomeInsightForUser,
  readinessThreshold,
} from "../routes/matching";

const MIRROR_DIGEST_JOB = "mirror_digest";
const DEFAULT_INTERVAL_HOURS = 24;
const WEEKLY_DAYS = 7;
const BIWEEKLY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type DigestFrequency = "weekly" | "biweekly" | "off";

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function digestEnabled(): boolean {
  const raw = process.env["MIRROR_DIGEST_ENABLED"];
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function normalizeFrequency(raw: string | null | undefined): DigestFrequency {
  if (raw === "biweekly" || raw === "off") return raw;
  return "weekly";
}

function cadenceDays(frequency: DigestFrequency): number | null {
  if (frequency === "weekly") return WEEKLY_DAYS;
  if (frequency === "biweekly") return BIWEEKLY_DAYS;
  return null;
}

function cadenceLabel(frequency: DigestFrequency): string {
  return frequency === "biweekly" ? "in the last two weeks" : "this week";
}

function toMs(value: Date | string | null): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BANNED_INTRO_TERMS = [
  "dive in",
  "unleash",
  "elevate",
  "leverage",
  "seamless",
  "unlock",
  "transformative",
  "in today's world",
];

/**
 * Guard against the deep-AI lane drifting off-voice. Claude is instructed to
 * obey our voice rules, but we never trust generated copy: an em dash, an emoji,
 * or any banned AI-tell term means we discard the rewrite and keep the
 * deterministic intro.
 */
function isVoiceClean(text: string): boolean {
  if (/[\u2014\u2013]/.test(text)) return false; // em dash / en dash
  if (
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u.test(
      text,
    )
  ) {
    return false; // emoji
  }
  const lower = text.toLowerCase();
  return !BANNED_INTRO_TERMS.some((term) => lower.includes(term));
}

/**
 * Deep AI lane warm intro. Claude only ever sees aggregate, derived digest
 * lines (score, mode, generic lane labels, the next signal label) and never raw
 * content or PII. Anything short of a clean schema-valid result keeps the
 * deterministic intro.
 */
async function warmIntro(
  userId: string,
  digest: MirrorDigest,
): Promise<string> {
  const system = [
    "You are Your Mirror inside MatchLab Club: the evolving model the app keeps",
    "of one user. Write the opening of a short digest email that tells them what",
    "changed about the model of them. Speak in second person, honest and warm.",
    "You only reason from the aggregate lines below. Never invent specifics.",
    "",
    `Mode: ${digest.mode}.`,
    `Score line: ${digest.scoreLine}`,
    digest.changed.length
      ? `What changed:\n${digest.changed.map((c) => `- ${c}`).join("\n")}`
      : "Nothing new changed.",
    digest.nextSignal
      ? `Single best next signal: ${digest.nextSignal.label}: ${digest.nextSignal.detail}`
      : "No standout next signal.",
    digest.nudge ? `Nudge: ${digest.nudge}` : "",
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "intro": "1 to 2 sentence warm opening, grounded only in the lines above" }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'dive in', or 'in today's world'.",
    "No emojis. Vary sentence length. Sound human.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: "Write the intro.",
        expectJson: true,
        requireContentConsent: true,
        userId,
        context: { toolName: "Mirror Digest" },
        maxTokens: 250,
      },
      "",
    );
    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = JSON.parse(aiResult.output) as { intro?: string };
      const candidate = ai.intro?.trim();
      if (candidate) {
        if (isVoiceClean(candidate)) return candidate;
        logger.info(
          "mirror digest deep-AI intro failed voice check; using deterministic intro",
        );
      }
    } else if (aiResult.fallbackReason) {
      logger.info(
        { fallbackReason: aiResult.fallbackReason },
        "mirror digest fell back to deterministic intro",
      );
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "mirror digest deep-AI lane threw; using deterministic intro",
    );
  }
  return digest.intro;
}

function renderText(intro: string, digest: MirrorDigest): string {
  const lines = [intro, "", digest.scoreLine, ""];
  if (digest.changed.length) {
    lines.push("What changed:");
    for (const c of digest.changed) lines.push(`- ${c}`);
    lines.push("");
  }
  if (digest.nextSignal) {
    lines.push(`Next signal to feed: ${digest.nextSignal.label}`);
    lines.push(digest.nextSignal.detail);
    lines.push("");
  }
  if (digest.nudge) {
    lines.push(digest.nudge);
    lines.push("");
  }
  lines.push("Open your Mirror to see the full picture.");
  return lines.join("\n");
}

function renderHtml(intro: string, digest: MirrorDigest): string {
  const parts: string[] = [
    `<p>${escapeHtml(intro)}</p>`,
    `<p><strong>${escapeHtml(digest.scoreLine)}</strong></p>`,
  ];
  if (digest.changed.length) {
    parts.push("<p>What changed:</p><ul>");
    for (const c of digest.changed) parts.push(`<li>${escapeHtml(c)}</li>`);
    parts.push("</ul>");
  }
  if (digest.nextSignal) {
    parts.push(
      `<p>Next signal to feed: <strong>${escapeHtml(digest.nextSignal.label)}</strong><br/>${escapeHtml(digest.nextSignal.detail)}</p>`,
    );
  }
  if (digest.nudge) parts.push(`<p>${escapeHtml(digest.nudge)}</p>`);
  parts.push("<p>Open your Mirror to see the full picture.</p>");
  return parts.join("\n");
}

/**
 * Build and send the periodic "what changed about you" Mirror digest to users
 * who have engaged (have a readiness snapshot) and have an email on file. Each
 * user's cadence comes from `mirror_digest_prefs` (default weekly; "off" opts
 * out entirely). The deterministic digest always sends; Claude adds a warm
 * intro only when the account has the deep AI lane on. A companion push goes to
 * any valid Expo tokens. State (last sent, last score, last breakdown) is
 * upserted so the next run can diff against it.
 */
export async function sendMirrorDigests(options?: {
  jobName?: string;
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? MIRROR_DIGEST_JOB;
  const now = Date.now();

  try {
    // Engaged users: anyone with at least one readiness snapshot.
    const snapshotRows = await db
      .selectDistinct({ userId: matchingReadinessSnapshotsTable.userId })
      .from(matchingReadinessSnapshotsTable);
    const userIds = snapshotRows.map((r) => r.userId);

    if (userIds.length === 0) {
      await recordJobHeartbeat(heartbeatJobName);
      return 0;
    }

    const userRows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const prefRows = await db
      .select()
      .from(mirrorDigestPrefsTable)
      .where(inArray(mirrorDigestPrefsTable.userId, userIds));
    const prefByUser = new Map(prefRows.map((p) => [p.userId, p]));

    const tokenRows = await db
      .select({ userId: pushTokensTable.userId, token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(inArray(pushTokensTable.userId, userIds));
    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows) {
      const list = tokensByUser.get(row.userId) ?? [];
      list.push(row.token);
      tokensByUser.set(row.userId, list);
    }

    const threshold = await readinessThreshold();
    let sent = 0;
    const pushMessages: {
      to: string;
      title: string;
      body: string;
      sound: "default";
      data: Record<string, unknown>;
    }[] = [];

    for (const userId of userIds) {
      const user = userById.get(userId);
      if (!user?.email) continue;

      const pref = prefByUser.get(userId);
      const frequency = normalizeFrequency(pref?.frequency);
      const days = cadenceDays(frequency);
      if (days === null) continue; // opted out

      const lastSentMs = toMs(pref?.lastSentAt ?? null);
      if (lastSentMs !== null && now - lastSentMs < days * DAY_MS) continue;

      try {
      const readiness = await computeReadiness(userId);
      const eligible = readiness.score >= threshold;
      const outcome = await computeOutcomeInsightForUser(userId);
      const nextActions = computeNextActions(
        readiness.breakdown,
        eligible,
        3,
        readiness.weights,
      );
      const portrait = buildMirrorPortrait({
        breakdown: readiness.breakdown,
        score: readiness.score,
        eligible,
        threshold,
        nextActions,
        outcome,
      });

      const previousBreakdown =
        (pref?.lastBreakdown as Record<string, number> | null) ?? null;
      const digest = buildMirrorDigest({
        portrait,
        previousScore: pref?.lastScore ?? null,
        previousBreakdown,
        cadenceLabel: cadenceLabel(frequency),
      });

      const intro = await warmIntro(userId, digest);

      await sendMail({
        to: user.email,
        subject: digest.subject,
        text: renderText(intro, digest),
        html: renderHtml(intro, digest),
      });

      // Companion push (best-effort) to any valid tokens.
      const tokens = tokensByUser.get(userId) ?? [];
      for (const token of tokens) {
        if (await isValidExpoPushToken(token)) {
          pushMessages.push({
            to: token,
            title: digest.subject,
            body: digest.nudge ?? digest.scoreLine,
            sound: "default",
            data: { type: "mirror-digest" },
          });
        }
      }

      await db
        .insert(mirrorDigestPrefsTable)
        .values({
          userId,
          frequency,
          lastSentAt: new Date(now),
          lastScore: readiness.score,
          lastBreakdown: readiness.breakdown as unknown as Record<string, number>,
          updatedAt: new Date(now),
        })
        .onConflictDoUpdate({
          target: mirrorDigestPrefsTable.userId,
          set: {
            lastSentAt: new Date(now),
            lastScore: readiness.score,
            lastBreakdown: readiness.breakdown as unknown as Record<string, number>,
            updatedAt: new Date(now),
          },
        });
      sent += 1;
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "mirror digest failed for one user; continuing with the rest",
        );
      }
    }

    if (pushMessages.length > 0) {
      await sendExpoPushNotifications(pushMessages);
    }

    await recordJobHeartbeat(heartbeatJobName);
    if (sent > 0) {
      logger.info({ digestsSent: sent }, "Sent mirror digests");
    } else {
      logger.debug("No mirror digests due");
    }
    return sent;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to send mirror digests",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startMirrorDigestJob(): void {
  if (scheduledTimer) return;
  if (!digestEnabled()) {
    logger.info(
      "Mirror digest job disabled (set MIRROR_DIGEST_ENABLED=true to enable)",
    );
    return;
  }

  const intervalHours = readPositiveNumberEnv(
    "MIRROR_DIGEST_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void sendMirrorDigests();

  scheduledTimer = setInterval(() => {
    void sendMirrorDigests();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info({ intervalHours }, "Started mirror digest job");
}

export function stopMirrorDigestJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
