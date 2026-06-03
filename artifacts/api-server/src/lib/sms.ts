import { logger } from "./logger";

export interface SendSmsInput {
  to: string;
  body: string;
}

export type SmsTransport = "twilio" | "log";

export interface SendSmsResult {
  delivered: boolean;
  transport: SmsTransport;
}

interface TwilioMessagesApi {
  create: (opts: {
    to: string;
    from: string;
    body: string;
  }) => Promise<unknown>;
}

interface TwilioLike {
  messages: TwilioMessagesApi;
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

function twilioConfigured(): boolean {
  return Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_FROM_NUMBER"],
  );
}

/**
 * Send one SMS, mirroring `mailer.ts`: when Twilio credentials are present and
 * the package is installed we deliver for real, otherwise we log the message and
 * report `transport: "log"` so callers behave identically in every environment.
 * Echo only ever texts users who explicitly opted into SMS and supplied a number.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (twilioConfigured()) {
    const factory = await loadTwilio();
    if (factory) {
      try {
        const client = factory(
          process.env["TWILIO_ACCOUNT_SID"] as string,
          process.env["TWILIO_AUTH_TOKEN"] as string,
        );
        await client.messages.create({
          to: input.to,
          from: process.env["TWILIO_FROM_NUMBER"] as string,
          body: input.body,
        });
        return { delivered: true, transport: "twilio" };
      } catch (err) {
        logger.error({ err }, "sms.twilio_send_failed");
      }
    } else {
      logger.warn(
        "sms.twilio_not_installed: credentials set but 'twilio' package is missing",
      );
    }
  }

  logger.info(
    { to: input.to, body: input.body },
    "sms.log_transport: SMS not configured, logging instead of sending",
  );
  return { delivered: false, transport: "log" };
}
