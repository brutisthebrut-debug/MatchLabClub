/**
 * Parsers for dating-app data exports beyond Hinge.
 *
 * Hinge parsing lives in `routes/imports.ts` (`rollupMatches` + `parseHingeZip`)
 * because it predates this file. Tinder and Bumble parsing live here so the
 * route stays a thin dispatcher. Every parser returns the same
 * `ImportParsedSummary` shape Hinge produces, so the enrichment prompt, the
 * recovery sweep, and the frontend `SummaryView` all work unchanged regardless
 * of which app the export came from.
 *
 * Two design rules carry over from the Hinge parser:
 *  1. Never throw on a malformed export. A single bad record is skipped, not
 *     allowed to zero out the whole import. The only thrown error is
 *     `invalid_zip` when the upload is not a readable ZIP at all.
 *  2. Never read message bodies. We roll up counts and date ranges only; the
 *     text inside a message is never returned or stored.
 *
 * Tinder ships a well-documented `data.json` (date-keyed `Usage` maps plus a
 * `Messages` array), so its parser is precise. Bumble has no stable documented
 * export shape, so its parser is deliberately defensive: it walks whatever JSON
 * is in the archive and counts anything that structurally looks like a message.
 * The Bumble copy in the UI says as much.
 */
import unzipper from "unzipper";
import type { DerivedStats, HingeParsedSummary } from "./importEnrichment";

/** Every dating-app parser returns this Hinge-compatible shape. */
export type ImportParsedSummary = HingeParsedSummary;

/** The rolled-up counts a single export yields, before derived stats. */
export interface ImportRollup {
  matches: number;
  conversations: number;
  messagesSent: number;
  oldestMs: number | null;
  newestMs: number | null;
  topConversationLength: number;
}

const ZERO_ROLLUP: ImportRollup = {
  matches: 0,
  conversations: 0,
  messagesSent: 0,
  oldestMs: null,
  newestMs: null,
  topConversationLength: 0,
};

const MEDIA_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mov", ".mp4"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First non-empty string value found among the given keys, else null. */
function firstStringField(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

/** Fold one rollup's date range into a running min/max. */
function mergeDateRange(
  agg: ImportRollup,
  oldestMs: number | null,
  newestMs: number | null,
): { oldestMs: number | null; newestMs: number | null } {
  return {
    oldestMs:
      agg.oldestMs === null
        ? oldestMs
        : oldestMs === null
          ? agg.oldestMs
          : Math.min(agg.oldestMs, oldestMs),
    newestMs:
      agg.newestMs === null
        ? newestMs
        : newestMs === null
          ? agg.newestMs
          : Math.max(agg.newestMs, newestMs),
  };
}

/** Sum two rollups (counts add, dates take the wider span, top length the max). */
export function mergeRollups(a: ImportRollup, b: ImportRollup): ImportRollup {
  const range = mergeDateRange(a, b.oldestMs, b.newestMs);
  return {
    matches: a.matches + b.matches,
    conversations: a.conversations + b.conversations,
    messagesSent: a.messagesSent + b.messagesSent,
    oldestMs: range.oldestMs,
    newestMs: range.newestMs,
    topConversationLength: Math.max(
      a.topConversationLength,
      b.topConversationLength,
    ),
  };
}

/** Turn a finished rollup plus file tallies into the stored summary shape. */
export function buildSummaryFromRollup(
  agg: ImportRollup,
  jsonFiles: number,
  mediaFiles: number,
  originalFilename: string | null,
): ImportParsedSummary {
  const derivedStats: DerivedStats = {
    totalMatches: agg.matches,
    totalConversations: agg.conversations,
    totalMessagesSent: agg.messagesSent,
    oldestMatchAt:
      agg.oldestMs === null ? null : new Date(agg.oldestMs).toISOString(),
    newestMatchAt:
      agg.newestMs === null ? null : new Date(agg.newestMs).toISOString(),
    topConversationLength: agg.topConversationLength,
    messageToMatchRatio:
      agg.matches > 0
        ? Math.round((agg.messagesSent / agg.matches) * 100) / 100
        : 0,
    rawJsonFileCount: jsonFiles,
    mediaFileCount: mediaFiles,
  };
  return {
    counts: {
      matches: agg.matches,
      conversations: agg.conversations,
      messagesSent: agg.messagesSent,
      mediaFiles,
      jsonFiles,
    },
    derivedStats,
    originalFilename,
  };
}

// ---------------------------------------------------------------------------
// Tinder (data.json: date-keyed Usage maps + a Messages array)
// ---------------------------------------------------------------------------

/** Sum a Tinder `Usage` date map ({"2026-01-01": 3, ...}) and its date span. */
function sumDateMap(v: unknown): {
  total: number;
  oldestMs: number | null;
  newestMs: number | null;
} {
  if (!isPlainObject(v)) return { total: 0, oldestMs: null, newestMs: null };
  let total = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  for (const [day, raw] of Object.entries(v)) {
    const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (n <= 0) continue;
    total += n;
    const t = Date.parse(day);
    if (Number.isFinite(t)) {
      if (oldest === null || t < oldest) oldest = t;
      if (newest === null || t > newest) newest = t;
    }
  }
  return { total, oldestMs: oldest, newestMs: newest };
}

const TINDER_MESSAGE_DATE_KEYS = ["sent_date", "date", "timestamp"] as const;

/**
 * Roll up a parsed Tinder `data.json`. Prefers the aggregate `Usage` maps for
 * match and sent-message totals (Tinder's own counts), and falls back to the
 * `Messages` array when those maps are absent. Never reads message text.
 */
export function rollupTinder(data: unknown): ImportRollup {
  if (!isPlainObject(data)) return { ...ZERO_ROLLUP };

  const usage = isPlainObject(data.Usage) ? data.Usage : {};
  const matchesAgg = sumDateMap(usage.matches);
  const sentAgg = sumDateMap(usage.messages_sent);
  const opensAgg = sumDateMap(usage.app_opens);

  const threads = Array.isArray(data.Messages) ? data.Messages : [];
  let conversations = 0;
  let threadMessageTotal = 0;
  let topLen = 0;
  let msgOldest: number | null = null;
  let msgNewest: number | null = null;

  for (const thread of threads) {
    if (!isPlainObject(thread)) continue;
    const msgs = Array.isArray(thread.messages) ? thread.messages : [];
    if (msgs.length > 0) {
      conversations += 1;
      threadMessageTotal += msgs.length;
      if (msgs.length > topLen) topLen = msgs.length;
    }
    for (const m of msgs) {
      if (!isPlainObject(m)) continue;
      const dateStr = firstStringField(m, TINDER_MESSAGE_DATE_KEYS);
      const t = dateStr ? Date.parse(dateStr) : NaN;
      if (Number.isFinite(t)) {
        if (msgOldest === null || t < msgOldest) msgOldest = t;
        if (msgNewest === null || t > msgNewest) msgNewest = t;
      }
    }
  }

  const matches = matchesAgg.total > 0 ? matchesAgg.total : threads.length;
  const messagesSent =
    sentAgg.total > 0 ? sentAgg.total : threadMessageTotal;

  const candidateOldest = [
    matchesAgg.oldestMs,
    sentAgg.oldestMs,
    opensAgg.oldestMs,
    msgOldest,
  ].filter((x): x is number => x !== null);
  const candidateNewest = [
    matchesAgg.newestMs,
    sentAgg.newestMs,
    opensAgg.newestMs,
    msgNewest,
  ].filter((x): x is number => x !== null);

  return {
    matches,
    conversations,
    messagesSent,
    oldestMs: candidateOldest.length > 0 ? Math.min(...candidateOldest) : null,
    newestMs: candidateNewest.length > 0 ? Math.max(...candidateNewest) : null,
    topConversationLength: topLen,
  };
}

// ---------------------------------------------------------------------------
// Bumble (no documented stable shape: defensive structural scan)
// ---------------------------------------------------------------------------

const BUMBLE_TEXT_KEYS = [
  "message",
  "body",
  "text",
  "content",
  "message_text",
  "comment",
] as const;
const BUMBLE_DATE_KEYS = [
  "date",
  "sent_date",
  "timestamp",
  "created",
  "created_at",
  "sent_at",
  "time",
] as const;
const BUMBLE_CONVERSATION_KEYS = [
  "conversation_id",
  "match_id",
  "chat_id",
  "thread_id",
  "conversation",
  "with",
  "other_user_id",
] as const;

const BUMBLE_MAX_DEPTH = 8;

/** An object that structurally looks like a chat message. */
function looksLikeMessage(o: Record<string, unknown>): boolean {
  return firstStringField(o, BUMBLE_TEXT_KEYS) !== null;
}

/** Collect every array anywhere in the JSON tree, depth-bounded. */
function collectArrays(node: unknown, depth: number, out: unknown[][]): void {
  if (depth > BUMBLE_MAX_DEPTH || node === null || node === undefined) return;
  if (Array.isArray(node)) {
    out.push(node);
    for (const el of node) collectArrays(el, depth + 1, out);
    return;
  }
  if (isPlainObject(node)) {
    for (const v of Object.values(node)) collectArrays(v, depth + 1, out);
  }
}

/**
 * Best-effort roll up of a parsed Bumble export fragment. Bumble's export format
 * is undocumented and has varied, so this counts anything that structurally
 * looks like a message rather than relying on a fixed schema. Conversations are
 * derived from explicit conversation ids when present, otherwise from the number
 * of distinct message arrays found. Matches mirror conversations as a proxy,
 * since Bumble does not reliably expose a separate match list.
 */
export function rollupBumble(data: unknown): ImportRollup {
  const arrays: unknown[][] = [];
  collectArrays(data, 0, arrays);
  if (arrays.length === 0) return { ...ZERO_ROLLUP };

  let messagesSent = 0;
  let topLen = 0;
  let messageArrays = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  const conversationIds = new Set<string>();

  for (const arr of arrays) {
    const objects = arr.filter(isPlainObject);
    if (objects.length === 0) continue;
    const sample = objects.slice(0, 20);
    const likeInSample = sample.filter(looksLikeMessage).length;
    if (likeInSample === 0 || likeInSample / sample.length < 0.5) continue;

    messageArrays += 1;
    let perArray = 0;
    for (const o of objects) {
      if (!looksLikeMessage(o)) continue;
      messagesSent += 1;
      perArray += 1;
      const dateStr = firstStringField(o, BUMBLE_DATE_KEYS);
      const t = dateStr ? Date.parse(dateStr) : NaN;
      if (Number.isFinite(t)) {
        if (oldest === null || t < oldest) oldest = t;
        if (newest === null || t > newest) newest = t;
      }
      const conv = firstStringField(o, BUMBLE_CONVERSATION_KEYS);
      if (conv) conversationIds.add(conv);
    }
    if (perArray > topLen) topLen = perArray;
  }

  const conversations =
    conversationIds.size > 0 ? conversationIds.size : messageArrays;

  return {
    matches: conversations,
    conversations,
    messagesSent,
    oldestMs: oldest,
    newestMs: newest,
    topConversationLength: topLen,
  };
}

// ---------------------------------------------------------------------------
// ZIP entry points
// ---------------------------------------------------------------------------

async function parseZipWith(
  buffer: Buffer,
  originalFilename: string | null,
  rollupJson: (parsed: unknown) => ImportRollup,
): Promise<ImportParsedSummary> {
  let directory: Awaited<ReturnType<typeof unzipper.Open.buffer>>;
  try {
    directory = await unzipper.Open.buffer(buffer);
  } catch {
    throw new Error("invalid_zip");
  }

  let jsonFiles = 0;
  let mediaFiles = 0;
  let agg: ImportRollup = { ...ZERO_ROLLUP };

  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const lower = file.path.toLowerCase();
    if (lower.endsWith(".json")) {
      jsonFiles += 1;
      try {
        const contents = await file.buffer();
        const parsed: unknown = JSON.parse(contents.toString("utf8"));
        agg = mergeRollups(agg, rollupJson(parsed));
      } catch {
        // Skip unparseable JSON. Counts reflect what we could read.
      }
    } else if (MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      mediaFiles += 1;
    }
  }

  return buildSummaryFromRollup(agg, jsonFiles, mediaFiles, originalFilename);
}

/** Parse a Tinder data export ZIP into the shared summary shape. */
export function parseTinderZip(
  buffer: Buffer,
  originalFilename: string | null,
): Promise<ImportParsedSummary> {
  return parseZipWith(buffer, originalFilename, rollupTinder);
}

/** Parse a Bumble data export ZIP into the shared summary shape. */
export function parseBumbleZip(
  buffer: Buffer,
  originalFilename: string | null,
): Promise<ImportParsedSummary> {
  return parseZipWith(buffer, originalFilename, rollupBumble);
}
