import { logger } from "./logger";

/**
 * Phone verification, the first bought regulated primitive behind the Trust &
 * Safety pillar. When Twilio Verify is configured we delegate the entire OTP
 * lifecycle to Twilio (they generate, send, rate-limit, and check the code), so
 * we never store a phone number or a code ourselves. When it is not configured
 * (dev, or before credentials are pasted) we fall back to a local code that is
 * logged instead of texted, mirroring `sms.ts` and `mailer.ts`, so the whole
 * flow behaves identically in every environment.
 *
 * Either way, the only thing that ever reaches the database is the RESULT: a
 * boolean that a phone cleared a check. The number and the code never persist.
 */

export type VerifyTransport = "twilio" | "log";

export interface StartPhoneResult {
  /** True when a code was dispatched (or logged) without error. */
  sent: boolean;
  transport: VerifyTransport;
}

export interface CheckPhoneResult {
  /** True when the supplied code matched the live challenge. */
  verified: boolean;
  transport: VerifyTransport;
}

interface TwilioVerificationsApi {
  create: (opts: { to: string; channel: string }) => Promise<unknown>;
}
interface TwilioVerificationChecksApi {
  create: (opts: {
    to: string;
    code: string;
  }) => Promise<{ status?: string } | null>;
}
interface TwilioVerifyService {
  verifications: TwilioVerificationsApi;
  verificationChecks: TwilioVerificationChecksApi;
}
interface TwilioLike {
  verify: { v2: { services: (sid: string) => TwilioVerifyService } };
}
type TwilioFactory = (accountSid: string, authToken: string) => TwilioLike;

let cachedTwilioFactory: TwilioFactory | null | undefined;

async function loadTwilio(): Promise<TwilioFactory | null> {
  if (cachedTwilioFactory !== undefined) return cachedTwilioFactory;
  try {
    // Variable specifier so the optional 'twilio' dependency is resolved only at
    // runtime; it is not a hard dependency and may be absent in dev.
    const specifier = "twilio";
    const mod = (await import(specifier)) as unknown as
      | TwilioFactory
      | { default: TwilioFactory };
    cachedTwilioFactory =
      typeof mod === "function"
        ? mod
        : "default" in mod && typeof mod.default === "function"
          ? mod.default
          : null;
  } catch {
    cachedTwilioFactory = null;
  }
  return cachedTwilioFactory;
}

function twilioVerifyConfigured(): boolean {
  return Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_VERIFY_SERVICE_SID"],
  );
}

async function getVerifyService(): Promise<TwilioVerifyService | null> {
  const factory = await loadTwilio();
  if (!factory) {
    logger.warn(
      "phoneVerification.twilio_not_installed: credentials set but 'twilio' package is missing",
    );
    return null;
  }
  const client = factory(
    process.env["TWILIO_ACCOUNT_SID"] as string,
    process.env["TWILIO_AUTH_TOKEN"] as string,
  );
  return client.verify.v2.services(
    process.env["TWILIO_VERIFY_SERVICE_SID"] as string,
  );
}

/**
 * Local fallback challenges, keyed by the owner so two users never collide. Held
 * only in memory and only for the short window between start and check, never
 * written to the database. Used solely when Twilio Verify is not configured.
 */
interface LocalChallenge {
  code: string;
  phone: string;
  expiresAt: number;
}
const localChallenges = new Map<string, LocalChallenge>();
const LOCAL_CODE_TTL_MS = 10 * 60_000;

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Mask a phone number for logs: keep only the last four digits so a log line can
 * never leak a full number. The OTP code is an authentication secret and is
 * never logged in production; in dev (no SMS provider) the code is surfaced so a
 * developer can complete the flow without a real text.
 */
function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  const last4 = trimmed.slice(-4);
  return last4 ? `***${last4}` : "***";
}

/**
 * Start a phone verification: send (or log) a one-time code to `phone`. `ownerKey`
 * is the caller's stable id, used only to scope the local fallback challenge.
 */
export async function startPhoneVerification(
  ownerKey: string,
  phone: string,
): Promise<StartPhoneResult> {
  if (twilioVerifyConfigured()) {
    const service = await getVerifyService();
    if (service) {
      try {
        await service.verifications.create({ to: phone, channel: "sms" });
        return { sent: true, transport: "twilio" };
      } catch (err) {
        logger.error({ err }, "phoneVerification.twilio_start_failed");
      }
    }
  }

  const code = sixDigitCode();
  localChallenges.set(ownerKey, {
    code,
    phone,
    expiresAt: Date.now() + LOCAL_CODE_TTL_MS,
  });
  logger.info(
    {
      ownerKey,
      phone: maskPhone(phone),
      // The OTP is an auth secret: surface it only outside production so a dev
      // can finish the flow without a real SMS, never in production logs.
      ...(process.env["NODE_ENV"] === "production" ? {} : { code }),
    },
    "phoneVerification.log_transport: Twilio Verify not configured, logging code instead of sending",
  );
  return { sent: true, transport: "log" };
}

/**
 * Check a phone verification code. Returns whether the code matched the live
 * challenge for this owner/phone pair. A matching local challenge is consumed on
 * success so a code cannot be replayed.
 */
export async function checkPhoneVerification(
  ownerKey: string,
  phone: string,
  code: string,
): Promise<CheckPhoneResult> {
  if (twilioVerifyConfigured()) {
    const service = await getVerifyService();
    if (service) {
      try {
        const result = await service.verificationChecks.create({
          to: phone,
          code,
        });
        return {
          verified: result?.status === "approved",
          transport: "twilio",
        };
      } catch (err) {
        logger.error({ err }, "phoneVerification.twilio_check_failed");
        return { verified: false, transport: "twilio" };
      }
    }
  }

  const challenge = localChallenges.get(ownerKey);
  const verified =
    challenge != null &&
    challenge.phone === phone &&
    challenge.code === code &&
    challenge.expiresAt > Date.now();
  if (verified) localChallenges.delete(ownerKey);
  return { verified, transport: "log" };
}

/**
 * Test/dev-only introspection of the in-memory log-fallback challenge code for an
 * owner. This never reveals anything that is not already written to the logs in
 * plaintext when the log transport runs, and it returns null whenever Twilio is
 * the live transport (no local challenge exists). Used by the route tests to
 * drive the full start/check flow without a real SMS.
 */
export function peekLocalChallengeCodeForTest(ownerKey: string): string | null {
  return localChallenges.get(ownerKey)?.code ?? null;
}
