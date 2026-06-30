import OpenAI from "openai";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { extractAndValidateJson, getAiToolSchema } from "@workspace/ai-schemas";
import { enforceVoice } from "@workspace/echo";
import { db, aiRequestMetricsTable, usersTable, aiUsageCountersTable } from "@workspace/db";
import { logger } from "./logger";
import type { PhotoAnalysis } from "./aiEngine";
import { effectiveAiCaps } from "./brainConfig";

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
  /** When the call short-circuited to deterministic fallback, why. */
  fallbackReason?:
    | "consent_required"
    | "daily_cap_exceeded"
    | "no_client"
    | "model_error"
    | "schema_validation_failed"
    | "voice_violation";
  /** True when the post-generation voice pass auto-cleaned em dashes from the output. */
  voiceCleaned?: boolean;
  /** When the daily cap path was taken, how many calls have been used today. */
  usedToday?: number;
  /** When the daily cap path was taken, the cap that applied to this user. */
  capForUser?: number;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

let cachedClient: OpenAI | null = null;
let cachedKeyHash: string | null = null;

// Anthropic client is loaded lazily via dynamic import so that:
//   1. Tests that don't exercise the Anthropic path don't need the SDK installed
//      in their resolution context.
//   2. The module never throws at import time when env vars are missing
//      (the integration package's client.ts does throw, we bypass it).
interface AnthropicMessageBlock {
  type: string;
  text?: string;
}
interface AnthropicMessageResponse {
  content: AnthropicMessageBlock[];
  model?: string;
  stop_reason?: string | null;
}
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
interface AnthropicClient {
  messages: {
    create: (
      args: {
        model: string;
        max_tokens: number;
        system?: string;
        messages: Array<{
          role: "user" | "assistant";
          content: string | AnthropicContentBlock[];
        }>;
      },
      options?: { timeout?: number },
    ) => Promise<AnthropicMessageResponse>;
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
    "You are the MatchLab Club coach, warm, direct, never preachy.",
    "Tone: practical, kind, specific. Avoid generic advice and clichés.",
    "Never claim to be human. Never recommend deception, manipulation, or unsafe behavior.",
    `Purpose of this response: ${toolPurpose}`,
    "If the user provides little context, give a thoughtful general response, never refuse.",
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

/**
 * Hard ceiling on time we'll spend waiting for a single LLM call. Without
 * this, a hung upstream provider ties up the Node event loop indefinitely
 * (no built-in timeout on either OpenAI or Anthropic SDKs at the request
 * level). 30s is generous for the response sizes we ask for; longer than
 * that, we'd rather fall back deterministically and keep the API responsive.
 */
const PROVIDER_CALL_TIMEOUT_MS = 30_000;

async function callModelOnce(
  client: OpenAI,
  opts: GenerateOptions,
  model: string,
  userContent: string,
): Promise<RawCallResult> {
  try {
    const response = await client.chat.completions.create(
      {
        model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 600,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
        ...(opts.expectJson ? { response_format: { type: "json_object" as const } } : {}),
      },
      { timeout: PROVIDER_CALL_TIMEOUT_MS },
    );
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
    const response = await client.messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? 8192,
        system: opts.system,
        messages: [{ role: "user", content: userContent }],
      },
      { timeout: PROVIDER_CALL_TIMEOUT_MS },
    );
    const block = response.content.find((b) => b.type === "text");
    const text = (block?.text ?? "").trim();
    return { ok: text.length > 0, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Anthropic error";
    return { ok: false, text: "", error: message };
  }
}

type CallOnce = (model: string, userContent: string) => Promise<RawCallResult>;

// Daily per-user cap for hosted LLM calls. The cap protects against a single
// abuser running thousands of large prompts through Anthropic in a day.
//
// Bucketing choices:
//  - Authed users: keyed by userId. Free tier gets 30/day. A user with a paid
//    tier on usersTable.tier (granted manually by the founder during beta) gets
//    the higher paid cap. The anon/free caps are founder-tunable from the brain
//    control center; the paid cap is a fixed constant here.
//  - Anonymous users (no userId): hard-capped at 5/day, keyed by the
//    sentinel "__anon__". This is a single shared bucket across all anon
//    callers; we accept the false-positive risk for anon to avoid storing
//    IP-derived identifiers here.
const ANON_USER_BUCKET = "__anon__";
const ANON_DAILY_CAP = 5;
const FREE_TIER_DAILY_CAP = 30;
const PAID_TIER_DAILY_CAP = 200;
// Explicit allowlist of paid tier values that unlock the higher cap. Kept as an
// allowlist (not "any non-free value") because usersTable.tier is unconstrained.
const PAID_TIERS = new Set(["reset", "wingman"]);

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveCapForUser(userId: string | null): Promise<number> {
  // Caps are founder-tunable from the brain control center. Fail open to the
  // built-in constants so a missing config row or a read error never blocks AI.
  let caps = { anon: ANON_DAILY_CAP, free: FREE_TIER_DAILY_CAP };
  try {
    caps = await effectiveAiCaps();
  } catch {
    // keep the constant defaults
  }
  if (!userId) return caps.anon;
  // A founder-granted paid tier raises the daily cap. Tier is granted manually
  // during beta; this is where that grant turns into a tangible benefit. We
  // match an explicit allowlist (not "anything non-free") because usersTable
  // .tier is an unconstrained varchar: a future or stale value like "trial" or
  // "cancelled" must NOT silently unlock the paid cap. Fail open to the free
  // cap on any read error so a transient DB hiccup never hard-blocks a user.
  try {
    const rows = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const tier = rows[0]?.tier;
    if (tier && PAID_TIERS.has(tier)) return PAID_TIER_DAILY_CAP;
  } catch {
    // fall through to the free cap
  }
  return caps.free;
}

export async function checkAndIncrementDailyCap(
  userId: string | null,
  provider: "anthropic",
): Promise<{ allowed: boolean; usedToday: number; capForUser: number }> {
  const bucketUserId = userId ?? ANON_USER_BUCKET;
  const date = todayDateString();
  const capForUser = await resolveCapForUser(userId);

  try {
    // CTE-gated upsert: only increment when the resulting count would not
    // exceed the cap. The RETURNING clause gives us the post-increment
    // count when we did update, or null when we skipped.
    const result = await db.execute<{ call_count: number; incremented: boolean }>(sql`
      WITH ins AS (
        INSERT INTO ai_usage_counters (user_id, date, provider, call_count, updated_at)
        VALUES (${bucketUserId}, ${date}, ${provider}, 1, now())
        ON CONFLICT (user_id, date, provider) DO UPDATE
          SET call_count = ai_usage_counters.call_count + 1,
              updated_at = now()
          WHERE ai_usage_counters.call_count < ${capForUser}
        RETURNING call_count, true AS incremented
      )
      SELECT call_count, incremented FROM ins
      UNION ALL
      SELECT call_count, false AS incremented
      FROM ai_usage_counters
      WHERE user_id = ${bucketUserId} AND date = ${date} AND provider = ${provider}
        AND NOT EXISTS (SELECT 1 FROM ins)
      LIMIT 1
    `);
    const row = result.rows?.[0];
    const usedToday = Number(row?.call_count ?? 0);
    const allowed = Boolean(row?.incremented);
    return { allowed, usedToday, capForUser };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), userId },
      "Daily AI cap check failed; allowing call (fail-open)",
    );
    return { allowed: true, usedToday: 0, capForUser };
  }
}

export async function generate(
  opts: GenerateOptions,
  fallbackOutput: string,
): Promise<GenerateResult<string>> {
  const result = await generateInner(opts, fallbackOutput);
  const policed = await applyVoicePass(opts, fallbackOutput, result);
  recordMetric(opts, policed);
  return policed;
}

/**
 * Post-generation voice gate. Every live model output is user-facing copy
 * (bio rewrites, message coaching, Mirror synthesis, import summaries, etc.),
 * and the model can still slip in em dashes or AI-tell words even with the
 * voice rules in its system prompt. This pass keeps that copy on-voice before
 * it ever reaches a user:
 *   - Em dashes are auto-cleaned in place (mechanical, always safe; works on
 *     JSON outputs too since em dashes only appear inside string values).
 *   - Banned AI-tell words can't be safely rewritten in place, so we
 *     regenerate ONCE with an explicit correction instruction. If the
 *     regeneration is still off-voice (or itself falls back), we ship the
 *     deterministic fallback rather than off-voice live copy.
 * "unlock(ed)" is intentionally allowed (gamification reward language).
 * Deterministic fallbacks are copy we already control, so they are left alone.
 */
async function applyVoicePass(
  opts: GenerateOptions,
  fallbackOutput: string,
  result: GenerateResult<string>,
): Promise<GenerateResult<string>> {
  if (result.isFallback || result.mode !== "live" || !result.output) {
    return result;
  }

  const firstPass = enforceVoice(result.output);
  if (firstPass.onVoice) {
    return firstPass.changed
      ? { ...result, output: firstPass.text, voiceCleaned: true }
      : result;
  }

  logger.warn(
    { toolName: opts.context?.toolName, aiTells: firstPass.aiTells },
    "AI output tripped the voice gate; regenerating once",
  );

  // One correction round. We invoke generateInner once more, which itself may
  // perform a schema-repair retry for JSON tools, so a structured call can cost
  // more than one extra provider call (and, for Anthropic, daily-cap slot). The
  // voice gate never loops: there is at most this single correction round.
  const correctionSystem = [
    opts.system,
    "",
    `VOICE CORRECTION: your previous response used banned words: ${firstPass.aiTells.join(", ")}. Rewrite the entire response without those words and without em dashes (use a comma or a period instead). Keep the same meaning and structure${opts.expectJson ? ", and keep the exact required JSON shape" : ""}.`,
  ].join("\n");

  const regen = await generateInner({ ...opts, system: correctionSystem }, fallbackOutput);

  const offVoiceFallback = (base: GenerateResult<string>): GenerateResult<string> => ({
    ...base,
    mode: "fallback",
    isFallback: true,
    output: fallbackOutput,
    fallbackReason: "voice_violation",
    error: "voice_violation",
    // We are returning the deterministic fallback, not schema-validated model
    // output, so never let a stale validated:true from the regen leak through.
    ...(opts.expectJson ? { validated: false } : {}),
  });

  if (regen.isFallback || regen.mode !== "live" || !regen.output) {
    return offVoiceFallback(regen);
  }

  const secondPass = enforceVoice(regen.output);
  if (secondPass.onVoice) {
    return secondPass.changed
      ? { ...regen, output: secondPass.text, voiceCleaned: true }
      : regen;
  }

  logger.warn(
    { toolName: opts.context?.toolName, aiTells: secondPass.aiTells },
    "AI output still off-voice after regeneration; using deterministic fallback",
  );
  return offVoiceFallback(regen);
}

/**
 * Returns true when the caller is allowed to ship the user's own content to
 * a hosted LLM. Anonymous users (no `userId`) are blocked from
 * consent-gated tools, they must claim/sign-in first. Errors short-circuit
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
 * this, keeping the indirection here avoids needing to mock the drizzle
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

  // Consent gate, must happen BEFORE any model resolution or content
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
      fallbackReason: "consent_required",
    };
  }

  // Per-user daily cap for Anthropic. We bucket anon callers separately so
  // one signed-out abuser cannot burn through every authed user's budget.
  if (provider === "anthropic") {
    const cap = await checkAndIncrementDailyCap(opts.userId ?? null, "anthropic");
    if (!cap.allowed) {
      logger.warn(
        {
          metric: "anthropic.cap.hit",
          userId: opts.userId ?? null,
          usedToday: cap.usedToday,
          capForUser: cap.capForUser,
          toolName: opts.context?.toolName,
        },
        "anthropic.cap.hit",
      );
      return {
        mode: "fallback",
        isFallback: true,
        output: fallbackOutput,
        durationMs: Date.now() - start,
        model: opts.model ?? DEFAULT_ANTHROPIC_MODEL,
        attempts: 0,
        error: "daily_cap_exceeded",
        fallbackReason: "daily_cap_exceeded",
        usedToday: cap.usedToday,
        capForUser: cap.capForUser,
      };
    }
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
    "Respond again with VALID JSON only, no prose, no code fences, that strictly matches the expected shape.",
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

// ---------------------------------------------------------------------------
// Vision: real profile-photo critique
//
// This is the ONLY path that ships the user's raw image to a hosted model.
// OCR runs locally (tesseract), so until this feature the image never left the
// server. Because of that, the consent gate here is non-negotiable: an
// unconsented or anonymous caller never reaches the model. The image is sent
// in-memory and never persisted. On any miss (no consent, cap hit, no client,
// bad JSON, model error) we return analysis:null so the caller keeps the
// deterministic photoGuidance checklist as the fallback.
// ---------------------------------------------------------------------------

export interface AnalyzeProfilePhotosOptions {
  imageBase64: string;
  imageMediaType?: string | null;
  userId?: string;
  sourceApp?: string | null;
  datingGoal?: string | null;
}

export interface AnalyzeProfilePhotosResult {
  analysis: PhotoAnalysis | null;
  mode: AiMode;
  isFallback: boolean;
  durationMs: number;
  fallbackReason?: GenerateResult["fallbackReason"];
}

const ANTHROPIC_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function stripImageDataUrlPrefix(input: string): string {
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) return input.slice(comma + 1);
  return input;
}

function normalizeImageMediaType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  const normalized = lower === "image/jpg" ? "image/jpeg" : lower;
  return ANTHROPIC_IMAGE_MEDIA_TYPES.has(normalized) ? normalized : null;
}

// Prefer an explicit media type from the client (the browser knows the real
// File.type). Fall back to sniffing a data-URL prefix, then to JPEG. This
// matters because the frontend sends prefix-stripped base64, so without the
// explicit hint PNG/WEBP/GIF uploads would be mislabeled as JPEG and the vision
// call could fail.
function detectImageMediaType(input: string, explicit?: string | null): string {
  const fromExplicit = normalizeImageMediaType(explicit);
  if (fromExplicit) return fromExplicit;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(input.trim());
  if (match) {
    const fromPrefix = normalizeImageMediaType(match[1]);
    if (fromPrefix) return fromPrefix;
  }
  return "image/jpeg";
}

const photoAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  observations: z
    .array(
      z.object({
        aspect: z.string().trim().min(1).max(60),
        assessment: z.enum(["strong", "okay", "needs_work"]),
        detail: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(8),
  topFix: z.string().trim().min(1).max(600),
});

function recordVisionMetric(
  mode: AiMode,
  isFallback: boolean,
  durationMs: number,
  error: string | null,
): void {
  db.insert(aiRequestMetricsTable)
    .values({
      toolName: "photo_vision",
      mode,
      model: DEFAULT_ANTHROPIC_MODEL,
      attempts: 1,
      validated: null,
      isFallback,
      durationMs,
      error,
    })
    .catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to record photo_vision metric",
      );
    });
}

const PHOTO_VISION_SYSTEM = [
  "You are the MatchLab Club photo coach looking at a screenshot from a dating app profile.",
  "Critique only what you can actually see: lighting, framing, expression, outfit, background, photo variety, solo vs group, and image quality.",
  "Be specific and kind. Never guess at things you cannot see. Never comment on race, body weight, attractiveness rankings, or anything demeaning. Never claim to be human.",
  "If the screenshot shows no usable photo of a person (for example it is only text), say so plainly in the summary and keep observations short.",
  "Respond with VALID JSON only, no prose, no code fences, matching this shape:",
  '{"summary": string, "observations": [{"aspect": string, "assessment": "strong"|"okay"|"needs_work", "detail": string}], "topFix": string}',
].join("\n");

// Runs each user-facing string in a Claude-vision photo analysis through the
// shared voice gate. Em dashes are auto-cleaned in place. If any banned AI-tell
// word survives the clean (a single image read can't be safely rewritten), the
// whole analysis is rejected so the caller drops to the deterministic photo
// checklist. Returns the cleaned analysis, or null when it stays off-voice.
function enforcePhotoAnalysisVoice(analysis: PhotoAnalysis): PhotoAnalysis | null {
  const summary = enforceVoice(analysis.summary);
  const topFix = enforceVoice(analysis.topFix);
  const observations = analysis.observations.map((obs) => ({
    obs,
    detail: enforceVoice(obs.detail),
  }));

  const offVoice =
    !summary.onVoice ||
    !topFix.onVoice ||
    observations.some(({ detail }) => !detail.onVoice);
  if (offVoice) {
    const aiTells = [
      ...summary.aiTells,
      ...topFix.aiTells,
      ...observations.flatMap(({ detail }) => detail.aiTells),
    ];
    logger.warn({ aiTells }, "photo_vision: output tripped the voice gate; using checklist fallback");
    return null;
  }

  return {
    ...analysis,
    summary: summary.text,
    topFix: topFix.text,
    observations: observations.map(({ obs, detail }) => ({ ...obs, detail: detail.text })),
  };
}

export async function analyzeProfilePhotos(
  opts: AnalyzeProfilePhotosOptions,
): Promise<AnalyzeProfilePhotosResult> {
  const start = Date.now();
  const miss = (
    fallbackReason: GenerateResult["fallbackReason"],
    mode: AiMode = "fallback",
  ): AnalyzeProfilePhotosResult => {
    const durationMs = Date.now() - start;
    recordVisionMetric(mode, true, durationMs, fallbackReason ?? null);
    return { analysis: null, mode, isFallback: true, durationMs, fallbackReason };
  };

  // Consent gate FIRST, never ship the raw image to a hosted model without it.
  if (!(await consentCheck(opts.userId))) {
    return miss("consent_required");
  }

  // Per-user daily cap (shared Anthropic bucket).
  const cap = await checkAndIncrementDailyCap(opts.userId ?? null, "anthropic");
  if (!cap.allowed) {
    return miss("daily_cap_exceeded");
  }

  const client = await getAnthropicClient();
  if (!client) {
    return miss("no_client");
  }

  const cleaned = stripImageDataUrlPrefix(opts.imageBase64.trim());
  if (!cleaned) {
    return miss("model_error");
  }
  const mediaType = detectImageMediaType(opts.imageBase64, opts.imageMediaType);

  const instruction = [
    "Critique the photo(s) in this dating profile screenshot.",
    opts.sourceApp ? `Dating app: ${opts.sourceApp}.` : null,
    opts.datingGoal ? `Their goal: ${opts.datingGoal}.` : null,
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: PHOTO_VISION_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: cleaned },
              },
              { type: "text", text: instruction },
            ],
          },
        ],
      },
      { timeout: PROVIDER_CALL_TIMEOUT_MS },
    );
    const block = response.content.find((b) => b.type === "text");
    const text = (block?.text ?? "").trim();
    const parsed = parseStructured<unknown>(text, null);
    if (!parsed.ok) {
      logger.warn({ rawPreview: text.slice(0, 200) }, "photo_vision: non-JSON response");
      return miss("schema_validation_failed", "setup-needed");
    }
    const validated = photoAnalysisSchema.safeParse(parsed.value);
    if (!validated.success) {
      logger.warn({ err: validated.error.message }, "photo_vision: schema validation failed");
      return miss("schema_validation_failed", "setup-needed");
    }
    // Claude vision returns free-text fields (summary, observation details,
    // topFix) that bypass the generate() voice gate, so police them here. Em
    // dashes are auto-cleaned in place; if a banned AI-tell word survives we
    // can't safely rewrite a single image read, so we drop to the deterministic
    // photo checklist fallback rather than ship off-voice copy. "unlock(ed)"
    // stays allowed (gamification reward language) via enforceVoice.
    const policed = enforcePhotoAnalysisVoice(validated.data);
    if (!policed) {
      return miss("voice_violation", "setup-needed");
    }
    const durationMs = Date.now() - start;
    recordVisionMetric("live", false, durationMs, null);
    return { analysis: policed, mode: "live", isFallback: false, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Anthropic vision error";
    logger.warn({ err: message }, "photo_vision call failed; falling back to checklist");
    return miss("model_error", "setup-needed");
  }
}

// Photo Lab: opt-in multi-image vision compare. Layered on top of the always-on
// deterministic ranking. Sends every image in ONE Anthropic call (one daily-cap
// increment), reads them in the moment, and never stores them. Consent-gated and
// capped exactly like analyzeProfilePhotos.
export interface ComparePhotosVisionPhoto {
  /** Caller-assigned id. The model is told to reuse these exact ids. */
  id: string;
  imageBase64: string;
  imageMediaType?: string | null;
}

export interface ComparePhotosVisionOptions {
  photos: ComparePhotosVisionPhoto[];
  userId?: string;
  sourceApp?: string | null;
  datingGoal?: string | null;
}

export interface PhotoComparisonItem {
  id: string;
  assessment: "strong" | "okay" | "needs_work";
  reason: string;
}

export interface PhotoComparison {
  summary: string;
  leadShotId: string | null;
  leadShotReason: string | null;
  photos: PhotoComparisonItem[];
}

export interface ComparePhotosVisionResult {
  analysis: PhotoComparison | null;
  mode: AiMode;
  isFallback: boolean;
  durationMs: number;
  fallbackReason?: GenerateResult["fallbackReason"];
}

const MAX_VISION_COMPARE_PHOTOS = 6;

const photoComparisonSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  leadShotId: z.string().trim().min(1).max(120).nullable(),
  leadShotReason: z.string().trim().min(1).max(600).nullable(),
  photos: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(120),
        assessment: z.enum(["strong", "okay", "needs_work"]),
        reason: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(MAX_VISION_COMPARE_PHOTOS),
});

function recordComparisonMetric(
  mode: AiMode,
  isFallback: boolean,
  durationMs: number,
  error: string | null,
): void {
  db.insert(aiRequestMetricsTable)
    .values({
      toolName: "photo_lab_vision",
      mode,
      model: DEFAULT_ANTHROPIC_MODEL,
      attempts: 1,
      validated: null,
      isFallback,
      durationMs,
      error,
    })
    .catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to record photo_lab_vision metric",
      );
    });
}

const PHOTO_LAB_VISION_SYSTEM = [
  "You are the MatchLab Club photo coach comparing several photos a member is considering for a dating profile.",
  "Rank them as a dating profile lineup and pick the single best lead shot, the first image people would see.",
  "Judge only what you can see: lighting, framing, expression, outfit, background, photo variety, solo versus group, image quality, and how well each works as a lead.",
  "Be specific and kind. Never comment on race, body weight, attractiveness rankings, or anything demeaning. Never claim to be human.",
  "Use the exact photo ids given to you. Respond with VALID JSON only, no prose, no code fences, matching this shape:",
  '{"summary": string, "leadShotId": string|null, "leadShotReason": string|null, "photos": [{"id": string, "assessment": "strong"|"okay"|"needs_work", "reason": string}]}',
].join("\n");

export async function comparePhotosVision(
  opts: ComparePhotosVisionOptions,
): Promise<ComparePhotosVisionResult> {
  const start = Date.now();
  const miss = (
    fallbackReason: GenerateResult["fallbackReason"],
    mode: AiMode = "fallback",
  ): ComparePhotosVisionResult => {
    const durationMs = Date.now() - start;
    recordComparisonMetric(mode, true, durationMs, fallbackReason ?? null);
    return { analysis: null, mode, isFallback: true, durationMs, fallbackReason };
  };

  const photos = (opts.photos ?? [])
    .map((p) => ({
      id: p.id,
      cleaned: stripImageDataUrlPrefix(p.imageBase64.trim()),
      mediaType: detectImageMediaType(p.imageBase64, p.imageMediaType),
    }))
    .filter((p) => p.cleaned.length > 0)
    .slice(0, MAX_VISION_COMPARE_PHOTOS);
  if (photos.length === 0) {
    return miss("model_error");
  }

  // Consent gate FIRST, never ship raw images to a hosted model without it.
  if (!(await consentCheck(opts.userId))) {
    return miss("consent_required");
  }
  // One daily-cap increment for the whole comparison.
  const cap = await checkAndIncrementDailyCap(opts.userId ?? null, "anthropic");
  if (!cap.allowed) {
    return miss("daily_cap_exceeded");
  }
  const client = await getAnthropicClient();
  if (!client) {
    return miss("no_client");
  }

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
  > = [];
  for (const p of photos) {
    content.push({ type: "text", text: `Photo ${p.id}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: p.mediaType, data: p.cleaned },
    });
  }
  const instruction = [
    `Compare these ${photos.length} photos for a dating profile.`,
    opts.sourceApp ? `Dating app: ${opts.sourceApp}.` : null,
    opts.datingGoal ? `Their goal: ${opts.datingGoal}.` : null,
    `Rank them, pick the best lead shot by id, and return JSON only. Valid photo ids: ${photos
      .map((p) => p.id)
      .join(", ")}.`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
  content.push({ type: "text", text: instruction });

  try {
    const response = await client.messages.create(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 1536,
        system: PHOTO_LAB_VISION_SYSTEM,
        messages: [{ role: "user", content }],
      },
      { timeout: PROVIDER_CALL_TIMEOUT_MS },
    );
    const block = response.content.find((b) => b.type === "text");
    const text = (block?.text ?? "").trim();
    const parsed = parseStructured<unknown>(text, null);
    if (!parsed.ok) {
      logger.warn(
        { rawPreview: text.slice(0, 200) },
        "photo_lab_vision: non-JSON response",
      );
      return miss("schema_validation_failed", "setup-needed");
    }
    const validated = photoComparisonSchema.safeParse(parsed.value);
    if (!validated.success) {
      logger.warn(
        { err: validated.error.message },
        "photo_lab_vision: schema validation failed",
      );
      return miss("schema_validation_failed", "setup-needed");
    }
    // Constrain the model's ids to the set we actually sent, drop anything else.
    const validIds = new Set(photos.map((p) => p.id));
    const filtered = validated.data.photos.filter((p) => validIds.has(p.id));
    const leadShotId =
      validated.data.leadShotId && validIds.has(validated.data.leadShotId)
        ? validated.data.leadShotId
        : null;
    const durationMs = Date.now() - start;
    recordComparisonMetric("live", false, durationMs, null);
    return {
      analysis: {
        summary: validated.data.summary,
        leadShotId,
        leadShotReason: validated.data.leadShotReason,
        photos: filtered,
      },
      mode: "live",
      isFallback: false,
      durationMs,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Anthropic vision error";
    logger.warn(
      { err: message },
      "photo_lab_vision call failed; falling back to checklist",
    );
    return miss("model_error", "setup-needed");
  }
}

// Selfie / photo-match verification: an opt-in anti-catfish consistency check.
// Claude vision compares a just-taken selfie against the member's profile photos
// and reports only whether they plausibly show the same person. This is a SOFT
// consistency signal, never a liveness or identity proof. Every image is read in
// the moment and never stored, consent-gated and capped exactly like the other
// vision tools, sent in ONE Anthropic call (one daily-cap increment).
export interface SelfieVisionImage {
  imageBase64: string;
  imageMediaType?: string | null;
}

export interface CompareSelfieVisionOptions {
  selfie: SelfieVisionImage;
  profilePhotos: SelfieVisionImage[];
  userId?: string;
}

export interface SelfieMatch {
  verdict: "consistent" | "inconsistent" | "unclear";
  reason: string;
}

export interface CompareSelfieVisionResult {
  analysis: SelfieMatch | null;
  mode: AiMode;
  isFallback: boolean;
  durationMs: number;
  fallbackReason?: GenerateResult["fallbackReason"];
}

const MAX_SELFIE_PROFILE_PHOTOS = 5;

const selfieMatchSchema = z.object({
  verdict: z.enum(["consistent", "inconsistent", "unclear"]),
  reason: z.string().trim().min(1).max(600),
});

function recordSelfieMetric(
  mode: AiMode,
  isFallback: boolean,
  durationMs: number,
  error: string | null,
): void {
  db.insert(aiRequestMetricsTable)
    .values({
      toolName: "selfie_vision",
      mode,
      model: DEFAULT_ANTHROPIC_MODEL,
      attempts: 1,
      validated: null,
      isFallback,
      durationMs,
      error,
    })
    .catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to record selfie_vision metric",
      );
    });
}

const SELFIE_VISION_SYSTEM = [
  "You are the MatchLab Club photo-match assistant performing a SOFT anti-catfish consistency check.",
  "You are given a selfie a member just took, followed by the profile photos they use. Judge only whether the selfie plausibly shows the same person as the profile photos.",
  "This is a consistency check, NOT proof of liveness, identity, or that the photos are recent or real. Never claim certainty, never claim to verify identity, never claim to detect spoofing or deepfakes.",
  "Judge only what you can see (face shape, features, hair, overall likeness). Never comment on race, body weight, attractiveness, or anything demeaning. Never claim to be human.",
  'Use verdict "consistent" only when the selfie clearly looks like the same person as the profile photos. Use "inconsistent" when they clearly look like different people. Use "unclear" when you cannot tell, including when faces are obscured, there is no usable face, or the photos are ambiguous.',
  "Keep the reason short, plain, and kind, and frame it as a soft observation, not a ruling.",
  "Respond with VALID JSON only, no prose, no code fences, matching this shape:",
  '{"verdict": "consistent"|"inconsistent"|"unclear", "reason": string}',
].join("\n");

export async function compareSelfieVision(
  opts: CompareSelfieVisionOptions,
): Promise<CompareSelfieVisionResult> {
  const start = Date.now();
  const miss = (
    fallbackReason: GenerateResult["fallbackReason"],
    mode: AiMode = "fallback",
  ): CompareSelfieVisionResult => {
    const durationMs = Date.now() - start;
    recordSelfieMetric(mode, true, durationMs, fallbackReason ?? null);
    return { analysis: null, mode, isFallback: true, durationMs, fallbackReason };
  };

  const selfie = {
    cleaned: stripImageDataUrlPrefix(opts.selfie.imageBase64.trim()),
    mediaType: detectImageMediaType(
      opts.selfie.imageBase64,
      opts.selfie.imageMediaType,
    ),
  };
  const profilePhotos = (opts.profilePhotos ?? [])
    .map((p) => ({
      cleaned: stripImageDataUrlPrefix(p.imageBase64.trim()),
      mediaType: detectImageMediaType(p.imageBase64, p.imageMediaType),
    }))
    .filter((p) => p.cleaned.length > 0)
    .slice(0, MAX_SELFIE_PROFILE_PHOTOS);
  if (!selfie.cleaned || profilePhotos.length === 0) {
    return miss("model_error");
  }

  // Consent gate FIRST, never ship raw images to a hosted model without it.
  if (!(await consentCheck(opts.userId))) {
    return miss("consent_required");
  }
  // One daily-cap increment for the whole comparison.
  const cap = await checkAndIncrementDailyCap(opts.userId ?? null, "anthropic");
  if (!cap.allowed) {
    return miss("daily_cap_exceeded");
  }
  const client = await getAnthropicClient();
  if (!client) {
    return miss("no_client");
  }

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
  > = [];
  content.push({ type: "text", text: "Selfie just taken by the member:" });
  content.push({
    type: "image",
    source: { type: "base64", media_type: selfie.mediaType, data: selfie.cleaned },
  });
  profilePhotos.forEach((p, i) => {
    content.push({ type: "text", text: `Profile photo ${i + 1}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: p.mediaType, data: p.cleaned },
    });
  });
  content.push({
    type: "text",
    text: "Does the selfie plausibly show the same person as the profile photos? Return JSON only.",
  });

  try {
    const response = await client.messages.create(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 512,
        system: SELFIE_VISION_SYSTEM,
        messages: [{ role: "user", content }],
      },
      { timeout: PROVIDER_CALL_TIMEOUT_MS },
    );
    const block = response.content.find((b) => b.type === "text");
    const text = (block?.text ?? "").trim();
    const parsed = parseStructured<unknown>(text, null);
    if (!parsed.ok) {
      logger.warn(
        { rawPreview: text.slice(0, 200) },
        "selfie_vision: non-JSON response",
      );
      return miss("schema_validation_failed", "setup-needed");
    }
    const validated = selfieMatchSchema.safeParse(parsed.value);
    if (!validated.success) {
      logger.warn(
        { err: validated.error.message },
        "selfie_vision: schema validation failed",
      );
      return miss("schema_validation_failed", "setup-needed");
    }
    const durationMs = Date.now() - start;
    recordSelfieMetric("live", false, durationMs, null);
    return {
      analysis: validated.data,
      mode: "live",
      isFallback: false,
      durationMs,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Anthropic vision error";
    logger.warn(
      { err: message },
      "selfie_vision call failed; falling back to honest no-result",
    );
    return miss("model_error", "setup-needed");
  }
}

/** Re-export so callers can construct ad-hoc schemas if needed. */
export { z };
