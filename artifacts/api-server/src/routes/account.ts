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
  dataPermissionEventsTable,
  wellnessInferencesTable,
  wellnessTagsTable,
  compatibilityReadsTable,
  importedSourcesTable,
  waitlistTable,
  coachFollowUpsTable,
  loginNotificationsTable,
  referralsTable,
  purchaseInterestTable,
  matchProposalsTable,
  mirrorDigestPrefsTable,
  userReportsTable,
  userBlocksTable,
  matchConnectionsTable,
  connectionMessagesTable,
  leadsTable,
  userVerificationsTable,
} from "@workspace/db";
import {
  ExportMyDataResponse,
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
import {
  ACCOUNT_DELETE_USER_ID_TABLES,
  ACCOUNT_EXPORT_DIRECT_USER_ID_TABLES,
} from "../lib/accountOwnership";

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

async function exportRowsByUserId(
  tableName: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const result = await db.execute(
    sql`select * from ${sql.identifier(tableName)} where "user_id" = ${userId}`,
  );
  return (result.rows ?? []) as Record<string, unknown>[];
}

async function buildExportPayload(userId: string) {
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const u = userRows[0];
  if (!u) return null;

  const normalizedEmail = u.email?.trim().toLowerCase() ?? null;
  const [
    audits,
    profiles,
    messages,
    insights,
    journalEntries,
    postDateNotes,
    wellnessAnswers,
    dataPermissionEvents,
    directRecordEntries,
    auditReportVersions,
    matchProposals,
    matchConnections,
    connectionMessages,
    reportsFiled,
    blocksCreated,
    referrals,
    sessions,
    verifications,
    waitlistEntries,
    leads,
    purchaseInterests,
  ] = await Promise.all([
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
    db
      .select()
      .from(wellnessAnswersTable)
      .where(eq(wellnessAnswersTable.userId, userId))
      .orderBy(wellnessAnswersTable.createdAt),
    db
      .select()
      .from(dataPermissionEventsTable)
      .where(eq(dataPermissionEventsTable.userId, userId))
      .orderBy(dataPermissionEventsTable.createdAt),
    Promise.all(
      ACCOUNT_EXPORT_DIRECT_USER_ID_TABLES.map(async (tableName) => {
        const rows = await exportRowsByUserId(tableName, userId);
        return [tableName, rows] as const;
      }),
    ),
    db.execute(
      sql`
        select arv.*
        from "audit_report_versions" arv
        inner join "audits" a on a."id" = arv."audit_id"
        where a."user_id" = ${userId}
        order by arv."created_at", arv."id"
      `,
    ),
    db
      .select()
      .from(matchProposalsTable)
      .where(
        or(
          eq(matchProposalsTable.userId, userId),
          eq(matchProposalsTable.proposedToUserId, userId),
        ),
      )
      .orderBy(matchProposalsTable.createdAt),
    db
      .select()
      .from(matchConnectionsTable)
      .where(
        or(
          eq(matchConnectionsTable.userLowId, userId),
          eq(matchConnectionsTable.userHighId, userId),
        ),
      )
      .orderBy(matchConnectionsTable.createdAt),
    db.execute(
      sql`
        select cm.*
        from "connection_messages" cm
        inner join "match_connections" mc on mc."id" = cm."connection_id"
        where mc."user_low_id" = ${userId} or mc."user_high_id" = ${userId}
        order by cm."created_at", cm."id"
      `,
    ),
    db
      .select()
      .from(userReportsTable)
      .where(eq(userReportsTable.reporterUserId, userId))
      .orderBy(userReportsTable.createdAt),
    db
      .select()
      .from(userBlocksTable)
      .where(eq(userBlocksTable.blockerUserId, userId))
      .orderBy(userBlocksTable.createdAt),
    db
      .select()
      .from(referralsTable)
      .where(
        or(
          eq(referralsTable.inviterUserId, userId),
          eq(referralsTable.inviteeUserId, userId),
        ),
      )
      .orderBy(referralsTable.landedAt),
    db
      .select({
        createdAt: sessionsTable.createdAt,
        lastSeenAt: sessionsTable.lastSeenAt,
        expiresAt: sessionsTable.expire,
        userAgent: sessionsTable.userAgent,
        ip: sessionsTable.ip,
        channel: sessionsTable.channel,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, userId))
      .orderBy(sessionsTable.createdAt),
    db
      .select({
        phoneVerified: userVerificationsTable.phoneVerified,
        phoneVerifiedAt: userVerificationsTable.phoneVerifiedAt,
        selfieVerified: userVerificationsTable.selfieVerified,
        selfieVerifiedAt: userVerificationsTable.selfieVerifiedAt,
        idVerified: userVerificationsTable.idVerified,
        idVerifiedAt: userVerificationsTable.idVerifiedAt,
        ageOver18: userVerificationsTable.ageOver18,
        createdAt: userVerificationsTable.createdAt,
        updatedAt: userVerificationsTable.updatedAt,
      })
      .from(userVerificationsTable)
      .where(eq(userVerificationsTable.userId, userId)),
    db
      .select()
      .from(waitlistTable)
      .where(
        normalizedEmail
          ? or(
              eq(waitlistTable.userId, userId),
              sql`lower(${waitlistTable.email}) = ${normalizedEmail}`,
            )
          : eq(waitlistTable.userId, userId),
      )
      .orderBy(waitlistTable.createdAt),
    normalizedEmail
      ? db
          .select()
          .from(leadsTable)
          .where(sql`lower(${leadsTable.email}) = ${normalizedEmail}`)
          .orderBy(leadsTable.createdAt)
      : Promise.resolve([]),
    normalizedEmail
      ? db
          .select()
          .from(purchaseInterestTable)
          .where(
            sql`lower(${purchaseInterestTable.email}) = ${normalizedEmail}`,
          )
          .orderBy(purchaseInterestTable.createdAt)
      : Promise.resolve([]),
  ]);

  const records: Record<string, unknown[]> =
    Object.fromEntries(directRecordEntries);
  records["audit_report_versions"] = auditReportVersions.rows ?? [];
  records["match_proposals"] = matchProposals;
  records["match_connections"] = matchConnections;
  records["connection_messages"] = connectionMessages.rows ?? [];
  records["user_reports_filed"] = reportsFiled;
  records["user_blocks_created"] = blocksCreated;
  records["referrals"] = referrals;
  records["account_sessions"] = sessions;
  records["user_verifications"] = verifications;
  records["waitlist"] = waitlistEntries;
  records["leads"] = leads;
  records["purchase_interest"] = purchaseInterests;

  return ExportMyDataResponse.parse({
    exportedAt: new Date().toISOString(),
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      role: u.role === "founder" ? "founder" : "member",
      aiContentConsentGranted: u.aiContentConsentGranted,
      aiContentConsentGrantedAt: u.aiContentConsentGrantedAt
        ? toIso(u.aiContentConsentGrantedAt)
        : null,
      aiContentConsentRevokedAt: u.aiContentConsentRevokedAt
        ? toIso(u.aiContentConsentRevokedAt)
        : null,
      aiContentConsentUpdatedAt: u.aiContentConsentUpdatedAt
        ? toIso(u.aiContentConsentUpdatedAt)
        : null,
      tier: u.tier,
      tierGrantedAt: u.tierGrantedAt ? toIso(u.tierGrantedAt) : null,
      tierSource: u.tierSource,
      createdAt: toIso(u.createdAt),
      updatedAt: toIso(u.updatedAt),
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
    wellnessAnswers: wellnessAnswers.map((answer) => ({
      id: answer.id,
      questionId: answer.questionId,
      dimension: answer.dimension,
      category: answer.category,
      questionText: answer.questionText,
      answer: answer.answer,
      consentLevel: answer.consentLevel,
      permissions: {
        echo: answer.echoUseApproved,
        mirror: answer.mirrorConfirmed,
        matching: answer.matchingUseApproved,
        research: answer.researchUseApproved,
      },
      permissionUpdatedAt: answer.permissionUpdatedAt
        ? toIso(answer.permissionUpdatedAt)
        : null,
      deletedAt: answer.deletedAt ? toIso(answer.deletedAt) : null,
      createdAt: toIso(answer.createdAt),
      updatedAt: toIso(answer.updatedAt),
    })),
    dataPermissionEvents: dataPermissionEvents.map((event) => ({
      ...event,
      createdAt: toIso(event.createdAt),
    })),
    records,
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

      // ── Every table with a user_id column ──────────────────────────────
      // ACCOUNT_DELETE_USER_ID_TABLES is compared with the live Drizzle
      // schema in accountOwnership.test.ts. A new user-owned table therefore
      // fails CI until it is part of this transaction.
      for (const tableName of ACCOUNT_DELETE_USER_ID_TABLES) {
        const result = await tx.execute(
          sql`
            delete from ${sql.identifier(tableName)}
            where "user_id" = ${userId}
          `,
        );
        tables[tableName] = result.rowCount ?? 0;
      }

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

      // Email-only signup and checkout rows can predate the account, so they
      // do not always carry user_id. The verified account email is the
      // canonical ownership key for these older records.
      const [purchaseDel, leadDel, waitlistEmailDel] = await Promise.all([
        tx
          .delete(purchaseInterestTable)
          .where(sql`lower(${purchaseInterestTable.email}) = ${expected}`)
          .returning({ id: purchaseInterestTable.id }),
        tx
          .delete(leadsTable)
          .where(sql`lower(${leadsTable.email}) = ${expected}`)
          .returning({ id: leadsTable.id }),
        tx
          .delete(waitlistTable)
          .where(sql`lower(${waitlistTable.email}) = ${expected}`)
          .returning({ id: waitlistTable.id }),
      ]);
      tables["purchase_interest"] = purchaseDel.length;
      tables["leads"] = leadDel.length;
      tables["waitlist"] =
        (tables["waitlist"] ?? 0) + waitlistEmailDel.length;

      // The registry removes sessions with a modern user_id. This catches
      // older Replit sessions that only identify the member inside JSONB.
      const legacySessionDel = await tx
        .delete(sessionsTable)
        .where(sql`(${sessionsTable.sess} -> 'user' ->> 'id') = ${userId}`)
        .returning({ sid: sessionsTable.sid });
      tables["sessions"] =
        (tables["sessions"] ?? 0) + legacySessionDel.length;

      // The registry removes proposal rows created for this user. A proposal
      // can also point at the user from another member's row, so wipe that
      // direction explicitly.
      const receivedProposalDel = await tx
        .delete(matchProposalsTable)
        .where(eq(matchProposalsTable.proposedToUserId, userId))
        .returning({ id: matchProposalsTable.id });
      tables["match_proposals"] =
        (tables["match_proposals"] ?? 0) + receivedProposalDel.length;

      // Trust & Safety records: reports the user filed or received, and blocks
      // in either direction. Mirrors the live delete so both GDPR paths wipe
      // every table, including the block rows the report-and-block flow writes.
      const reportsDel = await tx
        .delete(userReportsTable)
        .where(
          or(
            eq(userReportsTable.reporterUserId, userId),
            eq(userReportsTable.reportedUserId, userId),
          ),
        )
        .returning({ id: userReportsTable.id });
      tables["user_reports"] = reportsDel.length;

      const blocksDel = await tx
        .delete(userBlocksTable)
        .where(
          or(
            eq(userBlocksTable.blockerUserId, userId),
            eq(userBlocksTable.blockedUserId, userId),
          ),
        )
        .returning({ id: userBlocksTable.id });
      tables["user_blocks"] = blocksDel.length;

      // Match connections + their message threads. Same two-step wipe as the
      // live delete: clear all messages in any connection this user is a party
      // to, then the connection rows. Counterpart messages would otherwise be
      // orphaned, so they go too.
      const ownConnRows = await tx
        .select({ id: matchConnectionsTable.id })
        .from(matchConnectionsTable)
        .where(
          or(
            eq(matchConnectionsTable.userLowId, userId),
            eq(matchConnectionsTable.userHighId, userId),
          ),
        );
      if (ownConnRows.length > 0) {
        const connIds = ownConnRows.map((c) => c.id);
        const msgDel = await tx
          .delete(connectionMessagesTable)
          .where(inArray(connectionMessagesTable.connectionId, connIds))
          .returning({ id: connectionMessagesTable.id });
        tables["connection_messages"] = msgDel.length;
        const connDel = await tx
          .delete(matchConnectionsTable)
          .where(inArray(matchConnectionsTable.id, connIds))
          .returning({ id: matchConnectionsTable.id });
        tables["match_connections"] = connDel.length;
      } else {
        tables["connection_messages"] = 0;
        tables["match_connections"] = 0;
      }

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
