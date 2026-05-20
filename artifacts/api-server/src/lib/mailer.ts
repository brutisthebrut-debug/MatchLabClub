import { logger } from "./logger";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendMailResult {
  delivered: boolean;
  transport: "smtp" | "log";
}

interface NodemailerLike {
  createTransport: (url: string) => {
    sendMail: (opts: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    }) => Promise<unknown>;
  };
}

let cachedNodemailer: NodemailerLike | null | undefined;

async function loadNodemailer(): Promise<NodemailerLike | null> {
  if (cachedNodemailer !== undefined) return cachedNodemailer;
  try {
    const mod = (await import("nodemailer")) as unknown as
      | NodemailerLike
      | { default: NodemailerLike };
    cachedNodemailer =
      "default" in mod && mod.default ? mod.default : (mod as NodemailerLike);
  } catch {
    cachedNodemailer = null;
  }
  return cachedNodemailer;
}

function getFrom(): string {
  return (
    process.env["MAIL_FROM"] ||
    "Next Level Dating Club <noreply@nextleveldatingclub.local>"
  );
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const smtpUrl = process.env["SMTP_URL"];
  if (smtpUrl) {
    const nodemailer = await loadNodemailer();
    if (nodemailer) {
      try {
        const transport = nodemailer.createTransport(smtpUrl);
        await transport.sendMail({
          from: getFrom(),
          to: input.to,
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        });
        logger.info(
          { to: input.to, subject: input.subject },
          "Sent email via SMTP",
        );
        return { delivered: true, transport: "smtp" };
      } catch (err) {
        logger.error(
          { err, to: input.to, subject: input.subject },
          "Failed to send email via SMTP",
        );
        throw err;
      }
    }
    logger.warn(
      "SMTP_URL is set but nodemailer is not installed; falling back to log transport",
    );
  }

  logger.info(
    {
      to: input.to,
      from: getFrom(),
      subject: input.subject,
      text: input.text,
    },
    "Email (log transport — SMTP_URL not configured)",
  );
  return { delivered: true, transport: "log" };
}
