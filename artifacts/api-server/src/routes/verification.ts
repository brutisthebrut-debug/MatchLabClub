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

const router: IRouter = Router();

/**
 * Total tiers the verification climb can reach: phone, selfie, and government
 * ID. Phone and government ID (Stripe Identity) are live; the selfie tier is the
 * remaining one, so the climb honestly tops out at two of three until it ships.
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
  const idVerified = Boolean(row?.idVerified);
  const verifiedTiers = (phoneVerified ? 1 : 0) + (idVerified ? 1 : 0);
  return {
    phoneVerified,
    phoneVerifiedAt: toIso(row?.phoneVerifiedAt),
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

export default router;
