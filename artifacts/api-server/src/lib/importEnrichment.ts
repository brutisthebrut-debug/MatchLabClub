/**
 * Durable AI enrichment for imported sources (Hinge GDPR exports and Instagram
 * paste tone reads).
 *
 * Both enrichment passes were previously fire-and-forget closures living inside
 * their route files. They now live here so that:
 *  1. The route can kick them off on upload (unchanged user-facing behaviour).
 *  2. The import recovery job (`importRecoveryJob.ts`) can re-run them for rows
 *     that got stranded by a process restart mid-enrichment, or that landed in
 *     a transient `fallback` state.
 *
 * Every Anthropic call is wrapped in `retryWhile` with a transient-only retry
 * predicate, so a single network blip no longer forces a deterministic fallback.
 * Consent-off, daily-cap, and "no client configured" outcomes are terminal and
 * never retried. Only derived numbers (Hinge) or the pasted text the user
 * explicitly handed us (Instagram) are sent, never third-party message bodies.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, importedSourcesTable } from "@workspace/db";
import { buildEchoSystemPrompt } from "@workspace/echo";
import { extractAndValidateJson } from "@workspace/ai-schemas";
import { generate, type GenerateResult } from "./aiService";
import { retryWhile } from "./retry";
import { logger } from "./logger";
import { DATING_APP_IMPORT_SOURCES } from "./signalRegistry";

/** Bounded retry budget for a single enrichment row's model call. */
const ENRICH_ATTEMPTS = 3;
/** How many recovery passes a transient `fallback` row may receive. */
export const MAX_ENRICH_RETRIES = 3;

/**
 * Fallback reasons that should NOT consume the per-row retry budget. A daily
 * cap is a time-window condition, not a defect in this row: re-running once the
 * cap resets is exactly what we want, and the capped call short-circuits before
 * any real API request, so retrying it is cheap. If we counted it against
 * `MAX_ENRICH_RETRIES`, a row that hit the cap a few times in one window would
 * exhaust its budget and never recover after the next-day reset.
 */
export const NON_CONSUMING_FALLBACK_REASONS = new Set(["daily_cap_exceeded"]);

/**
 * The retry count to persist after a fallback. Consuming reasons increment so a
 * permanently failing row eventually stops; non-consuming ones (daily cap) hold
 * steady so the row stays eligible for recovery once the window clears.
 */
export function nextEnrichRetryCount(reason: string, current: number): number {
  return NON_CONSUMING_FALLBACK_REASONS.has(reason) ? current : current + 1;
}

/**
 * A `generate()` result is worth retrying only when it failed transiently:
 * the client was reachable (attempts >= 1) and the error is not one of the
 * terminal classes (consent, daily cap, or a schema failure the service
 * already retried internally).
 */
export function isRetryableGenerateResult(r: GenerateResult<string>): boolean {
  if (!r.isFallback) return false;
  if ((r.attempts ?? 0) === 0) return false; // no client / consent / cap short-circuit
  const terminal = new Set([
    "consent_required",
    "daily_cap_exceeded",
    "Structured output failed schema validation after retry",
  ]);
  if (r.error && terminal.has(r.error)) return false;
  return true;
}

async function generateWithRetry(
  opts: Parameters<typeof generate>[0],
): Promise<GenerateResult<string>> {
  return retryWhile(() => generate(opts, ""), {
    attempts: ENRICH_ATTEMPTS,
    shouldRetry: isRetryableGenerateResult,
    onRetry: ({ attempt, delayMs, error }) => {
      logger.warn(
        {
          attempt,
          delayMs,
          err: error instanceof Error ? error.message : undefined,
        },
        "Retrying import enrichment model call after transient failure",
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Hinge GDPR export enrichment
// ---------------------------------------------------------------------------

export interface DerivedStats {
  totalMatches: number;
  totalConversations: number;
  totalMessagesSent: number;
  oldestMatchAt: string | null;
  newestMatchAt: string | null;
  topConversationLength: number;
  messageToMatchRatio: number;
  rawJsonFileCount: number;
  mediaFileCount: number;
}

export interface HingeParsedSummary {
  counts: {
    matches: number;
    conversations: number;
    messagesSent: number;
    mediaFiles: number;
    jsonFiles: number;
  };
  derivedStats: DerivedStats;
  originalFilename: string | null;
}

export const HingeAiReadSchema = z.object({
  narrativeRead: z.string().trim().min(1).max(800),
  patterns: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
  strengths: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  blindspots: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  coachingPrompts: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
});
export type HingeAiRead = z.infer<typeof HingeAiReadSchema>;

/** Human-facing name for a dating-app import source key. */
export function importAppLabel(app: string): string {
  switch (app) {
    case "hinge":
      return "Hinge";
    case "tinder":
      return "Tinder";
    case "bumble":
      return "Bumble";
    default:
      return app.charAt(0).toUpperCase() + app.slice(1);
  }
}

function buildImportUserPrompt(app: string, summary: HingeParsedSummary): string {
  const label = importAppLabel(app);
  const d = summary.derivedStats;
  const span =
    d.oldestMatchAt && d.newestMatchAt
      ? `from ${d.oldestMatchAt.slice(0, 10)} to ${d.newestMatchAt.slice(0, 10)}`
      : "with no datestamped activity we could read";
  return [
    `Read this person's ${label} history summary and give a narrative read of their dating patterns. The numbers below are all you have. No raw messages were shared.`,
    "",
    `Total matches: ${d.totalMatches}`,
    `Total conversations started: ${d.totalConversations}`,
    `Total messages they sent: ${d.totalMessagesSent}`,
    `Longest single conversation length: ${d.topConversationLength} messages`,
    `Average messages per match: ${d.messageToMatchRatio}`,
    `Activity window: ${span}`,
    `Media attachments in export: ${d.mediaFileCount}`,
    "",
    "Return ONLY a single JSON object, no prose, no code fences, with this exact shape:",
    "{",
    '  "narrativeRead": "2-4 sentence summary in Echo voice of what these numbers actually say about how this person dates",',
    '  "patterns": ["2-5 specific behavioural patterns the numbers imply"],',
    '  "strengths": ["1-3 things they are clearly doing well"],',
    '  "blindspots": ["1-3 things worth examining"],',
    '  "coachingPrompts": ["2-4 questions Echo would ask this person to deepen the read"]',
    "}",
  ].join("\n");
}

/**
 * Strip our own enrichment annotations back out of a stored summary so a
 * recovery re-run starts from the clean parsed numbers.
 */
export function cleanImportSummary(
  stored: Record<string, unknown>,
): HingeParsedSummary {
  const { aiRead, aiError, aiRetryCount, ...rest } =
    stored as Record<string, unknown> & {
      aiRead?: unknown;
      aiError?: unknown;
      aiRetryCount?: unknown;
    };
  void aiRead;
  void aiError;
  void aiRetryCount;
  return rest as unknown as HingeParsedSummary;
}

export async function runImportAiRead(args: {
  app: string;
  importId: number;
  userId: string;
  summary: HingeParsedSummary;
  retryCount?: number;
}): Promise<void> {
  const { app, importId, userId, summary } = args;
  const retryCount = args.retryCount ?? 0;
  const label = importAppLabel(app);
  const system = buildEchoSystemPrompt(
    `Read a person's ${label} data export summary and give them a narrative read of their dating patterns. Return JSON only, no prose, no code fences.`,
  );
  const user = buildImportUserPrompt(app, summary);

  const markFallback = async (reason: string): Promise<void> => {
    await db
      .update(importedSourcesTable)
      .set({
        status: "fallback",
        parsedSummary: {
          ...summary,
          aiError: reason,
          aiRetryCount: nextEnrichRetryCount(reason, retryCount),
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  };

  try {
    const result = await generateWithRetry({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user,
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 8192,
    });

    if (result.isFallback || !result.output) {
      const reason =
        result.error === "consent_required"
          ? "consent_not_granted"
          : (result.error ?? "no_output");
      await markFallback(reason);
      return;
    }

    const raw = result.raw ?? result.output;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      await markFallback("json_parse_failed");
      return;
    }
    const validated = HingeAiReadSchema.safeParse(parsedJson);
    if (!validated.success) {
      await markFallback("schema_validation_failed");
      return;
    }

    const aiRead: HingeAiRead = validated.data;
    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: { ...summary, aiRead },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        importId,
        app,
      },
      "Import AI read enrichment failed",
    );
    await markFallback(
      err instanceof Error ? err.message : "unknown_error",
    ).catch(() => {
      // already logged
    });
  }
}

// ---------------------------------------------------------------------------
// Instagram paste tone read enrichment
// ---------------------------------------------------------------------------

const InstagramToneReadSchema = z.object({
  tone: z.object({
    adjectives: z.array(z.string().trim().min(1).max(40)).min(3).max(5),
    voiceSummary: z.string().trim().min(1).max(600),
  }),
  datingRelevant: z.object({
    signals: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
    suggestions: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
  }),
});
export type InstagramToneRead = z.infer<typeof InstagramToneReadSchema>;

function buildVoiceSummary(
  adjectives: string[],
  emojiCount: number,
  questions: number,
): string {
  const lead = adjectives.slice(0, 3).join(", ");
  const energy =
    emojiCount >= 2
      ? "Their captions carry visible energy and warmth."
      : "Their captions stay measured and let the detail do the work.";
  const close =
    questions >= 1
      ? "They tend to invite a response rather than just broadcast."
      : "They lean toward statements over questions, so give them an easy hook to reply to.";
  return `Reads as ${lead}. ${energy} ${close}`;
}

export function deterministicInstagramTone(
  bio: string,
  captions: string[],
): InstagramToneRead {
  const text = `${bio}\n${captions.join("\n")}`;
  const corpus = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => corpus.includes(w));

  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;

  const adjectives: string[] = [];
  const signals: string[] = [];
  const suggestions: string[] = [];

  if (emojiCount >= 2 || exclamations >= 2) adjectives.push("playful");
  if (questions >= 1) adjectives.push("curious");

  const themes: {
    words: string[];
    adjective: string;
    signal: string;
    suggestion: string;
  }[] = [
    { words: ["travel", "wander", "passport", "flight", "trip", "abroad", "adventure", "explore"], adjective: "adventurous", signal: "Travel and new places are a core part of how they spend their energy.", suggestion: "Open with a specific place from their captions and ask what pulled them there." },
    { words: ["gym", "run", "running", "lift", "yoga", "hike", "climb", "marathon", "fitness", "workout"], adjective: "energetic", signal: "An active, physical lifestyle shows up often, so shared-activity dates will land.", suggestion: "Suggest an active first date that matches their pace, like a walk-and-coffee or a class." },
    { words: ["coffee", "ramen", "brunch", "cook", "baking", "wine", "restaurant", "foodie", "dinner", "taco"], adjective: "warm", signal: "Food and small rituals are how they connect, so casual sit-down dates suit them.", suggestion: "Reference a food spot they mentioned and propose trying one together." },
    { words: ["art", "music", "paint", "write", "film", "photo", "design", "creative", "studio", "band"], adjective: "expressive", signal: "A creative streak runs through their voice; they value originality over polish.", suggestion: "Ask about the work behind one of their posts instead of complimenting the result." },
    { words: ["beach", "mountain", "trail", "camp", "ocean", "sunset", "lake", "outdoors", "nature"], adjective: "grounded", signal: "Outdoor and nature moments recur, hinting at someone who recharges away from screens.", suggestion: "Float a low-key outdoor plan that gives room to actually talk." },
    { words: ["book", "read", "reading", "novel", "library", "bookshop", "poetry"], adjective: "thoughtful", signal: "A reflective, reading-leaning side suggests they value depth in conversation.", suggestion: "Trade a recommendation and ask what they are into right now." },
    { words: ["friends", "party", "night out", "weekend", "crew", "squad", "dancing"], adjective: "outgoing", signal: "A strong social orbit means they likely enjoy people-rich, lively settings.", suggestion: "Lean into a fun, social-flavored first plan rather than an intense one-on-one." },
    { words: ["dog", "cat", "puppy", "pup", "rescue", "kitten"], adjective: "soft", signal: "Pets feature prominently, an easy warmth and conversation anchor.", suggestion: "Ask about their pet by name; it is a reliably warm opener." },
    { words: ["work", "founder", "startup", "building", "launch", "career", "hustle", "project"], adjective: "driven", signal: "Ambition and building things come through; they will respect direction and intent.", suggestion: "Acknowledge what they are building before pivoting to something personal." },
  ];

  for (const t of themes) {
    if (has(t.words)) {
      adjectives.push(t.adjective);
      signals.push(t.signal);
      suggestions.push(t.suggestion);
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 12) adjectives.push("direct");
  else if (wordCount >= 60) adjectives.push("expansive");

  const dedupe = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

  let adj = dedupe(adjectives);
  for (const a of ["genuine", "approachable", "easygoing", "warm", "grounded"]) {
    if (adj.length >= 3) break;
    if (!adj.includes(a)) adj.push(a);
  }
  adj = adj.slice(0, 5);

  let sig = dedupe(signals);
  for (const s of [
    "Their bio leans on everyday detail over big claims, which reads as authentic.",
    "There is enough specificity here to start a real conversation, not just a generic compliment.",
  ]) {
    if (sig.length >= 2) break;
    if (!sig.includes(s)) sig.push(s);
  }
  sig = sig.slice(0, 5);

  let sug = dedupe(suggestions);
  for (const s of [
    "Pick the single most specific detail they shared and ask one genuine follow-up.",
    "Match their energy: keep the first message short, warm, and easy to answer.",
  ]) {
    if (sug.length >= 2) break;
    if (!sug.includes(s)) sug.push(s);
  }
  sug = sug.slice(0, 4);

  return {
    tone: { adjectives: adj, voiceSummary: buildVoiceSummary(adj, emojiCount, questions) },
    datingRelevant: { signals: sig, suggestions: sug },
  };
}

function buildIgUserPrompt(bio: string, captions: string[]): string {
  const captionBlock =
    captions.length === 0
      ? "(none provided)"
      : captions.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return [
    "Read this person's Instagram bio and recent captions. Extract the dating-relevant tone signature.",
    "",
    "Return ONLY a single JSON object, no prose, no code fences, with this exact shape:",
    "{",
    '  "tone": { "adjectives": [3-5 short adjectives], "voiceSummary": "1-3 sentence summary of how they sound" },',
    '  "datingRelevant": { "signals": [2-5 things this tells you about how they would show up dating], "suggestions": [2-4 concrete openers or angles that would land in their voice] }',
    "}",
    "",
    "Bio:",
    bio,
    "",
    "Recent captions:",
    captionBlock,
  ].join("\n");
}

export async function runInstagramToneRead(args: {
  importId: number;
  userId: string;
  bio: string;
  captions: string[];
  originalPayload: { bio: string; recentCaptions: string[] };
}): Promise<void> {
  const { importId, userId, bio, captions, originalPayload } = args;
  const system = buildEchoSystemPrompt(
    "Extract the dating-relevant tone signature from this Instagram bio and recent captions. Return JSON only, no prose, no code fences.",
  );
  const user = buildIgUserPrompt(bio, captions);
  const deterministic = deterministicInstagramTone(bio, captions);

  const serveDeterministic = async (reason: string): Promise<void> => {
    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: {
          ...originalPayload,
          aiToneRead: deterministic,
          toneEngine: "deterministic",
          aiError: reason,
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  };

  try {
    const result = await generateWithRetry({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user,
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 8192,
    });

    if (result.isFallback || !result.output) {
      const reason =
        result.error === "consent_required"
          ? "consent_not_granted"
          : (result.error ?? "no_output");
      await serveDeterministic(reason);
      return;
    }

    const raw = result.raw ?? result.output;
    const parsed = extractAndValidateJson<InstagramToneRead>(
      InstagramToneReadSchema,
      raw,
    );
    if (!parsed.ok) {
      await serveDeterministic("schema_validation_failed");
      return;
    }

    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: {
          ...originalPayload,
          aiToneRead: parsed.value,
          toneEngine: "anthropic",
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        importId,
      },
      "Instagram tone read enrichment failed, serving deterministic read",
    );
    await serveDeterministic(
      err instanceof Error ? err.message : "unknown_error",
    ).catch(() => {
      // swallow, we already logged the original failure
    });
  }
}

// ---------------------------------------------------------------------------
// Voice intro read enrichment
// ---------------------------------------------------------------------------

/**
 * Derived acoustic metrics computed in the browser from a short voice intro.
 * The recording itself is never uploaded; only these numbers are ever stored or
 * sent to any prompt.
 */
export interface VoiceMetrics {
  /** How many seconds the user spoke. */
  durationSec: number;
  /** Average loudness, normalized 0-1. */
  energy: number;
  /** How much loudness varies over time, 0-1 (expressive vs flat). */
  dynamics: number;
  /** Speech onsets per second, a proxy for how fast and animated delivery is. */
  pace: number;
  /** Fraction of the take that was speech rather than silence, 0-1. */
  speechRatio: number;
}

export const VoiceIntroReadSchema = z.object({
  read: z.object({
    warmth: z.string().trim().min(1).max(60),
    energy: z.string().trim().min(1).max(60),
    pace: z.string().trim().min(1).max(60),
  }),
  summary: z.string().trim().min(1).max(600),
  datingRelevant: z.object({
    signals: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
    suggestions: z.array(z.string().trim().min(1).max(200)).min(2).max(3),
  }),
});
export type VoiceIntroRead = z.infer<typeof VoiceIntroReadSchema>;

export function deterministicVoiceRead(metrics: VoiceMetrics): VoiceIntroRead {
  const { durationSec, energy, dynamics, pace, speechRatio } = metrics;

  const warmth =
    energy >= 0.66
      ? "Warm and full, easy to be around"
      : energy >= 0.33
        ? "Even and approachable"
        : "Calm and understated";

  const energyLabel =
    dynamics >= 0.6
      ? "Expressive, your tone moves with what you say"
      : dynamics >= 0.3
        ? "Steady with natural lift"
        : "Level and measured throughout";

  const paceLabel =
    pace >= 3
      ? "Quick and lively"
      : pace >= 1
        ? "Natural, easy to follow"
        : "Unhurried, you give words room";

  const lengthNote =
    durationSec < 10
      ? "You kept it short, which reads as confident when the delivery is clear."
      : durationSec <= 40
        ? "You gave a real sample of how you actually sound."
        : "You spoke generously, so there is plenty of presence to read.";

  const spaceNote =
    speechRatio >= 0.75
      ? "You spoke throughout with little hesitation."
      : speechRatio >= 0.4
        ? "You left a few natural pauses, which reads as relaxed."
        : "You left a lot of space, so a touch more talking would help us read you.";

  const summary = `${warmth.toLowerCase().replace(/,.*/, "")} voice with a ${paceLabel.toLowerCase()} pace. ${lengthNote} ${spaceNote}`;

  const signals: string[] = [];
  if (energy >= 0.5)
    signals.push(
      "Your energy comes through on first listen, which lands well in a voice note or a first call.",
    );
  else
    signals.push(
      "Your calm delivery reads as grounded; it suits someone who values steadiness.",
    );
  if (dynamics >= 0.4)
    signals.push(
      "An expressive range suggests you are comfortable being yourself out loud.",
    );
  else
    signals.push(
      "A level tone suggests you choose words carefully; people will lean in to listen.",
    );
  if (pace >= 2)
    signals.push(
      "A lively pace works in playful, fast-moving conversation.",
    );

  const suggestions: string[] = [
    "Lead a first call with a voice note if the app allows it; how you sound is a strength worth using early.",
    pace >= 3
      ? "Slow down a touch on the important lines so they land."
      : "A little more lift on the openers will make the warmth obvious.",
  ];

  return {
    read: { warmth, energy: energyLabel, pace: paceLabel },
    summary: summary.trim(),
    datingRelevant: {
      signals: signals.slice(0, 4),
      suggestions: suggestions.slice(0, 3),
    },
  };
}

function buildVoicePrompt(metrics: VoiceMetrics): string {
  const { durationSec, energy, dynamics, pace, speechRatio } = metrics;
  return [
    "Read this person's voice intro from derived acoustic metrics only. No audio, words, or transcript were shared, just these numbers. Give a warm, honest read of how they likely come across.",
    "",
    `Length spoken: ${durationSec.toFixed(1)} seconds`,
    `Energy (average loudness, 0-1): ${energy.toFixed(2)}`,
    `Dynamics (how much loudness varies, 0-1): ${dynamics.toFixed(2)}`,
    `Pace (speech onsets per second): ${pace.toFixed(2)}`,
    `Speech ratio (speech vs silence, 0-1): ${speechRatio.toFixed(2)}`,
    "",
    "Return ONLY a single JSON object, no prose, no code fences, with this exact shape:",
    "{",
    '  "read": { "warmth": "short label", "energy": "short label", "pace": "short label" },',
    '  "summary": "1-3 sentence read of how they sound and come across",',
    '  "datingRelevant": { "signals": [2-4 things this implies about how they would show up dating], "suggestions": [2-3 concrete ways to use their voice as a strength] }',
    "}",
  ].join("\n");
}

export async function runVoiceIntroRead(args: {
  importId: number;
  userId: string;
  metrics: VoiceMetrics;
}): Promise<void> {
  const { importId, userId, metrics } = args;
  const system = buildEchoSystemPrompt(
    "Read how a person comes across from the derived acoustic metrics of their voice intro. No audio or words were shared. Return JSON only, no prose, no code fences.",
  );
  const user = buildVoicePrompt(metrics);
  const deterministic = deterministicVoiceRead(metrics);
  const originalPayload = { metrics, counts: { items: 1 } };

  const serveDeterministic = async (reason: string): Promise<void> => {
    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: {
          ...originalPayload,
          aiVoiceRead: deterministic,
          voiceEngine: "deterministic",
          aiError: reason,
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  };

  try {
    const result = await generateWithRetry({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      system,
      user,
      expectJson: true,
      requireContentConsent: true,
      userId,
      maxTokens: 8192,
    });

    if (result.isFallback || !result.output) {
      const reason =
        result.error === "consent_required"
          ? "consent_not_granted"
          : (result.error ?? "no_output");
      await serveDeterministic(reason);
      return;
    }

    const raw = result.raw ?? result.output;
    const parsed = extractAndValidateJson<VoiceIntroRead>(
      VoiceIntroReadSchema,
      raw,
    );
    if (!parsed.ok) {
      await serveDeterministic("schema_validation_failed");
      return;
    }

    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: {
          ...originalPayload,
          aiVoiceRead: parsed.value,
          voiceEngine: "anthropic",
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        importId,
      },
      "Voice intro read enrichment failed, serving deterministic read",
    );
    await serveDeterministic(
      err instanceof Error ? err.message : "unknown_error",
    ).catch(() => {
      // swallow, we already logged the original failure
    });
  }
}

// ---------------------------------------------------------------------------
// Recovery dispatcher (used by importRecoveryJob)
// ---------------------------------------------------------------------------

export interface RecoverableRow {
  id: number;
  userId: string | null;
  source: string;
  status: string;
  parsedSummary: Record<string, unknown> | null;
}

/**
 * Re-run enrichment for a single stranded row. Returns the action taken so the
 * sweep can log a useful summary. A row is only recoverable when it belongs to
 * a signed-in user (anon rows never reach the model) and its source supports
 * AI enrichment.
 */
export async function reenrichImportRow(
  row: RecoverableRow,
): Promise<"reenriched" | "skipped"> {
  if (!row.userId || !row.parsedSummary) return "skipped";

  if ((DATING_APP_IMPORT_SOURCES as readonly string[]).includes(row.source)) {
    const retryCount =
      typeof row.parsedSummary.aiRetryCount === "number"
        ? row.parsedSummary.aiRetryCount
        : 0;
    await runImportAiRead({
      app: row.source,
      importId: row.id,
      userId: row.userId,
      summary: cleanImportSummary(row.parsedSummary),
      retryCount,
    });
    return "reenriched";
  }

  if (row.source === "instagram-paste") {
    const bio =
      typeof row.parsedSummary.bio === "string" ? row.parsedSummary.bio : "";
    const captions = Array.isArray(row.parsedSummary.recentCaptions)
      ? (row.parsedSummary.recentCaptions as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : [];
    await runInstagramToneRead({
      importId: row.id,
      userId: row.userId,
      bio,
      captions,
      originalPayload: { bio, recentCaptions: captions },
    });
    return "reenriched";
  }

  return "skipped";
}
