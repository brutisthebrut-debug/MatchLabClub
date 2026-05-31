import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, matchPoolMembershipTable } from "@workspace/db";
import { GetMyReferralsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Pool statuses we count as "active in the local pool" for the inviter's
 * reflection. These mirror `matchPoolMembershipTable.status`. "off" and
 * "paused" exist but do not count toward growing the matchable pool.
 */
const IN_POOL_STATUSES = ["building", "ready", "concierge_only"] as const;

/**
 * GET /me/referrals
 *
 * The inviter-facing half of the referral loop. It returns the user's own
 * invite code plus an honest, privacy-respecting reflection of who joined from
 * their invites and where each person sits in the matching pool.
 *
 * Attribution is read from `users.invited_by_user_id` (first-touch, stamped at
 * signup from the `mlc_ref` cookie), so this is the same source of truth the
 * founder analytics use. We never expose an invitee's email or any other
 * private field: only a display name (first name, or a neutral placeholder) and
 * a pool status, so the inviter can see who is in and their status without
 * seeing anything they should not.
 *
 * The query is intentionally a two-step merge rather than a SQL join: load the
 * invitees, then load their pool memberships with a single `inArray`, and merge
 * in JS. That keeps it readable and avoids a join.
 */
router.get("/me/referrals", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const invitees = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      invitedAt: usersTable.invitedAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.invitedByUserId, userId));

  const inviteeIds = invitees.map((i) => i.id);

  // One row per invitee at most, so a plain map keyed by user id is enough to
  // line memberships up with the people above.
  const statusByUserId = new Map<string, string>();
  if (inviteeIds.length > 0) {
    const memberships = await db
      .select({
        userId: matchPoolMembershipTable.userId,
        status: matchPoolMembershipTable.status,
      })
      .from(matchPoolMembershipTable)
      .where(inArray(matchPoolMembershipTable.userId, inviteeIds));
    for (const m of memberships) {
      if (m.userId) statusByUserId.set(m.userId, m.status);
    }
  }

  const reflected = invitees.map((invitee) => {
    const joinedAt = invitee.invitedAt ?? invitee.createdAt ?? null;
    // "joined" is the honest default: they signed up from an invite but have
    // not joined the matching pool yet.
    const status = statusByUserId.get(invitee.id) ?? "joined";
    return {
      displayName: invitee.firstName?.trim() || "A new member",
      joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
      status,
    };
  });

  // Newest first. Nulls sort last so a missing timestamp never jumps the queue.
  reflected.sort((a, b) => {
    if (a.joinedAt && b.joinedAt) return b.joinedAt.localeCompare(a.joinedAt);
    if (a.joinedAt) return -1;
    if (b.joinedAt) return 1;
    return 0;
  });

  const inPool = reflected.filter((r) =>
    (IN_POOL_STATUSES as readonly string[]).includes(r.status),
  ).length;
  const ready = reflected.filter((r) => r.status === "ready").length;

  res.json(
    GetMyReferralsResponse.parse({
      refCode: `user-${userId}`,
      sharePath: "/quizzes",
      summary: {
        joined: reflected.length,
        inPool,
        ready,
      },
      invitees: reflected,
    }),
  );
});

export default router;
