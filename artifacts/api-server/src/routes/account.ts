import crypto from "crypto";
import { Router, type IRouter, type Request } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  sessionsTable,
  dataExportTokensTable,
} from "@workspace/db";
import {
  ExportMyDataResponse,
  DeleteMyAccountResponse,
  GetAccountSummaryResponse,
  EmailMyDataExportResponse,
} from "@workspace/api-zod";
import { clearSession, getSessionId, SESSION_COOKIE } from "../lib/auth";
import { sendMail } from "../lib/mailer";

const router: IRouter = Router();

const EXPORT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

router.get("/account/summary", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;

  const [audits, profiles, messages, insights] = await Promise.all([
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
  ]);

  res.json(
    GetAccountSummaryResponse.parse({
      audits: audits[0]?.n ?? 0,
      profiles: profiles[0]?.n ?? 0,
      messages: messages[0]?.n ?? 0,
      insights: insights[0]?.n ?? 0,
    }),
  );
});

async function buildExportPayload(userId: string) {
  const [userRow, audits, profiles, messages, insights] = await Promise.all([
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
  });
}

router.get("/account/export", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const payload = await buildExportPayload(req.user.id);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const filename = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
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
      res.status(404).json({ error: "Invalid or expired link." });
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
      res.status(404).json({ error: "Invalid or expired link." });
      return;
    }

    const payload = await buildExportPayload(row.userId);
    if (!payload) {
      res.status(404).json({ error: "Invalid or expired link." });
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
  },
);

router.delete("/account", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;

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
