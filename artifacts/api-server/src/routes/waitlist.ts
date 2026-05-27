import { Router, type IRouter } from "express";
import { db, waitlistTable } from "@workspace/db";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  JoinWaitlistBody,
  GetWaitlistStatsResponse,
} from "@workspace/api-zod";
import { sendMail } from "../lib/mailer";
import { requireFounder } from "../middlewares/founderAuth";

const router: IRouter = Router();

async function sendWaitlistWelcomeEmail(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  to: string,
  position: number,
): Promise<void> {
  const subject = "You're on the MatchLab Club waitlist 🎉";
  const text = `Welcome to MatchLab Club!

Thanks for joining the waitlist — you're #${position} in line.

As an early listener, here's what you've locked in:
  • Founding-member pricing when we open paid plans
  • Priority access to new coaching tools as they ship
  • A free profile audit the moment your spot opens
  • Behind-the-scenes updates from the podcast crew

We'll email you the moment your spot is ready. In the meantime, keep an eye out for podcast-exclusive perks and bonus episodes.

— The MatchLab Club team
`;
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 0 0 12px;">You're on the list.</h1>
    <p>Thanks for joining the <strong>MatchLab Club</strong> waitlist — you're <strong>#${position}</strong> in line.</p>
    <p>As an early listener, here's what you've locked in:</p>
    <ul style="padding-left: 20px;">
      <li>Founding-member pricing when we open paid plans</li>
      <li>Priority access to new coaching tools as they ship</li>
      <li>A free profile audit the moment your spot opens</li>
      <li>Behind-the-scenes updates from the podcast crew</li>
    </ul>
    <p>We'll email you the moment your spot is ready. In the meantime, keep an eye out for podcast-exclusive perks and bonus episodes.</p>
    <p style="margin-top: 24px;">— The MatchLab Club team</p>
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

function getAppBaseUrl(): string {
  const explicit = process.env["APP_BASE_URL"]?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const domains = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (domains) return `https://${domains}`;
  return "https://nextleveldatingclub.com";
}

async function sendWaitlistActivationEmail(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  to: string,
  firstName: string,
): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const claimUrl = `${baseUrl}/?welcome=1&from=waitlist`;
  const subject = "You're in — your MatchLab Club spot just opened 🎉";
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi there,";
  const text = `${greeting}

Great news — your spot in the MatchLab Club is ready.

Claim your access and run your first free profile audit here:
${claimUrl}

What's waiting for you as an early listener:
  • A free, founder-tier profile audit
  • Founding-member pricing on paid plans
  • Priority access to new coaching tools
  • Podcast-exclusive bonus content

If the link above doesn't work, paste it into your browser. This email was sent because you joined the waitlist — if that wasn't you, just ignore it.

— The MatchLab Club team
`;
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #222; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; margin: 0 0 12px;">You're in.</h1>
    <p>${greeting.replace(/,$/, "")} — your spot in the <strong>MatchLab Club</strong> just opened.</p>
    <p style="margin: 24px 0;">
      <a href="${claimUrl}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-weight: 600;">Claim your spot</a>
    </p>
    <p>What's waiting for you as an early listener:</p>
    <ul style="padding-left: 20px;">
      <li>A free, founder-tier profile audit</li>
      <li>Founding-member pricing on paid plans</li>
      <li>Priority access to new coaching tools</li>
      <li>Podcast-exclusive bonus content</li>
    </ul>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">If the button doesn't work, copy this link: ${claimUrl}</p>
    <p style="margin-top: 24px;">— The MatchLab Club team</p>
  </body>
</html>`;
  try {
    await sendMail({ to, subject, text, html });
    return true;
  } catch (err) {
    req.log.error(
      { err, to },
      "Failed to send waitlist activation email (activation still recorded)",
    );
    return false;
  }
}

const ActivateWaitlistBody = z
  .object({
    id: z.number().int().positive().optional(),
    email: z.string().email().optional(),
    resend: z.boolean().optional(),
  })
  .refine((v) => v.id !== undefined || v.email !== undefined, {
    message: "Provide either `id` or `email`.",
  });

router.post(
  "/founder/waitlist/activate",
  requireFounder,
  async (req, res): Promise<void> => {
    const parsed = ActivateWaitlistBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { id, email, resend } = parsed.data;

    const rows = id !== undefined
      ? await db.select().from(waitlistTable).where(eq(waitlistTable.id, id))
      : await db
          .select()
          .from(waitlistTable)
          .where(sql`lower(${waitlistTable.email}) = ${email!.trim().toLowerCase()}`);
    const entry = rows[0];
    if (!entry) {
      res.status(404).json({ error: "Waitlist entry not found." });
      return;
    }

    const alreadyActivated = !!entry.activatedAt;
    if (alreadyActivated && !resend) {
      res.status(200).json({
        ok: true,
        alreadyActivated: true,
        emailSent: false,
        entry: serializeEntry(entry),
      });
      return;
    }

    const now = new Date();
    const sent = await sendWaitlistActivationEmail(req, entry.email, entry.firstName);

    const [updated] = await db
      .update(waitlistTable)
      .set({
        activatedAt: entry.activatedAt ?? now,
        ...(sent ? { activationEmailSentAt: now } : {}),
      })
      .where(eq(waitlistTable.id, entry.id))
      .returning();

    res.status(200).json({
      ok: true,
      alreadyActivated,
      emailSent: sent,
      entry: serializeEntry(updated ?? entry),
    });
  },
);

function serializeEntry(entry: typeof waitlistTable.$inferSelect) {
  return {
    ...entry,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
    activatedAt: entry.activatedAt instanceof Date ? entry.activatedAt.toISOString() : entry.activatedAt,
    activationEmailSentAt:
      entry.activationEmailSentAt instanceof Date
        ? entry.activationEmailSentAt.toISOString()
        : entry.activationEmailSentAt,
  };
}

export default router;
