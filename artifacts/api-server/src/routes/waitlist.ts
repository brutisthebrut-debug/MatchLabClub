import { Router, type IRouter } from "express";
import { db, waitlistTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import {
  JoinWaitlistBody,
  GetWaitlistStatsResponse,
} from "@workspace/api-zod";
import { sendMail } from "../lib/mailer";

const router: IRouter = Router();

async function sendWaitlistWelcomeEmail(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  to: string,
  position: number,
): Promise<void> {
  const subject = "You're on the Next Level Dating Club waitlist 🎉";
  const text = `Welcome to Next Level Dating Club!

Thanks for joining the waitlist — you're #${position} in line.

As an early listener, here's what you've locked in:
  • Founding-member pricing when we open paid plans
  • Priority access to new coaching tools as they ship
  • A free profile audit the moment your spot opens
  • Behind-the-scenes updates from the podcast crew

We'll email you the moment your spot is ready. In the meantime, keep an eye out for podcast-exclusive perks and bonus episodes.

— The Next Level Dating Club team
`;
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 0 0 12px;">You're on the list.</h1>
    <p>Thanks for joining the <strong>Next Level Dating Club</strong> waitlist — you're <strong>#${position}</strong> in line.</p>
    <p>As an early listener, here's what you've locked in:</p>
    <ul style="padding-left: 20px;">
      <li>Founding-member pricing when we open paid plans</li>
      <li>Priority access to new coaching tools as they ship</li>
      <li>A free profile audit the moment your spot opens</li>
      <li>Behind-the-scenes updates from the podcast crew</li>
    </ul>
    <p>We'll email you the moment your spot is ready. In the meantime, keep an eye out for podcast-exclusive perks and bonus episodes.</p>
    <p style="margin-top: 24px;">— The Next Level Dating Club team</p>
  </body>
</html>`;
  try {
    await sendMail({ to, subject, text, html });
  } catch (err) {
    req.log.error(
      { err, to },
      "Failed to send waitlist welcome email (signup still succeeded)",
    );
  }
}

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

  await sendWaitlistWelcomeEmail(req, entry.email, position);

  res.status(201).json({
    ...entry,
    position,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
  });
});

export default router;
