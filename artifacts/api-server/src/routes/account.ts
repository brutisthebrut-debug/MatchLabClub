import crypto from "crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  sessionsTable,
  dataExportTokensTable,
  lifePulsesTable,
  journalEntriesTable,
  postDateNotesTable,
} from "@workspace/db";
import {
  ExportMyDataResponse,
  DeleteMyAccountResponse,
  GetAccountSummaryResponse,
  EmailMyDataExportResponse,
  ListMySessionsResponse,
  RevokeOtherSessionsResponse,
  RevokeOneSessionResponse,
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
    pageTitle: "Export link expired — Next Level Dating Club",
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
    `This is a receipt confirming that a copy of your Next Level Dating Club data was just exported (${method}).`,
    `When: ${when}`,
    "",
    "If you made this request, no action is needed.",
    "If you didn't, please sign in and change your password — someone else may",
    "have access to your account.",
    "",
    "— Next Level Dating Club",
  ].join("\n");
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${name},</p>
    <p>This is a receipt confirming that a copy of your <strong>Next Level Dating Club</strong> data was just exported (${method}).</p>
    <p style="font-size: 13px; color: #666;"><strong>When:</strong> ${when}</p>
    <p>If you made this request, no action is needed.</p>
    <p style="font-size: 13px; color: #666;">
      If you didn't, please sign in and change your password — someone else may have access to your account.
    </p>
  </body>
</html>`;
  await sendMail({
    to,
    subject: "Your Next Level Dating Club data was exported",
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

  // Best-effort export receipt email — don't fail the download if it errors.
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
    "You asked Next Level Dating Club to email you a copy of your data.",
    "Use the secure link below to download your full export as JSON:",
    "",
    downloadUrl,
    "",
    `This link is single-use and expires in about ${expiresMinutes} minutes.`,
    "If you didn't request this, you can safely ignore this email — the link",
    "won't reveal anything until someone visits it, and it will expire on its own.",
    "",
    "— Next Level Dating Club",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${firstName},</p>
    <p>You asked <strong>Next Level Dating Club</strong> to email you a copy of your data.</p>
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
      subject: "Your Next Level Dating Club data export",
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
      "This is a confirmation that your Next Level Dating Club account has been deleted.",
      `When: ${when}`,
      "",
      "Here's a summary of what was permanently removed:",
      `  • ${audits.length} audit${audits.length === 1 ? "" : "s"}`,
      `  • ${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}`,
      `  • ${messages.length} message coaching session${messages.length === 1 ? "" : "s"}`,
      `  • ${insights.length} email insight report${insights.length === 1 ? "" : "s"}`,
      "  • Your sign-in sessions and account record",
      "",
      "If you didn't request this, please reply to this email right away —",
      "someone else may have had access to your account.",
      "",
      "Thanks for giving us a try.",
      "— Next Level Dating Club",
    ].join("\n");
    const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222;">
    <p>Hi ${name},</p>
    <p>This is a confirmation that your <strong>Next Level Dating Club</strong> account has been deleted.</p>
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
      If you didn't request this, please reply to this email right away — someone else may have had access to your account.
    </p>
    <p>Thanks for giving us a try.<br/>— Next Level Dating Club</p>
  </body>
</html>`;
    try {
      await sendMail({
        to: recipient.email,
        subject: "Your Next Level Dating Club account has been deleted",
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

export default router;
