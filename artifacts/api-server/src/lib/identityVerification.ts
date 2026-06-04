import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  userVerificationsTable,
  type UserVerificationRow,
} from "@workspace/db";
import {
  getUncachableStripeClient,
  constructStripeEvent,
} from "./stripeClient";
import { logger } from "./logger";

/**
 * Government ID + age verification, the highest-trust tier of the Trust & Safety
 * pillar. It rides the existing managed Stripe integration through Stripe
 * Identity, which collects and holds the document itself. We never see or store
 * the document or image: the only things that ever reach our database are the
 * RESULT booleans (a passed check, an over-18 flag), the moment it cleared, and
 * the Stripe VerificationSession id as our provider reference.
 *
 * Like every verification tier this is SOFT: a cleared ID ranks a member a
 * little higher and earns a badge, but it never gates a match and is never
 * required. It is an opt-in premium step (Stripe Identity bills per check), not
 * something everyone is pushed through.
 */

export interface IdentitySession {
  id: string;
  /** Client secret for Stripe's embedded modal flow. */
  clientSecret: string | null;
  /** Hosted URL for the redirect flow. */
  url: string | null;
}

/**
 * Derive whether a date of birth is 18 or older as of today. We compute this
 * from Stripe's verified output in the moment and then discard the date of
 * birth: only the boolean is ever persisted.
 */
function isEighteenOrOlder(dob: {
  day: number | null;
  month: number | null;
  year: number | null;
}): boolean {
  if (dob.year == null || dob.month == null || dob.day == null) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.year;
  const monthDelta = today.getMonth() + 1 - dob.month;
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.day)) {
    age -= 1;
  }
  return age >= 18;
}

/**
 * Start a Stripe Identity verification session for a user and store our provider
 * reference (the session id) so a later poll or webhook can capture the result.
 * The row is created lazily and updated in place per person. Callers must have
 * already confirmed Stripe is connected.
 */
export async function createIdentitySession(
  userId: string,
  returnUrl?: string,
): Promise<IdentitySession> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { userId },
    // We only need the document to clear and to read date of birth for the age
    // check; a matching selfie belongs to the separate selfie tier.
    options: { document: { require_matching_selfie: false } },
    ...(returnUrl ? { return_url: returnUrl } : {}),
  });

  const now = new Date();
  await db
    .insert(userVerificationsTable)
    .values({
      userId,
      stripeVerificationSessionId: session.id,
    })
    .onConflictDoUpdate({
      target: userVerificationsTable.userId,
      set: {
        stripeVerificationSessionId: session.id,
        updatedAt: now,
      },
    });

  return {
    id: session.id,
    clientSecret: session.client_secret ?? null,
    url: session.url ?? null,
  };
}

/**
 * Apply a Stripe Identity session's outcome to the user's verification row. This
 * is the shared core used by both the on-demand poll and the webhook path. It is
 * a no-op unless the session has cleared. We read only the pass status and the
 * date of birth (to derive the over-18 flag), then store only the result.
 */
export async function applyIdentitySessionResult(
  session: Stripe.Identity.VerificationSession,
): Promise<void> {
  const userId = session.metadata?.["userId"];
  if (!userId) {
    logger.warn(
      { sessionId: session.id },
      "identityVerification.missing_user_metadata",
    );
    return;
  }
  if (session.status !== "verified") return;

  const dob = session.verified_outputs?.dob ?? null;
  const ageOver18 = dob
    ? isEighteenOrOlder({
        day: dob.day ?? null,
        month: dob.month ?? null,
        year: dob.year ?? null,
      })
    : false;

  const now = new Date();
  await db
    .insert(userVerificationsTable)
    .values({
      userId,
      idVerified: true,
      idVerifiedAt: now,
      ageOver18,
      stripeVerificationSessionId: session.id,
    })
    .onConflictDoUpdate({
      target: userVerificationsTable.userId,
      set: {
        idVerified: true,
        idVerifiedAt: now,
        ageOver18,
        stripeVerificationSessionId: session.id,
        updatedAt: now,
      },
    });
}

/**
 * Poll Stripe for the latest status of a user's outstanding ID session and apply
 * the result. Returns the (possibly updated) verification row, or the existing
 * row when there is nothing to capture. Callers must have already confirmed
 * Stripe is connected.
 */
export async function captureIdentityResult(
  userId: string,
): Promise<UserVerificationRow | undefined> {
  const [row] = await db
    .select()
    .from(userVerificationsTable)
    .where(eq(userVerificationsTable.userId, userId))
    .limit(1);

  const sessionId = row?.stripeVerificationSessionId;
  if (!sessionId || row?.idVerified) return row;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.identity.verificationSessions.retrieve(
    sessionId,
    { expand: ["verified_outputs"] },
  );
  await applyIdentitySessionResult(session);

  const [fresh] = await db
    .select()
    .from(userVerificationsTable)
    .where(eq(userVerificationsTable.userId, userId))
    .limit(1);
  return fresh ?? row;
}

/**
 * Verify and handle a Stripe webhook for the Identity flow. Returns true when
 * the event was an Identity verification-session event we captured, so the
 * caller can stop. Returns false for any other event (including a missing
 * webhook secret) so it can fall through to the normal sync processing. Throws
 * only when the signature fails to verify.
 */
export async function handleIdentityWebhook(
  payload: Buffer,
  signature: string,
): Promise<boolean> {
  const event = await constructStripeEvent(payload, signature);
  if (!event) return false;
  if (!event.type.startsWith("identity.verification_session")) return false;
  const eventObject = event.data
    .object as Stripe.Identity.VerificationSession;
  // Webhook payloads never include verified_outputs (it must be expanded), so
  // re-retrieve the session to read the date of birth for the age check.
  // Without this the webhook would store idVerified=true with ageOver18 stuck
  // at false. We still read the DOB in the moment and persist only the result.
  const stripe = await getUncachableStripeClient();
  const session = await stripe.identity.verificationSessions.retrieve(
    eventObject.id,
    { expand: ["verified_outputs"] },
  );
  await applyIdentitySessionResult(session);
  return true;
}
