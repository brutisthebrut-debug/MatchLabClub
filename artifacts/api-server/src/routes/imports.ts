import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import multer from "multer";
import unzipper from "unzipper";
import { z } from "zod";
import { db, importedSourcesTable } from "@workspace/db";
import { buildEchoSystemPrompt } from "@workspace/echo";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { generate } from "../lib/aiService";
import { parseCalendarIcs } from "../lib/calendarParser";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("invalid_mime"));
      return;
    }
    cb(null, true);
  },
});

interface HingeMatchRecord {
  match?: { timestamp?: string }[];
  chats?: { timestamp?: string; body?: string }[];
  block?: unknown;
  like?: { timestamp?: string }[];
}

interface DerivedStats {
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

interface HingeParsedSummary {
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

function categorizeFilename(name: string): "match" | "user" | "prompt" | "other" {
  const lower = name.toLowerCase();
  if (lower.includes("match") || lower.includes("message")) return "match";
  if (lower.includes("user") || lower.includes("profile")) return "user";
  if (lower.includes("prompt")) return "prompt";
  return "other";
}

function isoOrNull(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * Walk the parsed Hinge `matches.json` shape (an array of per-match records,
 * each with optional `match`, `chats`, `like`, `block` sub-arrays) and roll
 * up the counts we care about. Defensive — Hinge has shipped at least two
 * shapes for this file over the years, and other categorised files (user,
 * prompts) might be objects rather than arrays.
 */
function rollupMatches(records: unknown): {
  matches: number;
  conversations: number;
  messagesSent: number;
  oldestMs: number | null;
  newestMs: number | null;
  topConversationLength: number;
} {
  if (!Array.isArray(records)) {
    return {
      matches: 0,
      conversations: 0,
      messagesSent: 0,
      oldestMs: null,
      newestMs: null,
      topConversationLength: 0,
    };
  }
  let matches = 0;
  let conversations = 0;
  let messagesSent = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  let topLen = 0;
  for (const entry of records as HingeMatchRecord[]) {
    if (!entry || typeof entry !== "object") continue;
    const matchEvents = Array.isArray(entry.match) ? entry.match : [];
    const chats = Array.isArray(entry.chats) ? entry.chats : [];
    if (matchEvents.length > 0) matches += 1;
    if (chats.length > 0) {
      conversations += 1;
      messagesSent += chats.length;
      if (chats.length > topLen) topLen = chats.length;
    }
    for (const m of matchEvents) {
      const t = m && typeof m === "object" ? Date.parse(m.timestamp ?? "") : NaN;
      if (Number.isFinite(t)) {
        if (oldest === null || t < oldest) oldest = t;
        if (newest === null || t > newest) newest = t;
      }
    }
    for (const c of chats) {
      const t = c && typeof c === "object" ? Date.parse(c.timestamp ?? "") : NaN;
      if (Number.isFinite(t)) {
        if (oldest === null || t < oldest) oldest = t;
        if (newest === null || t > newest) newest = t;
      }
    }
  }
  return {
    matches,
    conversations,
    messagesSent,
    oldestMs: oldest,
    newestMs: newest,
    topConversationLength: topLen,
  };
}

async function parseHingeZip(
  buffer: Buffer,
  originalFilename: string | null,
): Promise<HingeParsedSummary> {
  let directory: Awaited<ReturnType<typeof unzipper.Open.buffer>>;
  try {
    directory = await unzipper.Open.buffer(buffer);
  } catch {
    throw new Error("invalid_zip");
  }

  let jsonFiles = 0;
  let mediaFiles = 0;
  let agg = rollupMatches([]);

  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const name = file.path;
    const lower = name.toLowerCase();
    if (lower.endsWith(".json")) {
      jsonFiles += 1;
      const category = categorizeFilename(name);
      if (category !== "match") continue;
      try {
        const contents = await file.buffer();
        const parsed: unknown = JSON.parse(contents.toString("utf8"));
        const rollup = rollupMatches(parsed);
        agg = {
          matches: agg.matches + rollup.matches,
          conversations: agg.conversations + rollup.conversations,
          messagesSent: agg.messagesSent + rollup.messagesSent,
          oldestMs:
            agg.oldestMs === null
              ? rollup.oldestMs
              : rollup.oldestMs === null
                ? agg.oldestMs
                : Math.min(agg.oldestMs, rollup.oldestMs),
          newestMs:
            agg.newestMs === null
              ? rollup.newestMs
              : rollup.newestMs === null
                ? agg.newestMs
                : Math.max(agg.newestMs, rollup.newestMs),
          topConversationLength: Math.max(
            agg.topConversationLength,
            rollup.topConversationLength,
          ),
        };
      } catch {
        // Skip unparseable JSON file. Counts will reflect what we could read.
      }
    } else if (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".mp4")
    ) {
      mediaFiles += 1;
    }
  }

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

  void isoOrNull; // referenced for future per-file timestamp use

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

const HingeAiReadSchema = z.object({
  narrativeRead: z.string().trim().min(1).max(800),
  patterns: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
  strengths: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  blindspots: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  coachingPrompts: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
});
type HingeAiRead = z.infer<typeof HingeAiReadSchema>;

function buildHingeUserPrompt(summary: HingeParsedSummary): string {
  const d = summary.derivedStats;
  const span =
    d.oldestMatchAt && d.newestMatchAt
      ? `from ${d.oldestMatchAt.slice(0, 10)} to ${d.newestMatchAt.slice(0, 10)}`
      : "with no datestamped activity we could read";
  return [
    "Read this person's Hinge history summary and give a narrative read of their dating patterns. The numbers below are all you have. No raw messages were shared.",
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

async function runHingeAiRead(args: {
  importId: number;
  userId: string;
  summary: HingeParsedSummary;
}): Promise<void> {
  const { importId, userId, summary } = args;
  const system = buildEchoSystemPrompt(
    "Read a person's Hinge GDPR export summary and give them a narrative read of their dating patterns. Return JSON only, no prose, no code fences.",
  );
  const user = buildHingeUserPrompt(summary);

  try {
    const result = await generate(
      {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        system,
        user,
        expectJson: true,
        requireContentConsent: true,
        userId,
        maxTokens: 8192,
      },
      "",
    );

    if (result.isFallback || !result.output) {
      const reason =
        result.error === "consent_required"
          ? "consent_not_granted"
          : (result.error ?? "no_output");
      await db
        .update(importedSourcesTable)
        .set({
          status: "fallback",
          parsedSummary: { ...summary, aiError: reason },
          processedAt: new Date(),
        })
        .where(eq(importedSourcesTable.id, importId));
      return;
    }

    const raw = result.raw ?? result.output;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      await db
        .update(importedSourcesTable)
        .set({
          status: "fallback",
          parsedSummary: { ...summary, aiError: "json_parse_failed" },
          processedAt: new Date(),
        })
        .where(eq(importedSourcesTable.id, importId));
      return;
    }
    const validated = HingeAiReadSchema.safeParse(parsedJson);
    if (!validated.success) {
      await db
        .update(importedSourcesTable)
        .set({
          status: "fallback",
          parsedSummary: { ...summary, aiError: "schema_validation_failed" },
          processedAt: new Date(),
        })
        .where(eq(importedSourcesTable.id, importId));
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
      },
      "Hinge AI read enrichment failed",
    );
    await db
      .update(importedSourcesTable)
      .set({
        status: "fallback",
        parsedSummary: {
          ...summary,
          aiError: err instanceof Error ? err.message : "unknown_error",
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId))
      .catch(() => {
        // already logged
      });
  }
}

function ownerScope(req: Request): SQL {
  if (req.user?.id) return eq(importedSourcesTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(importedSourcesTable.userId),
      eq(importedSourcesTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

type Row = typeof importedSourcesTable.$inferSelect;

function serialize(row: Row): {
  id: number;
  source: string;
  status: string;
  originalFilename: string | null;
  parsedSummary: Record<string, unknown> | null;
  uploadedAt: string;
  processedAt: string | null;
} {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    originalFilename: row.originalFilename ?? null,
    parsedSummary: (row.parsedSummary ?? null) as Record<string, unknown> | null,
    uploadedAt:
      row.uploadedAt instanceof Date
        ? row.uploadedAt.toISOString()
        : String(row.uploadedAt),
    processedAt: row.processedAt
      ? row.processedAt instanceof Date
        ? row.processedAt.toISOString()
        : String(row.processedAt)
      : null,
  };
}

function parseIdParam(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(v ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.post(
  "/imports/hinge",
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ error: "File too large. 50MB maximum." });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        const msg = err instanceof Error ? err.message : "upload_failed";
        if (msg === "invalid_mime") {
          res.status(415).json({
            error: "Only .zip uploads are accepted for Hinge data exports.",
          });
          return;
        }
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file || !file.buffer || file.size === 0) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    let summary: HingeParsedSummary;
    try {
      summary = await parseHingeZip(file.buffer, file.originalname ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "parse_failed";
      if (msg === "invalid_zip") {
        res.status(400).json({
          error:
            "That file does not look like a valid ZIP. Upload the original export from Hinge without unzipping it first.",
        });
        return;
      }
      res.status(400).json({ error: msg });
      return;
    }

    const userId = req.user?.id;
    const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

    const [inserted] = await db
      .insert(importedSourcesTable)
      .values({
        userId: userId ?? null,
        anonymousClaimToken: anonToken,
        source: "hinge",
        status: "pending",
        originalFilename: file.originalname ?? null,
        parsedSummary: summary as unknown as Record<string, unknown>,
      })
      .returning();

    req.log.info(
      {
        userId: userId ?? null,
        importId: inserted?.id,
        matches: summary.counts.matches,
        conversations: summary.counts.conversations,
      },
      "Captured Hinge GDPR import",
    );

    res.status(201).json(serialize(inserted!));

    if (userId && inserted?.id) {
      setImmediate(() => {
        void runHingeAiRead({
          importId: inserted.id,
          userId,
          summary,
        });
      });
    }
  },
);

const CalendarImportInput = z.object({
  icsContent: z.string().min(1).max(2_000_000),
});

router.post(
  "/imports/calendar",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CalendarImportInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Paste the contents of a .ics calendar file." });
      return;
    }

    let summary;
    try {
      summary = parseCalendarIcs(parsed.data.icsContent);
    } catch {
      res.status(400).json({ error: "That does not look like a calendar (.ics) file." });
      return;
    }

    if (summary.counts.totalEvents === 0) {
      res.status(400).json({
        error:
          "No calendar events found in that paste. Make sure you copied the whole .ics file.",
      });
      return;
    }

    const userId = req.user?.id;
    const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

    const [inserted] = await db
      .insert(importedSourcesTable)
      .values({
        userId: userId ?? null,
        anonymousClaimToken: anonToken,
        source: "calendar-ics",
        status: "complete",
        originalFilename: null,
        parsedSummary: summary as unknown as Record<string, unknown>,
        processedAt: new Date(),
      })
      .returning();

    req.log.info(
      {
        userId: userId ?? null,
        importId: inserted?.id,
        events: summary.counts.totalEvents,
      },
      "Captured calendar .ics import",
    );

    res.status(201).json(serialize(inserted!));
  },
);

router.get("/imports", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(importedSourcesTable)
    .where(and(ownerScope(req), isNull(importedSourcesTable.deletedAt)) as SQL)
    .orderBy(desc(importedSourcesTable.uploadedAt))
    .limit(50);
  res.json({ imports: rows.map(serialize) });
});

router.get("/imports/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Import not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.id, id),
        ownerScope(req),
        isNull(importedSourcesTable.deletedAt),
      ) as SQL,
    );
  if (!row) {
    res.status(404).json({ error: "Import not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete(
  "/imports/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    const deleted = await db
      .delete(importedSourcesTable)
      .where(
        and(eq(importedSourcesTable.id, id), ownerScope(req)) as SQL,
      )
      .returning({ id: importedSourcesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    res.json({ deleted: true, id });
  },
);

export default router;
