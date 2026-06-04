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

const router: IRouter = Router();

/**
 * Total tiers the verification climb can reach. Only phone is implementable
 * today; selfie and government ID (Stripe Identity) are the next two tiers, so
 * the climb honestly tops out at one of three until they ship.
 */
const TIER_TOTAL = 3;

/**
 * Shape a verification row (or its absence) into the public state. We never
 * surface the phone number or any document, only which tiers cleared.
 */
function serialize(row: UserVerificationRow | undefined) {
  const phoneVerified = Boolean(row?.phoneVerified);
  const phoneVerifiedAt = row?.phoneVerifiedAt
    ? row.phoneVerifiedAt instanceof Date
      ? row.phoneVerifiedAt.toISOString()
      : String(row.phoneVerifiedAt)
    : null;
  const verifiedTiers = phoneVerified ? 1 : 0;
  return {
    phoneVerified,
    phoneVerifiedAt,
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

export default router;
