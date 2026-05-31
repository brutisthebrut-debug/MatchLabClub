import crypto from "crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  auditsTable,
  auditReportVersionsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  sessionsTable,
  dataExportTokensTable,
  lifePulsesTable,
  journalEntriesTable,
  postDateNotesTable,
  wellnessAnswersTable,
  wellnessTagsTable,
  compatibilityReadsTable,
  importedSourcesTable,
  waitlistTable,
  coachFollowUpsTable,
  loginNotificationsTable,
  pushTokensTable,
  referralsTable,
  purchaseInterestTable,
  aiUsageCountersTable,
  matchPreferencesTable,
  matchPoolMembershipTable,
  matchProposalsTable,
  datingWinsTable,
  matchingReadinessSnapshotsTable,
  matchingNudgeStateTable,
  mirrorDigestPrefsTable,
} from "@workspace/db";
import {
  ExportMyDataResponse,
  DeleteMyAccountResponse,
  DeleteMyAccountConfirmedBody,
  DeleteMyAccountConfirmedResponse,
  GetAccountSummaryResponse,
  EmailMyDataExportResponse,
  ListMySessionsResponse,
  RevokeOtherSessionsResponse,
  RevokeOneSessionResponse,
  GetAiContentConsentResponse,
  SetAiContentConsentBody,
  SetAiContentConsentResponse,
  GetMeConsentResponse,
  GetDigestPreferencesResponse,
  SetDigestPreferencesBody,
  SetDigestPreferencesResponse,
} from "@workspace/api-zod";
import { clearSession, getSessionId, SESSION_COOKIE } from "../lib/auth";
import { describeUserAgent } from "../lib/userAgent";
import { describeIpLocation } from "../lib/geoLocation";
import { sendMail } from "../lib/mailer";
import { originFor, sendExpiredLink } from "../lib/expiredLinkPage";

const router: IRouter = Router();

const EXPORT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function getOrigin(req: Request): string {
  return originFor(req);
}

function sendExpiredExport(req: Request, res: import("express").Response): void {
  sendExpiredLink(req, res, {
    pageTitle: "Export link expired, MatchLab Club",
    heading: "This export link can&rsquo;t be used anymore",
    bodyParagraphs: [
      "Data export links are single-use and expire after 30 minutes for your security. This one has either already been opened, expired, or we don&rsquo;t recognize it.",
      "No worries &mdash; you can request a fresh export link from your account page anytime.",
    ],
    ctaLabel: "Request a new export link",
    ctaUrl: `${getOrigin(req)}/account`,
    jsonError: "Invalid or expired link.",
    jsonStatus: 404,
  });
}

router.get("/account/sessions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const callerSid = getSessionId(req);

  const now = new Date();
  const rows = await db
    .select({
      sid: sessionsTable.sid,
      createdAt: sessionsTable.createdAt,
      lastSeenAt: sessionsTable.lastSeenAt,
      expire: sessionsTable.expire,
      userAgent: sessionsTable.userAgent,
      ip: sessionsTable.ip,
      channel: sessionsTable.channel,
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, userId),
        gt(sessionsTable.expire, now),
      ),
    )
    .orderBy(desc(sessionsTable.lastSeenAt));

  res.json(
    ListMySessionsResponse.parse({
      sessions: rows.map((r) => ({
        sid: r.sid,
        createdAt: toIso(r.createdAt),
        lastSeenAt: toIso(r.lastSeenAt),
        expiresAt: toIso(r.expire),
        userAgent: r.userAgent,
        deviceLabel: describeUserAgent(r.userAgent),
        ip: r.ip,
        ipLocation: describeIpLocation(r.ip),
        channel:
          r.channel === "web" || r.channel === "mobile" ? r.channel : null,
        current: r.sid === callerSid,
      })),
    }),
  );
});

router.delete("/account/sessions", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const callerSid = getSessionId(req);

  const deleted = await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, userId),
        callerSid
          ? ne(sessionsTable.sid, callerSid)
          : sql`true`,
      ),
    )
    .returning({ sid: sessionsTable.sid });

  req.log.info(
    { userId, revoked: deleted.length },
    "Revoked other sessions for user",
  );

  res.json(
    RevokeOtherSessionsResponse.parse({
      success: true,
      revoked: deleted.length,
    }),
  );
});

router.delete("/account/sessions/:sid", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const targetSid = req.params["sid"];
  if (typeof targetSid !== "string" || targetSid.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const deleted = await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.sid, targetSid),
        eq(sessionsTable.userId, userId),
      ),
    )
    .returning({ sid: sessionsTable.sid });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // If the user revoked their own session, also clear the cookie so the
  // next request looks signed-out instead of waiting for the next round-trip.
  if (targetSid === getSessionId(req)) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  req.log.info(
    { userId, targetSid },
    "Revoked a single session for user",
  );

  res.json(
    RevokeOneSessionResponse.parse({
      success: true,
      revoked: deleted.length,
    }),
  );
});

router.get("/account/summary", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;

  const [audits, profiles, messages, insights, journalEntries, postDateNotes] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditsTable)
      .where(eq(auditsTable.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailInsightsTable)
      .where(eq(emailInsightsTable.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postDateNotesTable)
      .where(eq(postDateNotesTable.userId, userId)),
  ]);

  res.json(
    GetAccountSummaryResponse.parse({
      journalEntries: journalEntries[0]?.n ?? 0,
      postDateNotes: postDateNotes[0]?.n ?? 0,
      audits: audits[0]?.n ?? 0,
      profiles: profiles[0]?.n ?? 0,
      messages: messages[0]?.n ?? 0,
      insights: insights[0]?.n ?? 0,
    }),
  );
});

async function buildExportPayload(userId: string) {
  const [userRow, audits, profiles, messages, insights, journalEntries, postDateNotes] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.userId, userId))
      .orderBy(auditsTable.createdAt),
    db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .orderBy(profilesTable.createdAt),
    db
      .select()
      .from(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId))
      .orderBy(messageCoachingSessionsTable.createdAt),
    db
      .select()
      .from(emailInsightsTable)
      .where(eq(emailInsightsTable.userId, userId))
      .orderBy(emailInsightsTable.createdAt),
    db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .orderBy(journalEntriesTable.createdAt),
    db
      .select()
      .from(postDateNotesTable)
      .where(eq(postDateNotesTable.userId, userId))
      .orderBy(postDateNotesTable.createdAt),
  ]);

  const u = userRow[0];
  if (!u) return null;

  return ExportMyDataResponse.parse({
    exportedAt: new Date().toISOString(),
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      createdAt: toIso(u.createdAt),
    },
    audits: audits.map((a) => ({ ...a, createdAt: toIso(a.createdAt) })),
    profiles: profiles.map((p) => ({ ...p, createdAt: toIso(p.createdAt) })),
    messages: messages.map((m) => ({ ...m, createdAt: toIso(m.createdAt) })),
    insights: insights.map((i) => ({ ...i, createdAt: toIso(i.createdAt) })),
    journalEntries: journalEntries.map((j) => ({
      ...j,
      tags: j.tags ?? [],
      createdAt: toIso(j.createdAt),
      updatedAt: toIso(j.updatedAt),
      deletedAt: j.deletedAt ? toIso(j.deletedAt) : null,
    })),
    postDateNotes: postDateNotes.map((p) => ({
      ...p,
      dateAt: p.dateAt ? toIso(p.dateAt) : null,
      whatWentWell: p.whatWentWell ?? "",
      whatDidnt: p.whatDidnt ?? "",
      followUpPlanned: Boolean(p.followUpPlanned),
      createdAt: toIso(p.createdAt),
      updatedAt: toIso(p.updatedAt),
      deletedAt: p.deletedAt ? toIso(p.deletedAt) : null,
    })),
  });
}

async function sendExportReceiptEmail(
  to: string,
  firstName: string | null | undefined,
  method: "direct download" | "emailed link",
): Promise<void> {
  const name = firstName?.trim() || "there";
  const when = new Date().toUTCString();
  const text = [
    `Hi ${name},`,
    "",
    `This is a receipt confirming that a copy of your MatchLab Club data was just exported (${method}).`,
    `When: ${when}`,
    "",
    "If you made this request, no action is needed.",
    "If you didn't, please sign in and change your password, someone else may",
    "have access to your account.",
    "",
    "MatchLab Club",
  ].join("\n");
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${name},</p>
    <p>This is a receipt confirming that a copy of your <strong>MatchLab Club</strong> data was just exported (${method}).</p>
    <p style="font-size: 13px; color: #666;"><strong>When:</strong> ${when}</p>
    <p>If you made this request, no action is needed.</p>
    <p style="font-size: 13px; color: #666;">
      If you didn't, please sign in and change your password, someone else may have access to your account.
    </p>
  </body>
</html>`;
  await sendMail({
    to,
    subject: "Your MatchLab Club data was exported",
    text,
    html,
  });
}

router.get("/account/export", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;
  const payload = await buildExportPayload(userId);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const filename = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));

  // Best-effort export receipt email, don't fail the download if it errors.
  if (payload.user.email) {
    try {
      await sendExportReceiptEmail(
        payload.user.email,
        payload.user.firstName,
        "direct download",
      );
    } catch (err) {
      req.log.error({ err, userId }, "Failed to send export receipt email");
    }
  }
});

router.post("/account/export/email", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;
  const userRow = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const u = userRow[0];
  if (!u) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!u.email) {
    res.status(400).json({
      error: "No email address on file for this account.",
    });
    return;
  }

  // Invalidate any outstanding unused tokens for this user so the latest
  // emailed link is the only live one.
  await db
    .delete(dataExportTokensTable)
    .where(
      and(
        eq(dataExportTokensTable.userId, userId),
        isNull(dataExportTokensTable.usedAt),
      ),
    );

  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPORT_TOKEN_TTL_MS);

  await db.insert(dataExportTokensTable).values({
    token,
    userId,
    expiresAt,
  });

  const origin = getOrigin(req);
  const downloadUrl = `${origin}/api/account/export/download/${token}`;
  const expiresMinutes = Math.round(EXPORT_TOKEN_TTL_MS / 60000);
  const firstName = u.firstName?.trim() || "there";

  const text = [
    `Hi ${firstName},`,
    "",
    "You asked MatchLab Club to email you a copy of your data.",
    "Use the secure link below to download your full export as JSON:",
    "",
    downloadUrl,
    "",
    `This link is single-use and expires in about ${expiresMinutes} minutes.`,
    "If you didn't request this, you can safely ignore this email, the link",
    "won't reveal anything until someone visits it, and it will expire on its own.",
    "",
    "MatchLab Club",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${firstName},</p>
    <p>You asked <strong>MatchLab Club</strong> to email you a copy of your data.</p>
    <p>
      <a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#7a4fb8;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">
        Download my data
      </a>
    </p>
    <p style="font-size: 13px; color: #666;">
      This link is single-use and expires in about ${expiresMinutes} minutes.
      If you didn't request this, you can safely ignore this email.
    </p>
    <p style="font-size: 13px; color: #666;">
      Or copy and paste this URL into your browser:<br/>
      <span style="word-break: break-all;">${downloadUrl}</span>
    </p>
  </body>
</html>`;

  try {
    await sendMail({
      to: u.email,
      subject: "Your MatchLab Club data export",
      text,
      html,
    });
  } catch (err) {
    req.log.error({ err, userId }, "Failed to email data export link");
    // Remove the token so the user can try again cleanly.
    await db
      .delete(dataExportTokensTable)
      .where(eq(dataExportTokensTable.token, token));
    res.status(500).json({ error: "Couldn't send the export email." });
    return;
  }

  req.log.info({ userId, expiresAt }, "Emailed data export link");

  res.json(
    EmailMyDataExportResponse.parse({
      success: true,
      expiresAt: expiresAt.toISOString(),
      sentTo: u.email,
    }),
  );
});

router.get(
  "/account/export/download/:token",
  async (req, res): Promise<void> => {
    const raw = req.params["token"];
    if (typeof raw !== "string" || !/^[a-f0-9]{32,128}$/.test(raw)) {
      sendExpiredExport(req, res);
      return;
    }

    const now = new Date();
    const rows = await db
      .update(dataExportTokensTable)
      .set({ usedAt: now })
      .where(
        and(
          eq(dataExportTokensTable.token, raw),
          isNull(dataExportTokensTable.usedAt),
          gt(dataExportTokensTable.expiresAt, now),
        ),
      )
      .returning({ userId: dataExportTokensTable.userId });

    const row = rows[0];
    if (!row) {
      sendExpiredExport(req, res);
      return;
    }

    const payload = await buildExportPayload(row.userId);
    if (!payload) {
      sendExpiredExport(req, res);
      return;
    }

    req.log.info({ userId: row.userId }, "Served emailed data export");

    const filename = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(JSON.stringify(payload, null, 2));

    if (payload.user.email) {
      try {
        await sendExportReceiptEmail(
          payload.user.email,
          payload.user.firstName,
          "emailed link",
        );
      } catch (err) {
        req.log.error(
          { err, userId: row.userId },
          "Failed to send export receipt email",
        );
      }
    }
  },
);

router.delete("/account", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;

  // Fetch the user's email/name BEFORE we delete the row so we can send a
  // confirmation receipt after the deletion completes.
  const preDeleteUser = await db
    .select({
      email: usersTable.email,
      firstName: usersTable.firstName,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const recipient = preDeleteUser[0];

  const [audits, profiles, messages, insights] = await Promise.all([
    db
      .delete(auditsTable)
      .where(eq(auditsTable.userId, userId))
      .returning({ id: auditsTable.id }),
    db
      .delete(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .returning({ id: profilesTable.id }),
    db
      .delete(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId))
      .returning({ id: messageCoachingSessionsTable.id }),
    db
      .delete(emailInsightsTable)
      .where(eq(emailInsightsTable.userId, userId))
      .returning({ id: emailInsightsTable.id }),
  ]);

  // Wellness self-ratings (Life Pulse) are first-party personal data and must
  // also be hard-deleted when the user closes their account.
  await db.delete(lifePulsesTable).where(eq(lifePulsesTable.userId, userId));

  // Mirror retention surfaces (journal entries + post-date notes) are also
  // first-party personal reflections and must be hard-deleted, including any
  // soft-deleted rows still sitting in the user's trash.
  await Promise.all([
    db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
    db.delete(postDateNotesTable).where(eq(postDateNotesTable.userId, userId)),
    db.delete(datingWinsTable).where(eq(datingWinsTable.userId, userId)),
    db
      .delete(matchingReadinessSnapshotsTable)
      .where(eq(matchingReadinessSnapshotsTable.userId, userId)),
    db
      .delete(matchingNudgeStateTable)
      .where(eq(matchingNudgeStateTable.userId, userId)),
  ]);

  // Pivot-era surfaces: wellness self-rating answers + system-derived tags,
  // compatibility compass reads, GDPR imported sources (Hinge etc.), coach
  // follow-up reminders, waitlist signup, and per-device login-notification
  // throttle rows. All are user-scoped first-party data, must go when the
  // account goes. Each is best-effort independent; one failure shouldn't
  // strand the rest.
  await Promise.all([
    db.delete(wellnessAnswersTable).where(eq(wellnessAnswersTable.userId, userId)),
    db.delete(wellnessTagsTable).where(eq(wellnessTagsTable.userId, userId)),
    db.delete(compatibilityReadsTable).where(eq(compatibilityReadsTable.userId, userId)),
    db.delete(importedSourcesTable).where(eq(importedSourcesTable.userId, userId)),
    db.delete(coachFollowUpsTable).where(eq(coachFollowUpsTable.userId, userId)),
    db.delete(waitlistTable).where(eq(waitlistTable.userId, userId)),
    db.delete(loginNotificationsTable).where(eq(loginNotificationsTable.userId, userId)),
  ]);

  // Delete every active session belonging to this user (session JSONB
  // payload stores `user.id`).
  await db
    .delete(sessionsTable)
    .where(sql`(${sessionsTable.sess} -> 'user' ->> 'id') = ${userId}`);

  await db.delete(usersTable).where(eq(usersTable.id, userId));

  // Clear the browser session cookie for this caller. clearSession would
  // also try to delete the session row, but we've already wiped sessions
  // for this user above.
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });

  req.log.info(
    {
      userId,
      deleted: {
        audits: audits.length,
        profiles: profiles.length,
        messages: messages.length,
        insights: insights.length,
      },
    },
    "Deleted user account and associated data",
  );

  if (recipient?.email) {
    const name = recipient.firstName?.trim() || "there";
    const when = new Date().toUTCString();
    const text = [
      `Hi ${name},`,
      "",
      "This is a confirmation that your MatchLab Club account has been deleted.",
      `When: ${when}`,
      "",
      "Here's a summary of what was permanently removed:",
      `  • ${audits.length} audit${audits.length === 1 ? "" : "s"}`,
      `  • ${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}`,
      `  • ${messages.length} message coaching session${messages.length === 1 ? "" : "s"}`,
      `  • ${insights.length} email insight report${insights.length === 1 ? "" : "s"}`,
      "  • Your sign-in sessions and account record",
      "",
      "If you didn't request this, please reply to this email right away,",
      "someone else may have had access to your account.",
      "",
      "Thanks for giving us a try.",
      "MatchLab Club",
    ].join("\n");
    const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${name},</p>
    <p>This is a confirmation that your <strong>MatchLab Club</strong> account has been deleted.</p>
    <p style="font-size: 13px; color: #666;"><strong>When:</strong> ${when}</p>
    <p>Here's a summary of what was permanently removed:</p>
    <ul>
      <li>${audits.length} audit${audits.length === 1 ? "" : "s"}</li>
      <li>${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}</li>
      <li>${messages.length} message coaching session${messages.length === 1 ? "" : "s"}</li>
      <li>${insights.length} email insight report${insights.length === 1 ? "" : "s"}</li>
      <li>Your sign-in sessions and account record</li>
    </ul>
    <p style="font-size: 13px; color: #666;">
      If you didn't request this, please reply to this email right away, someone else may have had access to your account.
    </p>
    <p>Thanks for giving us a try.<br/>MatchLab Club</p>
  </body>
</html>`;
    try {
      await sendMail({
        to: recipient.email,
        subject: "Your MatchLab Club account has been deleted",
        text,
        html,
      });
    } catch (err) {
      req.log.error(
        { err, userId },
        "Failed to send account deletion confirmation email",
      );
    }
  }

  res.json(
    DeleteMyAccountResponse.parse({
      success: true,
      deleted: {
        audits: audits.length,
        profiles: profiles.length,
        messages: messages.length,
        insights: insights.length,
      },
    }),
  );
});

/**
 * POST /api/me/account/delete
 *
 * GDPR-grade account delete. POST instead of DELETE because browsers and
 * some intermediaries strip request bodies from DELETE calls, and we need
 * the confirmation string in the body. The caller must be a signed-in user
 * (anon callers have no account to delete) and the body's `confirmation`
 * field must equal the caller's account email, compared case-insensitively
 * after trimming. The whole thing runs inside a single transaction so the
 * account either goes fully or not at all.
 */
router.post("/me/account/delete", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const parsed = DeleteMyAccountConfirmedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Confirmation is required to delete your account." });
    return;
  }

  // We need the user's email both to verify the confirmation string and to
  // clean up email-keyed rows (purchase_interest) further down.
  const userRow = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const userEmail = userRow[0]?.email ?? null;
  if (!userEmail) {
    res.status(400).json({
      error: "Your account has no email on file, so we can't confirm the delete.",
    });
    return;
  }
  const expected = userEmail.trim().toLowerCase();
  const provided = parsed.data.confirmation.trim().toLowerCase();
  if (provided !== expected) {
    res.status(400).json({
      error: "That didn't match your account email. Type it exactly to confirm.",
    });
    return;
  }

  const tables: Record<string, number> = {};

  try {
    await db.transaction(async (tx) => {
      // ── Children first ────────────────────────────────────────────────
      // audit_report_versions has no user_id; it's keyed by audit_id, so
      // we delete its rows for this user's audits before deleting audits.
      const auditIdRows = await tx
        .select({ id: auditsTable.id })
        .from(auditsTable)
        .where(eq(auditsTable.userId, userId));
      const auditIds = auditIdRows.map((r) => r.id);
      let auditVersionCount = 0;
      if (auditIds.length > 0) {
        const versionDel = await tx
          .delete(auditReportVersionsTable)
          .where(inArray(auditReportVersionsTable.auditId, auditIds))
          .returning({ id: auditReportVersionsTable.id });
        auditVersionCount = versionDel.length;
      }
      tables["audit_report_versions"] = auditVersionCount;

      // ── First-party user-scoped data ──────────────────────────────────
      const auditsDel = await tx
        .delete(auditsTable)
        .where(eq(auditsTable.userId, userId))
        .returning({ id: auditsTable.id });
      tables["audits"] = auditsDel.length;

      const profilesDel = await tx
        .delete(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .returning({ id: profilesTable.id });
      tables["dating_profiles"] = profilesDel.length;

      const messagesDel = await tx
        .delete(messageCoachingSessionsTable)
        .where(eq(messageCoachingSessionsTable.userId, userId))
        .returning({ id: messageCoachingSessionsTable.id });
      tables["message_coaching_sessions"] = messagesDel.length;

      const insightsDel = await tx
        .delete(emailInsightsTable)
        .where(eq(emailInsightsTable.userId, userId))
        .returning({ id: emailInsightsTable.id });
      tables["email_insights"] = insightsDel.length;

      const journalDel = await tx
        .delete(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, userId))
        .returning({ id: journalEntriesTable.id });
      tables["journal_entries"] = journalDel.length;

      const postDateDel = await tx
        .delete(postDateNotesTable)
        .where(eq(postDateNotesTable.userId, userId))
        .returning({ id: postDateNotesTable.id });
      tables["post_date_notes"] = postDateDel.length;

      const lifePulseDel = await tx
        .delete(lifePulsesTable)
        .where(eq(lifePulsesTable.userId, userId))
        .returning({ id: lifePulsesTable.id });
      tables["life_pulses"] = lifePulseDel.length;

      const wellnessAnswerDel = await tx
        .delete(wellnessAnswersTable)
        .where(eq(wellnessAnswersTable.userId, userId))
        .returning({ id: wellnessAnswersTable.id });
      tables["wellness_answers"] = wellnessAnswerDel.length;

      const wellnessTagDel = await tx
        .delete(wellnessTagsTable)
        .where(eq(wellnessTagsTable.userId, userId))
        .returning({ id: wellnessTagsTable.id });
      tables["wellness_tags"] = wellnessTagDel.length;

      const compassDel = await tx
        .delete(compatibilityReadsTable)
        .where(eq(compatibilityReadsTable.userId, userId))
        .returning({ id: compatibilityReadsTable.id });
      tables["compatibility_reads"] = compassDel.length;

      const importsDel = await tx
        .delete(importedSourcesTable)
        .where(eq(importedSourcesTable.userId, userId))
        .returning({ id: importedSourcesTable.id });
      tables["imported_sources"] = importsDel.length;

      const followUpDel = await tx
        .delete(coachFollowUpsTable)
        .where(eq(coachFollowUpsTable.userId, userId))
        .returning({ id: coachFollowUpsTable.id });
      tables["coach_follow_ups"] = followUpDel.length;

      const waitlistDel = await tx
        .delete(waitlistTable)
        .where(eq(waitlistTable.userId, userId))
        .returning({ id: waitlistTable.id });
      tables["waitlist"] = waitlistDel.length;

      const loginNotifDel = await tx
        .delete(loginNotificationsTable)
        .where(eq(loginNotificationsTable.userId, userId))
        .returning({ userId: loginNotificationsTable.userId });
      tables["login_notifications"] = loginNotifDel.length;

      const exportTokenDel = await tx
        .delete(dataExportTokensTable)
        .where(eq(dataExportTokensTable.userId, userId))
        .returning({ token: dataExportTokensTable.token });
      tables["data_export_tokens"] = exportTokenDel.length;

      const pushTokenDel = await tx
        .delete(pushTokensTable)
        .where(eq(pushTokensTable.userId, userId))
        .returning({ token: pushTokensTable.token });
      tables["push_tokens"] = pushTokenDel.length;

      // Referrals: delete every row where this user is the inviter or the
      // invitee. (FK is ON DELETE SET NULL / CASCADE respectively, but we
      // delete explicitly so the row count shows up in the response.)
      const referralDel = await tx
        .delete(referralsTable)
        .where(
          or(
            eq(referralsTable.inviterUserId, userId),
            eq(referralsTable.inviteeUserId, userId),
          ),
        )
        .returning({ id: referralsTable.id });
      tables["referrals"] = referralDel.length;

      // purchase_interest has no user_id column, it's keyed by email
      // (lowercased). The founder referrals view uses the same join key to
      // attribute paid status back to a user. We mirror that here so a
      // GDPR delete also wipes any checkout interest rows tied to this
      // user's email address.
      const purchaseDel = await tx
        .delete(purchaseInterestTable)
        .where(sql`lower(${purchaseInterestTable.email}) = ${expected}`)
        .returning({ id: purchaseInterestTable.id });
      tables["purchase_interest"] = purchaseDel.length;

      // Sessions: match both the user_id column and the session JSONB
      // payload (older sessions may only carry the JSONB form).
      const sessionDel = await tx
        .delete(sessionsTable)
        .where(
          or(
            eq(sessionsTable.userId, userId),
            sql`(${sessionsTable.sess} -> 'user' ->> 'id') = ${userId}`,
          ),
        )
        .returning({ sid: sessionsTable.sid });
      tables["sessions"] = sessionDel.length;

      // match_preferences / match_pool_membership / match_proposals have NO
      // FK to users.id (same rationale as ai_usage_counters). Explicit wipe.
      const matchPrefsDel = await tx
        .delete(matchPreferencesTable)
        .where(eq(matchPreferencesTable.userId, userId))
        .returning({ userId: matchPreferencesTable.userId });
      tables["match_preferences"] = matchPrefsDel.length;

      const matchPoolDel = await tx
        .delete(matchPoolMembershipTable)
        .where(eq(matchPoolMembershipTable.userId, userId))
        .returning({ userId: matchPoolMembershipTable.userId });
      tables["match_pool_membership"] = matchPoolDel.length;

      const matchProposalsDel = await tx
        .delete(matchProposalsTable)
        .where(
          or(
            eq(matchProposalsTable.userId, userId),
            eq(matchProposalsTable.proposedToUserId, userId),
          ),
        )
        .returning({ id: matchProposalsTable.id });
      tables["match_proposals"] = matchProposalsDel.length;

      // ai_usage_counters has NO FK to users.id (so anon traffic can bucket
      // under a sentinel without FK violations). That means user deletes do
      // not auto-cascade here; we wipe explicitly.
      const aiUsageDel = await tx
        .delete(aiUsageCountersTable)
        .where(eq(aiUsageCountersTable.userId, userId))
        .returning({ userId: aiUsageCountersTable.userId });
      tables["ai_usage_counters"] = aiUsageDel.length;

      // ── Finally the user row itself ───────────────────────────────────
      const userDel = await tx
        .delete(usersTable)
        .where(eq(usersTable.id, userId))
        .returning({ id: usersTable.id });
      tables["users"] = userDel.length;
    });
  } catch (err) {
    req.log.error({ err, userId }, "GDPR account delete failed; rolled back");
    res.status(500).json({
      error: "Couldn't delete your account. Try again in a moment.",
    });
    return;
  }

  for (const [table, count] of Object.entries(tables)) {
    req.log.info({ userId, table, count }, "GDPR delete: rows removed");
  }
  req.log.info({ userId, tables }, "GDPR account delete complete");

  // Destroy the caller's session record (best-effort; transaction already
  // wiped the row) and clear the browser session cookie.
  const sid = getSessionId(req);
  try {
    await clearSession(res, sid);
  } catch (err) {
    req.log.warn({ err, userId }, "clearSession after account delete failed");
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });

  res.json(
    DeleteMyAccountConfirmedResponse.parse({
      deleted: true,
      tables,
    }),
  );
});

/**
 * GET /api/me/consent/ai-content
 *
 * Returns the authenticated user's current AI content consent state. Used by
 * the Settings UI and as the server-side source of truth for the
 * `requireContentConsent` gate in `aiService.generate`.
 */
router.get("/me/consent/ai-content", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select({
      granted: usersTable.aiContentConsentGranted,
      grantedAt: usersTable.aiContentConsentGrantedAt,
      revokedAt: usersTable.aiContentConsentRevokedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);
  const row = rows[0];
  res.json(
    GetAiContentConsentResponse.parse({
      granted: row?.granted ?? false,
      grantedAt: row?.grantedAt ? toIso(row.grantedAt) : null,
      revokedAt: row?.revokedAt ? toIso(row.revokedAt) : null,
    }),
  );
});

/**
 * POST /api/me/consent/ai-content
 *
 * Grant or revoke account-level AI content consent. Stamps grantedAt on
 * grant and revokedAt on revoke (independently, both timestamps may be set,
 * the booleans tells us the current state). Revoke takes effect on the very
 * next consent-gated AI request via the `requireContentConsent` flag in
 * `aiService.generate`.
 */
router.post("/me/consent/ai-content", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SetAiContentConsentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const now = new Date();
  const updates: Partial<typeof usersTable.$inferInsert> = {
    aiContentConsentGranted: parsed.data.granted,
    aiContentConsentUpdatedAt: now,
    updatedAt: now,
  };
  if (parsed.data.granted) {
    updates.aiContentConsentGrantedAt = now;
  } else {
    updates.aiContentConsentRevokedAt = now;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user.id))
    .returning({
      granted: usersTable.aiContentConsentGranted,
      grantedAt: usersTable.aiContentConsentGrantedAt,
      revokedAt: usersTable.aiContentConsentRevokedAt,
    });
  req.log.info(
    { userId: req.user.id, granted: parsed.data.granted },
    "User updated AI content consent",
  );
  res.json(
    SetAiContentConsentResponse.parse({
      granted: updated?.granted ?? parsed.data.granted,
      grantedAt: updated?.grantedAt ? toIso(updated.grantedAt) : null,
      revokedAt: updated?.revokedAt ? toIso(updated.revokedAt) : null,
    }),
  );
});

/**
 * GET /api/me/consent
 *
 * Simplified consent envelope: a single boolean plus the last time it
 * changed. Sits alongside `/me/consent/ai-content` (which exposes the
 * grant/revoke timestamps separately). Used by the Self Hub toggle and any
 * future surface that just needs "is the deep AI lane on right now and
 * when did the user last decide that".
 */
router.get("/me/consent", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select({
      granted: usersTable.aiContentConsentGranted,
      updatedAt: usersTable.aiContentConsentUpdatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);
  const row = rows[0];
  res.json(
    GetMeConsentResponse.parse({
      aiContent: row?.granted ?? false,
      aiContentUpdatedAt: row?.updatedAt ? toIso(row.updatedAt) : null,
    }),
  );
});

/**
 * GET /api/me/digest-preferences
 *
 * Returns the user's chosen cadence for the proactive Mirror digest and the
 * last time one was sent. New users have no row yet and default to "weekly".
 */
router.get("/me/digest-preferences", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select({
      frequency: mirrorDigestPrefsTable.frequency,
      lastSentAt: mirrorDigestPrefsTable.lastSentAt,
    })
    .from(mirrorDigestPrefsTable)
    .where(eq(mirrorDigestPrefsTable.userId, req.user.id))
    .limit(1);
  const row = rows[0];
  res.json(
    GetDigestPreferencesResponse.parse({
      frequency: row?.frequency ?? "weekly",
      lastSentAt: row?.lastSentAt ? toIso(row.lastSentAt) : null,
    }),
  );
});

/**
 * POST /api/me/digest-preferences
 *
 * Sets the cadence for the proactive Mirror digest. "off" disables digests and
 * nudges for the account. Takes effect on the next scheduled run.
 */
router.post("/me/digest-preferences", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SetDigestPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const now = new Date();
  const [updated] = await db
    .insert(mirrorDigestPrefsTable)
    .values({
      userId: req.user.id,
      frequency: parsed.data.frequency,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mirrorDigestPrefsTable.userId,
      set: { frequency: parsed.data.frequency, updatedAt: now },
    })
    .returning({
      frequency: mirrorDigestPrefsTable.frequency,
      lastSentAt: mirrorDigestPrefsTable.lastSentAt,
    });
  req.log.info(
    { userId: req.user.id, frequency: parsed.data.frequency },
    "Updated Mirror digest preference",
  );
  res.json(
    SetDigestPreferencesResponse.parse({
      frequency: updated?.frequency ?? parsed.data.frequency,
      lastSentAt: updated?.lastSentAt ? toIso(updated.lastSentAt) : null,
    }),
  );
});

export default router;
