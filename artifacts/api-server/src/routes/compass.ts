import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, compatibilityReadsTable } from "@workspace/db";
import { SaveCompassReadBody } from "@workspace/api-zod";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { extractProfileFromScreenshot } from "../lib/ocr";

const router: IRouter = Router();

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCREENSHOT_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(new Error("invalid_mime"));
      return;
    }
    cb(null, true);
  },
});

function ownerScope(req: Request): SQL {
  if (req.user?.id) return eq(compatibilityReadsTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(compatibilityReadsTable.userId),
      eq(compatibilityReadsTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

type Row = typeof compatibilityReadsTable.$inferSelect;

function serialize(row: Row) {
  const parsed = (row.parsedProfile ?? {}) as {
    connectionStyle?: string;
    patterns?: unknown;
    notes?: string | null;
  };
  const result = (row.resultJson ?? {}) as {
    deterministicResult?: Record<string, unknown>;
    aiResult?: Record<string, unknown> | null;
  };
  const patterns = Array.isArray(parsed.patterns)
    ? parsed.patterns.filter((p): p is string => typeof p === "string")
    : [];
  return {
    id: row.id,
    connectionStyle: typeof parsed.connectionStyle === "string" ? parsed.connectionStyle : row.rawText,
    patterns,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
    deterministicResult: result.deterministicResult ?? {},
    aiResult: result.aiResult ?? null,
    mode: row.mode,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

function parseIdParam(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(v ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.post(
  "/compass/extract-screenshot",
  (req: Request, res: Response, next: NextFunction) => {
    screenshotUpload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "Image is too large. Max 10MB." });
          return;
        }
        res.status(400).json({ error: "Upload failed. Try a different image." });
        return;
      }
      if (err instanceof Error && err.message === "invalid_mime") {
        res.status(415).json({ error: "Unsupported image format. Use PNG, JPG, or WEBP." });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: "Missing image upload. Use the 'file' field." });
      return;
    }
    try {
      const base64 = file.buffer.toString("base64");
      const extracted = await extractProfileFromScreenshot(base64);
      const text = (extracted.rawText || "").trim();
      if (!text) {
        res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
        return;
      }
      res.json({ text });
    } catch (err) {
      req.log.error({ err }, "Compass OCR failed");
      res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
    }
  },
);

router.post("/compass/reads", async (req, res): Promise<void> => {
  const parsed = SaveCompassReadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);
  const aiResult = parsed.data.aiResult ?? null;

  const [inserted] = await db
    .insert(compatibilityReadsTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      sourceKind: "paste",
      rawText: parsed.data.connectionStyle,
      parsedProfile: {
        connectionStyle: parsed.data.connectionStyle,
        patterns: parsed.data.patterns,
        notes: parsed.data.notes ?? null,
      },
      resultJson: {
        deterministicResult: parsed.data.deterministicResult,
        aiResult,
      },
      mode: aiResult ? "live" : "fallback",
    })
    .returning();

  res.status(201).json(serialize(inserted!));
});

router.get("/compass/reads", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(compatibilityReadsTable)
    .where(and(ownerScope(req), isNull(compatibilityReadsTable.deletedAt)) as SQL)
    .orderBy(desc(compatibilityReadsTable.createdAt))
    .limit(50);
  res.json({ reads: rows.map(serialize) });
});

router.get("/compass/reads/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Compass read not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(compatibilityReadsTable)
    .where(
      and(
        eq(compatibilityReadsTable.id, id),
        ownerScope(req),
        isNull(compatibilityReadsTable.deletedAt),
      ) as SQL,
    );
  if (!row) {
    res.status(404).json({ error: "Compass read not found" });
    return;
  }
  res.json(serialize(row));
});

export default router;
