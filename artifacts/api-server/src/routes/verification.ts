import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userVerificationsTable,
  type UserVerificationRow,
} from "@workspace/db";
import {
  StartPhoneVerificationBody,
  CheckPhoneVerificationBody,
  CheckSelfieVerificationBody,
} from "@workspace/api-zod";
import {
  startPhoneVerification,
  checkPhoneVerification,
} from "../lib/phoneVerification";
import { isStripeConnected } from "../lib/stripeClient";
import {
  createIdentitySession,
  captureIdentityResult,
} from "../lib/identityVerification";
import { compareSelfieVision } from "../lib/aiService";

const router: IRouter = Router();

/**
 * Total tiers the verification climb can reach: phone, selfie, and government
 * ID. All three are live: phone (Twilio Verify), selfie (opt-in Claude vision
 * consistency check), and government ID and age (Stripe Identity).
 */
const TIER_TOTAL = 3;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Shape a verification row (or its absence) into the public state. We never
 * surface the phone number or any document, only which tiers cleared.
 */
function serialize(row: UserVerificationRow | undefined) {
  const phoneVerified = Boolean(row?.phoneVerified);
  const selfieVerified = Boolean(row?.selfieVerified);
  const idVerified = Boolean(row?.idVerified);
  const verifiedTiers =
    (phoneVerified ? 1 : 0) + (selfieVerified ? 1 : 0) + (idVerified ? 1 : 0);
  return {
    phoneVerified,
    phoneVerifiedAt: toIso(row?.phoneVerifiedAt),
    selfieVerified,
    selfieVerifiedAt: toIso(row?.selfieVerifiedAt),
    idVerified,
    idVerifiedAt: toIso(row?.idVerifiedAt),
    ageOver18: Boolean(row?.ageOver18),
    verifiedTiers,
    tierTotal: TIER_TOTAL,
    isVerified: verifiedTiers > 0,
  };
}

async function loadVerification(
  userId: string,
): Promise<UserVerificationRow | undefined> {
  const [row] = await db
    .select()
    .from(userVerificationsTable)
    .where(eq(userVerificationsTable.userId, userId))
    .limit(1);
  return row;
}

router.get("/me/verification", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = await loadVerification(req.user.id);
  res.json(serialize(row));
});

router.post("/me/verification/phone/start", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = StartPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await startPhoneVerification(req.user.id, parsed.data.phone);
  res.json({ sent: result.sent, transport: result.transport });
});

router.post("/me/verification/phone/check", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CheckPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await checkPhoneVerification(
    req.user.id,
    parsed.data.phone,
    parsed.data.code,
  );
  if (!result.verified) {
    const existing = await loadVerification(req.user.id);
    res.json({
      verified: false,
      transport: result.transport,
      verification: serialize(existing),
    });
    return;
  }
  // Only the result of a passed check is ever persisted: a boolean plus the
  // moment it cleared. The phone number and the code are never stored. The row
  // is created lazily on first success, then updated in place per person.
  const now = new Date();
  const [row] = await db
    .insert(userVerificationsTable)
    .values({
      userId: req.user.id,
      phoneVerified: true,
      phoneVerifiedAt: now,
    })
    .onConflictDoUpdate({
      target: userVerificationsTable.userId,
      set: {
        phoneVerified: true,
        phoneVerifiedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  res.json({
    verified: true,
    transport: result.transport,
    verification: serialize(row),
  });
});

// Start a government ID + age check through Stripe Identity. This is the
// highest-trust, opt-in premium tier. Stripe collects and holds the document;
// we store only its session id as a provider reference here, and only the
// pass/age result once it clears. Safe when Stripe is not connected: we report
// configured:false instead of erroring so the page can explain the tier is
// coming.
router.post("/me/verification/id/start", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!(await isStripeConnected())) {
    res.json({ configured: false, clientSecret: null, url: null });
    return;
  }
  try {
    const returnUrl = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]!.trim()}/verification`
      : undefined;
    const session = await createIdentitySession(req.user.id, returnUrl);
    res.json({
      configured: true,
      clientSecret: session.clientSecret,
      url: session.url,
    });
  } catch (err) {
    req.log.error({ err }, "identity.start_failed");
    res.status(502).json({ error: "Could not start ID verification" });
  }
});

// Poll Stripe for the latest status of the user's outstanding ID session and
// capture the result. The webhook captures the same outcome automatically; this
// gives the frontend an on-demand path right after the hosted flow returns.
router.post("/me/verification/id/refresh", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!(await isStripeConnected())) {
    const existing = await loadVerification(req.user.id);
    res.json({ configured: false, verification: serialize(existing) });
    return;
  }
  try {
    const row = await captureIdentityResult(req.user.id);
    res.json({ configured: true, verification: serialize(row) });
  } catch (err) {
    req.log.error({ err }, "identity.refresh_failed");
    res.status(502).json({ error: "Could not refresh ID verification" });
  }
});

// Run a soft selfie photo-match consistency check, the anti-catfish tier
// between phone and government ID. We compare a just-taken selfie against the
// member's profile photos through the opt-in Claude vision lane. This is a SOFT
// consistency check, never a liveness or identity proof. The selfie and the
// photos are read in the moment and never stored; only the result boolean, the
// moment it cleared, and the tier are persisted. The Claude read is opt-in
// behind ai_content_consent and the daily cap; when consent is off, the cap is
// hit, or the call fails, we return an honest verdict that never awards the
// tier. There is no deterministic equivalent for a face-likeness comparison, so
// the fallback is an honest "could not run" rather than a synthetic pass.
router.post(
  "/me/verification/selfie/check",
  async (req, res): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const parsed = CheckSelfieVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const result = await compareSelfieVision({
      selfie: parsed.data.selfie,
      profilePhotos: parsed.data.profilePhotos,
      userId: req.user.id,
    });

    // No live verdict: consent off, cap hit, or the call could not run. Be
    // honest, never award the tier, and leave any existing state untouched.
    if (!result.analysis) {
      const existing = await loadVerification(req.user.id);
      const fallbackReason = result.fallbackReason ?? null;
      const reason =
        fallbackReason === "consent_required"
          ? "Turn on the deep AI lane in your account to run the photo-match check. Nothing was checked or stored."
          : fallbackReason === "daily_cap_exceeded"
            ? "You have hit today's AI limit, so the photo-match check could not run. Try again tomorrow. Nothing was stored."
            : "The photo-match check could not run just now, so no tier was awarded. Please try again. Nothing was stored.";
      res.json({
        verdict: "unclear",
        reason,
        mode: "fallback",
        fallbackReason,
        verification: serialize(existing),
      });
      return;
    }

    // A live verdict ran. Only a "consistent" read awards the selfie tier; we
    // persist just the boolean and the moment it cleared, never the images.
    if (result.analysis.verdict === "consistent") {
      const now = new Date();
      const [row] = await db
        .insert(userVerificationsTable)
        .values({
          userId: req.user.id,
          selfieVerified: true,
          selfieVerifiedAt: now,
        })
        .onConflictDoUpdate({
          target: userVerificationsTable.userId,
          set: {
            selfieVerified: true,
            selfieVerifiedAt: now,
            updatedAt: now,
          },
        })
        .returning();
      res.json({
        verdict: result.analysis.verdict,
        reason: result.analysis.reason,
        mode: "live",
        fallbackReason: null,
        verification: serialize(row),
      });
      return;
    }

    // Live "inconsistent" or "unclear": report it honestly, award no tier, and
    // leave any prior verification state as it was.
    const existing = await loadVerification(req.user.id);
    res.json({
      verdict: result.analysis.verdict,
      reason: result.analysis.reason,
      mode: "live",
      fallbackReason: null,
      verification: serialize(existing),
    });
  },
);

export default router;
