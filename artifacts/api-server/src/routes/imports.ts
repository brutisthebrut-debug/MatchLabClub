import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import multer from "multer";
import unzipper from "unzipper";
import { z } from "zod";
import { db, importedSourcesTable } from "@workspace/db";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { parseCalendarIcs } from "../lib/calendarParser";
import {
  importAppLabel,
  reenrichImportRow,
  type HingeParsedSummary,
  type DerivedStats,
} from "../lib/importEnrichment";
import { parseTinderZip, parseBumbleZip } from "../lib/datingImports";

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

/**
 * Permissive schema for a single Hinge `matches.json` record. Hinge has shipped
 * more than one shape over the years, so every field is optional and unknown
 * keys pass through. We only validate the structure enough to roll up counts;
 * we never read message bodies. A record that does not match this shape is
 * dropped rather than throwing, so one malformed entry cannot zero out a whole
 * export.
 */
const HingeTimestamped = z
  .object({ timestamp: z.string().optional() })
  .passthrough();

const HingeMatchRecordSchema = z
  .object({
    match: z.array(HingeTimestamped).optional(),
    chats: z.array(HingeTimestamped).optional(),
    like: z.array(HingeTimestamped).optional(),
    block: z.unknown().optional(),
  })
  .passthrough();

const HingeRecordsSchema = z.array(z.unknown());

type HingeMatchRecord = z.infer<typeof HingeMatchRecordSchema>;

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
 * up the counts we care about. Defensive, Hinge has shipped at least two
 * shapes for this file over the years, and other categorised files (user,
 * prompts) might be objects rather than arrays.
 */
export function rollupMatches(records: unknown): {
  matches: number;
  conversations: number;
  messagesSent: number;
  oldestMs: number | null;
  newestMs: number | null;
  topConversationLength: number;
} {
  const arr = HingeRecordsSchema.safeParse(records);
  if (!arr.success) {
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
  for (const candidate of arr.data) {
    const validated = HingeMatchRecordSchema.safeParse(candidate);
    if (!validated.success) continue;
    const entry: HingeMatchRecord = validated.data;
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
  permissions: {
    storage: "saved";
    echoUse: boolean;
    learningConfirmed: boolean;
    matchingUse: boolean;
  };
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
    permissions: {
      storage: "saved",
      echoUse: Boolean(row.echoUseAllowed),
      learningConfirmed: Boolean(row.learningConfirmed),
      matchingUse: Boolean(row.matchingUseAllowed),
    },
  };
}

function parseIdParam(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(v ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// The parametrized dating-app import route (`POST /imports/:app`) is registered
// AFTER the calendar route below so that "/imports/calendar" matches its own
// handler first instead of being captured as `:app`.

const CalendarImportInput = z.object({
  icsContent: z.string().min(1).max(2_000_000),
});

const ImportPermissionPatch = z
  .object({
    echoUse: z.boolean().optional(),
    learningConfirmed: z.boolean().optional(),
    matchingUse: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.echoUse !== undefined ||
      value.learningConfirmed !== undefined ||
      value.matchingUse !== undefined,
    { message: "Supply at least one permission change." },
  );

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

/**
 * Parsers keyed by the `:app` path segment. The keys double as the route
 * allowlist: a `:app` value with no parser here is rejected as unknown. Each
 * parser returns the same summary shape, so downstream enrichment and the
 * frontend are app-agnostic.
 */
const IMPORT_PARSERS: Record<
  string,
  (buffer: Buffer, originalFilename: string | null) => Promise<HingeParsedSummary>
> = {
  hinge: parseHingeZip,
  tinder: parseTinderZip,
  bumble: parseBumbleZip,
};

router.post(
  "/imports/:app",
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
            error: "Only .zip uploads are accepted for dating app data exports.",
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
    const app = Array.isArray(req.params.app)
      ? req.params.app[0]
      : req.params.app;
    const parser = app ? IMPORT_PARSERS[app] : undefined;
    if (!app || !parser) {
      res.status(404).json({ error: "Unknown import source." });
      return;
    }

    const file = req.file;
    if (!file || !file.buffer || file.size === 0) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const label = importAppLabel(app);
    let summary: HingeParsedSummary;
    try {
      summary = await parser(file.buffer, file.originalname ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "parse_failed";
      if (msg === "invalid_zip") {
        res.status(400).json({
          error: `That file does not look like a valid ZIP. Upload the original export from ${label} without unzipping it first.`,
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
        source: app,
        status: "complete",
        originalFilename: file.originalname ?? null,
        parsedSummary: summary as unknown as Record<string, unknown>,
      })
      .returning();

    req.log.info(
      {
        userId: userId ?? null,
        importId: inserted?.id,
        app,
        matches: summary.counts.matches,
        conversations: summary.counts.conversations,
      },
      "Captured dating app data import",
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

router.patch(
  "/imports/:id/permissions",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    const parsed = ImportPermissionPatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.id, id),
          ownerScope(req),
          isNull(importedSourcesTable.deletedAt),
        ) as SQL,
      );
    if (!existing) {
      res.status(404).json({ error: "Import not found" });
      return;
    }

    const now = new Date();
    const patch: Partial<typeof importedSourcesTable.$inferInsert> = {};
    if (parsed.data.echoUse !== undefined) {
      patch.echoUseAllowed = parsed.data.echoUse;
      patch.echoUseUpdatedAt = now;
    }
    if (parsed.data.learningConfirmed !== undefined) {
      patch.learningConfirmed = parsed.data.learningConfirmed;
      patch.learningConfirmedAt = parsed.data.learningConfirmed ? now : null;
    }
    if (parsed.data.matchingUse !== undefined) {
      patch.matchingUseAllowed = parsed.data.matchingUse;
      patch.matchingUseUpdatedAt = now;
    }

    const shouldEnrich =
      parsed.data.echoUse === true &&
      !existing.echoUseAllowed &&
      Boolean(req.user?.id) &&
      (Boolean(IMPORT_PARSERS[existing.source]) ||
        existing.source === "instagram-paste" ||
        existing.source === "voice-intro") &&
      Boolean(existing.parsedSummary);
    if (shouldEnrich) patch.status = "pending";
    if (parsed.data.echoUse === false && existing.status === "pending") {
      patch.status = "complete";
    }

    const [updated] = await db
      .update(importedSourcesTable)
      .set(patch)
      .where(
        and(
          eq(importedSourcesTable.id, id),
          ownerScope(req),
          isNull(importedSourcesTable.deletedAt),
        ) as SQL,
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Import not found" });
      return;
    }

    req.log.info(
      {
        userId: req.user?.id ?? null,
        importId: id,
        changes: parsed.data,
      },
      "Updated imported-source permissions",
    );

    res.json(serialize(updated));

    if (shouldEnrich) {
      setImmediate(() => {
        void reenrichImportRow({
          id: existing.id,
          source: existing.source,
          userId: req.user!.id,
          status: "pending",
          parsedSummary: existing.parsedSummary,
        });
      });
    }
  },
);

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
