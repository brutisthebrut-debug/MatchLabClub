import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  auditsTable,
  profilesTable,
  messageCoachingSessionsTable,
  emailInsightsTable,
  sessionsTable,
} from "@workspace/db";
import {
  ExportMyDataResponse,
  DeleteMyAccountResponse,
} from "@workspace/api-zod";
import { clearSession, getSessionId, SESSION_COOKIE } from "../lib/auth";

const router: IRouter = Router();

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

router.get("/account/export", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.user.id;

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
  if (!u) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const payload = ExportMyDataResponse.parse({
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

  const filename = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  res.send(JSON.stringify(payload, null, 2));
});

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
