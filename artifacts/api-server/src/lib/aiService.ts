import OpenAI from "openai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { extractAndValidateJson, getAiToolSchema } from "@workspace/ai-schemas";
import { db, aiRequestMetricsTable, usersTable } from "@workspace/db";
import { logger } from "./logger";

export type AiMode = "live" | "fallback" | "setup-needed";
export type AiProvider = "openai" | "anthropic";

export interface AiContext {
  toolName?: string;
  formValues?: Record<string, unknown>;
  savedResults?: Record<string, unknown>;
  goals?: string[];
  progressEntries?: Array<{ date?: string; tag?: string; note?: string }>;
  extras?: Record<string, unknown>;
}

export interface GenerateOptions {
  system: string;
  user: string;
  context?: AiContext;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
  /** Which provider to route this request through. Defaults to "openai" for back-compat. */
  provider?: AiProvider;
  /**
   * If true, the call short-circuits to the deterministic fallback when the
   * user has not granted account-level AI content consent. Required for any
   * tool that ships the user's own raw content to a hosted LLM (bios,
   * messages, screenshots, journal text). Pair with `userId`.
   */
  requireContentConsent?: boolean;
  /** Authenticated user id, used when `requireContentConsent` is true. */
  userId?: string;
}

export interface GenerateResult<T = string> {
  mode: AiMode;
  isFallback: boolean;
  output: T;
  raw?: string;
  durationMs: number;
  error?: string;
  model?: string;
  /** Set when a schema validation was attempted. True if validated output was returned. */
  validated?: boolean;
  /** Number of model attempts made (1 = no retry, 2 = one retry). */
  attempts?: number;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

let cachedClient: OpenAI | null = null;
let cachedKeyHash: string | null = null;

// Anthropic client is loaded lazily via dynamic import so that:
//   1. Tests that don't exercise the Anthropic path don't need the SDK installed
//      in their resolution context.
//   2. The module never throws at import time when env vars are missing
//      (the integration package's client.ts does throw — we bypass it).
interface AnthropicMessageBlock {
  type: string;
  text?: string;
}
interface AnthropicMessageResponse {
  content: AnthropicMessageBlock[];
  model?: string;
  stop_reason?: string | null;
}
interface AnthropicClient {
  messages: {
    create: (args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }) => Promise<AnthropicMessageResponse>;
  };
}
let cachedAnthropicClient: AnthropicClient | null = null;
let cachedAnthropicKeyHash: string | null = null;

function resolveKey(): { apiKey: string | null; baseURL?: string; source: "direct" | "replit-proxy" | "none" } {
  const direct = process.env.OPENAI_API_KEY;
  if (direct && direct.trim().length > 0) {
    return { apiKey: direct.trim(), source: "direct" };
  }
  const proxyKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const proxyUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (proxyKey && proxyKey.trim().length > 0) {
    return { apiKey: proxyKey.trim(), baseURL: proxyUrl, source: "replit-proxy" };
  }
  return { apiKey: null, source: "none" };
}

function getClient(): OpenAI | null {
  const { apiKey, baseURL } = resolveKey();
  if (!apiKey) {
    cachedClient = null;
    cachedKeyHash = null;
    return null;
  }
  const hash = `${apiKey.slice(0, 6)}:${baseURL ?? ""}`;
  if (cachedClient && cachedKeyHash === hash) return cachedClient;
  cachedClient = new OpenAI({ apiKey, baseURL });
  cachedKeyHash = hash;
  return cachedClient;
}

function resolveAnthropicEnv(): {
  apiKey: string | null;
  baseURL: string | null;
  source: "replit-proxy" | "none";
} {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (apiKey && apiKey.trim().length > 0 && baseURL && baseURL.trim().length > 0) {
    return { apiKey: apiKey.trim(), baseURL: baseURL.trim(), source: "replit-proxy" };
  }
  return { apiKey: null, baseURL: null, source: "none" };
}

async function getAnthropicClient(): Promise<AnthropicClient | null> {
  const { apiKey, baseURL } = resolveAnthropicEnv();
  if (!apiKey || !baseURL) {
    cachedAnthropicClient = null;
    cachedAnthropicKeyHash = null;
    return null;
  }
  const hash = `${apiKey.slice(0, 6)}:${baseURL}`;
  if (cachedAnthropicClient && cachedAnthropicKeyHash === hash) return cachedAnthropicClient;
  try {
    const mod = (await import("@anthropic-ai/sdk")) as { default: new (opts: { apiKey: string; baseURL: string }) => AnthropicClient };
    const Anthropic = mod.default;
    cachedAnthropicClient = new Anthropic({ apiKey, baseURL });
    cachedAnthropicKeyHash = hash;
    return cachedAnthropicClient;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to load @anthropic-ai/sdk; Anthropic path unavailable",
    );
    return null;
  }
}

export function hasApiKey(): boolean {
  return resolveKey().apiKey !== null;
}

export function hasAnthropicKey(): boolean {
  return resolveAnthropicEnv().apiKey !== null;
}

export interface ProviderStatus {
  mode: AiMode;
  keyDetected: boolean;
  source: "direct" | "replit-proxy" | "none";
  model: string;
  message: string;
}

export interface AiStatus extends ProviderStatus {
  /** Back-compat: the primary (OpenAI) provider name when keyed, else null. */
  provider: "openai" | null;
  /** Per-provider breakdown for the hybrid setup. */
  providers: {
    openai: ProviderStatus;
    anthropic: ProviderStatus;
  };
}

function openaiStatus(): ProviderStatus {
  const { apiKey, source } = resolveKey();
  if (!apiKey) {
    return {
      mode: "fallback",
      keyDetected: false,
      source,
      model: DEFAULT_MODEL,
      message: "No OpenAI API key detected. OpenAI-routed tools run on deterministic fallback content.",
    };
  }
  return {
    mode: "live",
    keyDetected: true,
    source,
    model: DEFAULT_MODEL,
    message:
      source === "replit-proxy"
        ? "OpenAI connected via Replit AI Integrations."
        : "OpenAI connected via direct API key.",
  };
}

function anthropicStatus(): ProviderStatus {
  const { apiKey, source } = resolveAnthropicEnv();
  if (!apiKey) {
    return {
      mode: "fallback",
      keyDetected: false,
      source,
      model: DEFAULT_ANTHROPIC_MODEL,
      message: "No Anthropic key detected. Anthropic-routed tools run on deterministic fallback content.",
    };
  }
  return {
    mode: "live",
    keyDetected: true,
    source,
    model: DEFAULT_ANTHROPIC_MODEL,
    message: "Anthropic (Claude) connected via Replit AI Integrations.",
  };
}

export function getAiStatus(): AiStatus {
  const openai = openaiStatus();
  const anthropic = anthropicStatus();
  // Top-level fields preserve the original shape so existing callers keep working.
  return {
    ...openai,
    provider: openai.keyDetected ? "openai" : null,
    providers: { openai, anthropic },
  };
}

function contextToPromptBlock(ctx?: AiContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.toolName) lines.push(`Tool: ${ctx.toolName}`);
  if (ctx.goals && ctx.goals.length > 0) lines.push(`User goals: ${ctx.goals.join(", ")}`);
  if (ctx.formValues && Object.keys(ctx.formValues).length > 0) {
    lines.push(`Form values:\n${JSON.stringify(ctx.formValues, null, 2)}`);
  }
  if (ctx.savedResults && Object.keys(ctx.savedResults).length > 0) {
    lines.push(`Saved results:\n${JSON.stringify(ctx.savedResults, null, 2)}`);
  }
  if (ctx.progressEntries && ctx.progressEntries.length > 0) {
    const recent = ctx.progressEntries.slice(0, 8).map((e) => {
      const date = e.date ? `[${e.date}]` : "";
      const tag = e.tag ? `(${e.tag})` : "";
      return `${date}${tag} ${e.note ?? ""}`.trim();
    });
    lines.push(`Recent progress entries:\n${recent.join("\n")}`);
  }
  if (ctx.extras && Object.keys(ctx.extras).length > 0) {
    lines.push(`Additional context:\n${JSON.stringify(ctx.extras, null, 2)}`);
  }
  return lines.length === 0 ? "" : `\n\n--- CONTEXT ---\n${lines.join("\n\n")}\n--- END CONTEXT ---`;
}

export function coachingPrompt(toolPurpose: string): string {
  return [
    "You are the MatchLab Club coach — warm, direct, never preachy.",
    "Tone: practical, kind, specific. Avoid generic advice and clichés.",
    "Never claim to be human. Never recommend deception, manipulation, or unsafe behavior.",
    `Purpose of this response: ${toolPurpose}`,
    "If the user provides little context, give a thoughtful general response — never refuse.",
  ].join("\n");
}

export function toolPrompt(toolName: string, instruction: string): string {
  return [
    `Tool: ${toolName}`,
    `Instruction: ${instruction}`,
    "Use any provided context to make the response feel specific to this person.",
  ].join("\n");
}

export function parseStructured<T = unknown>(raw: string, fallback: T): { value: T; ok: boolean } {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const arrStart = trimmed.indexOf("[");
    const startIdx =
      start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
    if (startIdx === -1) return { value: fallback, ok: false };
    const endChar = trimmed[startIdx] === "{" ? "}" : "]";
    const endIdx = trimmed.lastIndexOf(endChar);
    if (endIdx === -1 || endIdx <= startIdx) return { value: fallback, ok: false };
    const slice = trimmed.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(slice) as T;
    return { value: parsed, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

interface RawCallResult {
  ok: boolean;
  text: string;
  error?: string;
}

async function callModelOnce(
  client: OpenAI,
  opts: GenerateOptions,
  model: string,
  userContent: string,
): Promise<RawCallResult> {
  try {
    const response = await client.chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 600,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: userContent },
      ],
      ...(opts.expectJson ? { response_format: { type: "json_object" as const } } : {}),
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return { ok: text.length > 0, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown OpenAI error";
    return { ok: false, text: "", error: message };
  }
}

async function callAnthropicOnce(
  client: AnthropicClient,
  opts: GenerateOptions,
  model: string,
  userContent: string,
): Promise<RawCallResult> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 8192,
      system: opts.system,
      messages: [{ role: "user", content: userContent }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = (block?.text ?? "").trim();
    return { ok: text.length > 0, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Anthropic error";
    return { ok: false, text: "", error: message };
  }
}

type CallOnce = (model: string, userContent: string) => Promise<RawCallResult>;

export async function generate(
  opts: GenerateOptions,
  fallbackOutput: string,
): Promise<GenerateResult<string>> {
  const result = await generateInner(opts, fallbackOutput);
  recordMetric(opts, result);
  return result;
}

/**
 * Returns true when the caller is allowed to ship the user's own content to
 * a hosted LLM. Anonymous users (no `userId`) are blocked from
 * consent-gated tools — they must claim/sign-in first. Errors short-circuit
 * to "no consent" (fail-closed).
 */
async function defaultConsentCheck(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const rows = await db
      .select({ granted: usersTable.aiContentConsentGranted })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return rows[0]?.granted === true;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), userId },
      "Consent lookup failed; treating as no consent (fail-closed)",
    );
    return false;
  }
}

type ConsentChecker = (userId: string | undefined) => Promise<boolean>;
let consentCheck: ConsentChecker = defaultConsentCheck;

/**
 * Test-only override for the consent lookup. Production code never calls
 * this — keeping the indirection here avoids needing to mock the drizzle
 * query chain in unit tests (which is fragile and order-dependent).
 * Throws outside `NODE_ENV === "test"` so an accidental import from
 * application code can never silently bypass the consent gate.
 */
export function __setConsentCheckerForTests(fn: ConsentChecker | null) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__setConsentCheckerForTests may only be called in tests");
  }
  consentCheck = fn ?? defaultConsentCheck;
}

async function generateInner(
  opts: GenerateOptions,
  fallbackOutput: string,
): Promise<GenerateResult<string>> {
  const start = Date.now();
  const provider: AiProvider = opts.provider ?? "openai";

  // Consent gate — must happen BEFORE any model resolution or content
  // assembly so we never even build a prompt with user content for an
  // unconsented user.
  if (opts.requireContentConsent && !(await consentCheck(opts.userId))) {
    return {
      mode: "fallback",
      isFallback: true,
      output: fallbackOutput,
      durationMs: Date.now() - start,
      model: opts.model ?? (provider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_MODEL),
      attempts: 0,
      error: "consent_required",
    };
  }

  let model: string;
  let callOnce: CallOnce;
  let clientAvailable: boolean;

  if (provider === "anthropic") {
    const anthropicClient = await getAnthropicClient();
    model = opts.model ?? DEFAULT_ANTHROPIC_MODEL;
    clientAvailable = anthropicClient !== null;
    callOnce = anthropicClient
      ? (m, u) => callAnthropicOnce(anthropicClient, opts, m, u)
      : async () => ({ ok: false, text: "" });
  } else {
    const openaiClient = getClient();
    model = opts.model ?? DEFAULT_MODEL;
    clientAvailable = openaiClient !== null;
    callOnce = openaiClient
      ? (m, u) => callModelOnce(openaiClient, opts, m, u)
      : async () => ({ ok: false, text: "" });
  }

  if (!clientAvailable) {
    return {
      mode: "fallback",
      isFallback: true,
      output: fallbackOutput,
      durationMs: Date.now() - start,
      model,
      attempts: 0,
    };
  }

  const contextBlock = contextToPromptBlock(opts.context);
  const userContent = `${opts.user}${contextBlock}`;

  const schema = opts.expectJson ? getAiToolSchema(opts.context?.toolName) : null;

  const first = await callOnce(model, userContent);
  if (!first.ok) {
    if (first.error) {
      logger.warn({ err: first.error }, "OpenAI generate failed; using fallback");
    }
    return {
      mode: "setup-needed",
      isFallback: true,
      output: fallbackOutput,
      durationMs: Date.now() - start,
      error: first.error ?? "Empty response from model",
      model,
      attempts: 1,
      ...(schema ? { validated: false } : {}),
    };
  }

  if (!schema) {
    return {
      mode: "live",
      isFallback: false,
      output: first.text,
      raw: first.text,
      durationMs: Date.now() - start,
      model,
      attempts: 1,
    };
  }

  // Structured output: validate against the per-tool schema, retrying once on failure.
  const firstParsed = extractAndValidateJson(schema, first.text);
  if (firstParsed.ok) {
    return {
      mode: "live",
      isFallback: false,
      output: JSON.stringify(firstParsed.value),
      raw: first.text,
      durationMs: Date.now() - start,
      model,
      validated: true,
      attempts: 1,
    };
  }

  logger.warn(
    { toolName: opts.context?.toolName, rawPreview: first.text.slice(0, 240) },
    "AI structured output failed schema validation; retrying once",
  );

  const repairUser = [
    userContent,
    "",
    "Your previous response did not match the required JSON schema for this tool.",
    "Respond again with VALID JSON only — no prose, no code fences — that strictly matches the expected shape.",
    "Previous attempt (for reference):",
    first.text.slice(0, 1500),
  ].join("\n");

  const second = await callOnce(model, repairUser);

  if (second.ok) {
    const secondParsed = extractAndValidateJson(schema, second.text);
    if (secondParsed.ok) {
      return {
        mode: "live",
        isFallback: false,
        output: JSON.stringify(secondParsed.value),
        raw: second.text,
        durationMs: Date.now() - start,
        model,
        validated: true,
        attempts: 2,
      };
    }
  }

  logger.warn(
    { toolName: opts.context?.toolName, err: second.error },
    "AI structured output failed schema validation after retry; returning fallback",
  );

  return {
    mode: "fallback",
    isFallback: true,
    output: fallbackOutput,
    raw: second.ok ? second.text : first.text,
    durationMs: Date.now() - start,
    model,
    validated: false,
    attempts: 2,
    error: "Structured output failed schema validation after retry",
  };
}

function recordMetric(opts: GenerateOptions, result: GenerateResult<string>): void {
  const toolName = opts.context?.toolName ?? "unknown";
  db.insert(aiRequestMetricsTable)
    .values({
      toolName,
      mode: result.mode,
      model: result.model ?? null,
      attempts: result.attempts ?? 1,
      validated: result.validated ?? null,
      isFallback: result.isFallback,
      durationMs: result.durationMs,
      error: result.error ?? null,
    })
    .catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), toolName },
        "Failed to record AI request metric",
      );
    });
}

/** Re-export so callers can construct ad-hoc schemas if needed. */
export { z };
