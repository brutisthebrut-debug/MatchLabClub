import { Router, type IRouter } from "express";
import { db, waitlistTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import {
  JoinWaitlistBody,
  GetWaitlistStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/waitlist", async (req, res): Promise<void> => {
  const [result] = await db.select({ total: count() }).from(waitlistTable);
  const total = Number(result?.total ?? 0);
  const spotsTotal = 500;
  const spotsRemaining = Math.max(0, spotsTotal - total);
  const nextMilestone = Math.ceil((total + 1) / 50) * 50;

  res.json(GetWaitlistStatsResponse.parse({
    totalCount: total,
    spotsRemaining,
    nextMilestone,
  }));
});

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Only link a waitlist row to a user when the submitted email matches the
  // user's authenticated email claim. Anyone else who submits that email gets
  // the "already joined" response but no ownership transfer.
  const submittedEmail = parsed.data.email.trim().toLowerCase();
  const userEmail = req.user?.email?.trim().toLowerCase() ?? null;
  const emailMatchesUser = !!userEmail && userEmail === submittedEmail;

  const existing = await db.select().from(waitlistTable);
  const alreadyJoined = existing.find((e) => e.email.trim().toLowerCase() === submittedEmail);
  if (alreadyJoined) {
    if (emailMatchesUser && req.user?.id && alreadyJoined.userId !== req.user.id) {
      await db
        .update(waitlistTable)
        .set({ userId: req.user.id })
        .where(eq(waitlistTable.id, alreadyJoined.id));
    }
    const position = existing.findIndex((e) => e.email.trim().toLowerCase() === submittedEmail) + 1;
    res.status(201).json({
      ...alreadyJoined,
      userId: emailMatchesUser && req.user?.id ? req.user.id : alreadyJoined.userId,
      position,
      createdAt: alreadyJoined.createdAt instanceof Date ? alreadyJoined.createdAt.toISOString() : String(alreadyJoined.createdAt),
    });
    return;
  }

  const [entry] = await db
    .insert(waitlistTable)
    .values({ ...parsed.data, userId: emailMatchesUser && req.user?.id ? req.user.id : null })
    .returning();
  const allEntries = await db.select().from(waitlistTable);
  const position = allEntries.length;

  res.status(201).json({
    ...entry,
    position,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
  });
});

export default router;
