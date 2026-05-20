import { logger } from "./logger";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type MailTransport = "resend" | "smtp" | "log";

export interface SendMailResult {
  delivered: boolean;
  transport: MailTransport;
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

interface ResendLike {
  emails: {
    send: (opts: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
  };
}

interface ResendConstructor {
  new (apiKey: string): ResendLike;
}

let cachedNodemailer: NodemailerLike | null | undefined;
let cachedResendCtor: ResendConstructor | null | undefined;

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

async function loadResend(): Promise<ResendConstructor | null> {
  if (cachedResendCtor !== undefined) return cachedResendCtor;
  try {
    const mod = (await import("resend")) as unknown as {
      Resend?: ResendConstructor;
      default?: { Resend?: ResendConstructor };
    };
    cachedResendCtor =
      mod.Resend ?? mod.default?.Resend ?? null;
  } catch {
    cachedResendCtor = null;
  }
  return cachedResendCtor;
}

function getFrom(): string {
  return (
    process.env["MAIL_FROM"] ||
    "Next Level Dating Club <noreply@nextleveldatingclub.local>"
  );
}

interface ResendCredentials {
  apiKey: string;
}

let cachedResendCreds: ResendCredentials | null | undefined;

async function fetchResendCredentialsFromConnector(): Promise<ResendCredentials | null> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      items?: Array<{ settings?: { api_key?: string; apiKey?: string } }>;
    };
    const settings = data.items?.[0]?.settings;
    const apiKey = settings?.api_key ?? settings?.apiKey;
    if (!apiKey) return null;
    return { apiKey };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Resend credentials from connector");
    return null;
  }
}

async function getResendCredentials(): Promise<ResendCredentials | null> {
  const envKey = process.env["RESEND_API_KEY"];
  if (envKey) return { apiKey: envKey };

  if (cachedResendCreds !== undefined) return cachedResendCreds;
  cachedResendCreds = await fetchResendCredentialsFromConnector();
  return cachedResendCreds;
}

async function trySendViaResend(
  input: SendMailInput,
): Promise<SendMailResult | null> {
  const creds = await getResendCredentials();
  if (!creds) return null;

  const Resend = await loadResend();
  if (!Resend) {
    logger.warn(
      "Resend credentials present but the `resend` package is not installed; skipping Resend transport",
    );
    return null;
  }

  const client = new Resend(creds.apiKey);
  const result = await client.emails.send({
    from: getFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });

  if (result.error) {
    const msg = result.error.message || "Unknown Resend error";
    throw new Error(`Resend send failed: ${msg}`);
  }

  logger.info(
    { to: input.to, subject: input.subject },
    "Sent email via Resend",
  );
  return { delivered: true, transport: "resend" };
}

async function trySendViaSmtp(
  input: SendMailInput,
): Promise<SendMailResult | null> {
  const smtpUrl = process.env["SMTP_URL"];
  if (!smtpUrl) return null;

  const nodemailer = await loadNodemailer();
  if (!nodemailer) {
    logger.warn(
      "SMTP_URL is set but nodemailer is not installed; skipping SMTP transport",
    );
    return null;
  }

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
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  try {
    const viaResend = await trySendViaResend(input);
    if (viaResend) return viaResend;
  } catch (err) {
    logger.error(
      { err, to: input.to, subject: input.subject },
      "Failed to send email via Resend",
    );
    throw err;
  }

  try {
    const viaSmtp = await trySendViaSmtp(input);
    if (viaSmtp) return viaSmtp;
  } catch (err) {
    logger.error(
      { err, to: input.to, subject: input.subject },
      "Failed to send email via SMTP",
    );
    throw err;
  }

  logger.info(
    {
      to: input.to,
      from: getFrom(),
      subject: input.subject,
      text: input.text,
    },
    "Email (log transport — no email provider configured)",
  );
  return { delivered: true, transport: "log" };
}
