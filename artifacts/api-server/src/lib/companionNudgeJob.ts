import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import {
  db,
  companionStateTable,
  companionMessagesTable,
  companionCommitmentsTable,
  companionNotificationsTable,
  companionChannelPrefsTable,
  usersTable,
  jobHeartbeatsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { recordJobHeartbeat, getStaleThresholdMs } from "./jobHeartbeat";
import { sendMail } from "./mailer";
import { sendSms } from "./sms";
import { loadBrainControls } from "./brainConfig";
import {
  computeReadiness,
  readinessThreshold,
} from "../routes/matching";

const COMPANION_NUDGE_JOB = "companion_nudge";
const DEFAULT_INTERVAL_HOURS = 12;
// Per-user, per-kind cooldown so a stalled user never gets the same nudge twice
// in quick succession. We dedupe against the user's own feed, no extra table.
const DEFAULT_COOLDOWN_HOURS = 72;
// Days of silence before Echo treats a user as "gone quiet".
const DEFAULT_QUIET_DAYS = 7;
// Bound a single sweep so a large base never turns into an unbounded scan.
const MAX_USERS_PER_SWEEP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

type NudgeKind =
  | "readiness_dip"
  | "match_waiting"
  | "gone_quiet"
  | "missed_commitment";

interface PlannedNudge {
  kind: NudgeKind;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// OFF by default. Only runs when COMPANION_NUDGE_ENABLED is truthy, matching the
// rest of the proactive roadmap (auto-proposal, matching nudge, mirror digest).
export function isCompanionNudgeEnabled(): boolean {
  const raw = (process.env.COMPANION_NUDGE_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// Decide the single most important thing Echo should reach out about for one
// user, given the signals we already have. At most one nudge per user per sweep
// so Echo never stacks messages. Priority: a missed promise, then a match
// waiting, then a readiness slip, then a long silence.
function planNudge(input: {
  score: number;
  threshold: number;
  previousScore: number | null;
  missedCommitments: number;
  quiet: boolean;
}): PlannedNudge | null {
  if (input.missedCommitments > 0) {
    return {
      kind: "missed_commitment",
      title: "You told me you would do this",
      body:
        input.missedCommitments === 1
          ? "One thing you committed to is still open. No judgment, let us close it together."
          : `${input.missedCommitments} things you committed to are still open. Let us close one today.`,
      ctaHref: "/echo",
      ctaLabel: "Open Echo",
    };
  }

  if (input.score >= input.threshold) {
    return {
      kind: "match_waiting",
      title: "You are ready, let us match you",
      body: "Your readiness is past the line. People are waiting on the other side. Come take a look.",
      ctaHref: "/matching",
      ctaLabel: "See matching",
    };
  }

  if (
    input.previousScore !== null &&
    input.score < input.previousScore - 2
  ) {
    const drop = input.previousScore - input.score;
    return {
      kind: "readiness_dip",
      title: "Your readiness slipped a little",
      body: `You dropped ${drop} point${drop === 1 ? "" : "s"} since I last looked. That happens. One small move puts it back. I can show you the highest-leverage one.`,
      ctaHref: "/echo",
      ctaLabel: "Ask Echo",
    };
  }

  if (input.quiet) {
    return {
      kind: "gone_quiet",
      title: "I have not heard from you",
      body: "It has been a while. No pressure, but the more you feed me the better I get at helping you. Want to pick one thing back up?",
      ctaHref: "/echo",
      ctaLabel: "Open Echo",
    };
  }

  return null;
}

// Has Echo already sent this kind of nudge to this user inside the cooldown? If
// so we skip, which makes the whole sweep idempotent and rate-limited with no
// extra state table: the feed itself is the record.
async function recentlyNudged(
  userId: string,
  kind: NudgeKind,
  cooldownMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMs);
  const [row] = await db
    .select({ id: companionNotificationsTable.id })
    .from(companionNotificationsTable)
    .where(
      and(
        eq(companionNotificationsTable.userId, userId),
        eq(companionNotificationsTable.kind, kind),
        sql`${companionNotificationsTable.createdAt} > ${since}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function deliverOffsite(
  userId: string,
  nudge: PlannedNudge,
): Promise<void> {
  const [prefs] = await db
    .select()
    .from(companionChannelPrefsTable)
    .where(eq(companionChannelPrefsTable.userId, userId))
    .limit(1);

  // In-app is always on (the feed row we just wrote covers it). Email and SMS
  // are strictly opt-in via channel prefs, with email defaulting on.
  const emailOn = prefs?.email ?? true;
  const smsOn = prefs?.sms ?? false;

  if (emailOn) {
    const [u] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (u?.email) {
      try {
        await sendMail({
          to: u.email,
          subject: `Echo: ${nudge.title}`,
          text: `${nudge.body}\n\n${nudge.ctaLabel}: open MatchLab and head to Echo.`,
        });
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "companion_nudge.email_failed",
        );
      }
    }
  }

  if (smsOn && prefs?.phone) {
    try {
      await sendSms({
        to: prefs.phone,
        body: `Echo: ${nudge.body}`,
      });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "companion_nudge.sms_failed",
      );
    }
  }
}

/**
 * One sweep: for every engaged user (one with a companion_state row) decide the
 * single most important proactive nudge, write it to their Echo feed, and fan it
 * out to their opted-in off-site channels. Deduped per user+kind within the
 * cooldown so repeated runs never spam. Returns the number of nudges written.
 * `userIds` narrows the sweep for deterministic tests.
 */
export async function runCompanionNudgeSweep(options?: {
  jobName?: string;
  userIds?: string[];
}): Promise<number> {
  const heartbeatJobName = options?.jobName ?? COMPANION_NUDGE_JOB;
  const cooldownMs =
    readPositiveNumberEnv(
      "COMPANION_NUDGE_COOLDOWN_HOURS",
      DEFAULT_COOLDOWN_HOURS,
    ) * 60 * 60 * 1000;
  const quietMs =
    readPositiveNumberEnv("COMPANION_NUDGE_QUIET_DAYS", DEFAULT_QUIET_DAYS) *
    DAY_MS;
  const now = Date.now();

  try {
    const threshold = await readinessThreshold();

    const stateRows = await db
      .select({
        userId: companionStateTable.userId,
        lastSeenScore: companionStateTable.lastSeenScore,
      })
      .from(companionStateTable)
      .orderBy(desc(companionStateTable.updatedAt))
      .limit(MAX_USERS_PER_SWEEP);

    const targets =
      options?.userIds && options.userIds.length > 0
        ? stateRows.filter((r) => options.userIds?.includes(r.userId))
        : stateRows;

    let written = 0;
    for (const target of targets) {
      const userId = target.userId;
      try {
        const readiness = await computeReadiness(userId);

        const [missed] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(companionCommitmentsTable)
          .where(
            and(
              eq(companionCommitmentsTable.userId, userId),
              eq(companionCommitmentsTable.status, "open"),
              lt(companionCommitmentsTable.dueAt, new Date(now)),
            ),
          );

        const [lastMsg] = await db
          .select({ createdAt: companionMessagesTable.createdAt })
          .from(companionMessagesTable)
          .where(eq(companionMessagesTable.userId, userId))
          .orderBy(desc(companionMessagesTable.createdAt))
          .limit(1);
        const lastMsgMs =
          lastMsg?.createdAt instanceof Date
            ? lastMsg.createdAt.getTime()
            : lastMsg?.createdAt
              ? new Date(lastMsg.createdAt).getTime()
              : null;
        const quiet = lastMsgMs === null || now - lastMsgMs > quietMs;

        const nudge = planNudge({
          score: readiness.score,
          threshold,
          previousScore: target.lastSeenScore ?? null,
          missedCommitments: missed?.count ?? 0,
          quiet,
        });
        if (!nudge) continue;

        if (await recentlyNudged(userId, nudge.kind, cooldownMs)) continue;

        await db.insert(companionNotificationsTable).values({
          userId,
          source: "proactive",
          kind: nudge.kind,
          title: nudge.title,
          body: nudge.body,
          ctaHref: nudge.ctaHref,
          ctaLabel: nudge.ctaLabel,
        });
        written += 1;

        await deliverOffsite(userId, nudge);
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "companion_nudge.user_failed",
        );
      }
    }

    if (written > 0) {
      logger.info(
        { written, scanned: targets.length },
        "Companion nudge sweep wrote proactive notifications",
      );
    } else {
      logger.debug(
        { scanned: targets.length },
        "Companion nudge sweep found nothing to send",
      );
    }
    await recordJobHeartbeat(heartbeatJobName);
    return written;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Companion nudge sweep failed",
    );
    return 0;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

// One scheduled tick. The timer always runs; whether a sweep actually fires is
// gated on the live founder control (seeded from COMPANION_NUDGE_ENABLED), so the
// founder can flip Echo's proactivity on or off from the control center with no
// redeploy. Echo still responds on demand regardless.
export async function companionNudgeTick(): Promise<void> {
  try {
    const controls = await loadBrainControls();
    if (!controls.companionNudgeEnabled) return;
    await runCompanionNudgeSweep();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Companion nudge tick failed to read controls; skipping this run",
    );
  }
}

export function startCompanionNudgeJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "COMPANION_NUDGE_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void companionNudgeTick();

  scheduledTimer = setInterval(() => {
    void companionNudgeTick();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info(
    { intervalHours },
    "Started companion nudge job (gated by founder control)",
  );
}

export function stopCompanionNudgeJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}

export function getCompanionNudgeStaleThresholdMs(): number {
  return getStaleThresholdMs(COMPANION_NUDGE_JOB);
}

export async function getCompanionNudgeHeartbeat(): Promise<Date | null> {
  const rows = await db
    .select({ lastSuccessAt: jobHeartbeatsTable.lastSuccessAt })
    .from(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, COMPANION_NUDGE_JOB))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.lastSuccessAt instanceof Date
    ? row.lastSuccessAt
    : new Date(row.lastSuccessAt as unknown as string);
}
