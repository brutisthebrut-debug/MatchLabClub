import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, compatibilityReadsTable } from "@workspace/db";
import {
  SaveCompassReadBody,
  GetCompassSignalContextResponse,
} from "@workspace/api-zod";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { extractProfileFromScreenshot } from "../lib/ocr";
import { computeReadiness, readinessThreshold } from "./matching";
import { computeNextActions } from "../lib/readiness";
import {
  SIGNAL_REGISTRY,
  describeActiveSignals,
  type ReadinessBreakdown,
} from "../lib/signalRegistry";
import { buildCompassSignalLayer } from "../lib/aiEngine";

/** A per-read snapshot of the user's readiness, stored on the saved read so we
 * can show movement between reads later. Derived coverage only, never PII. */
interface SignalSnapshot {
  readinessScore: number;
  activeLanes: string[];
  capturedAt: string;
}

function activeLaneIds(breakdown: ReadinessBreakdown): string[] {
  return SIGNAL_REGISTRY.filter((c) => (breakdown[c.id] ?? 0) > 0).map(
    (c) => c.id as string,
  );
}

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

  // Stamp the user's readiness onto this read so a later read can show movement.
  // Computed before insert, so each read's snapshot reflects the state going in.
  // Derived coverage only (score + which lanes are active), never raw content.
  // Anonymous reads carry no snapshot; a failure here never blocks the save.
  let signalSnapshot: SignalSnapshot | undefined;
  if (userId) {
    try {
      const readiness = await computeReadiness(userId);
      signalSnapshot = {
        readinessScore: readiness.score,
        activeLanes: activeLaneIds(readiness.breakdown),
        capturedAt: new Date().toISOString(),
      };
    } catch (err) {
      req.log.warn({ err }, "Compass readiness snapshot failed");
    }
  }

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
        ...(signalSnapshot ? { signalSnapshot } : {}),
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

router.get("/compass/signal-context", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  // Anonymous callers get nothing derived about a real account. The frontend
  // simply skips the evolve/movement surfaces in this case.
  if (!userId) {
    res.json(GetCompassSignalContextResponse.parse({ available: false }));
    return;
  }

  const readiness = await computeReadiness(userId);
  const threshold = await readinessThreshold();
  // Force eligible=false so we always surface the single highest-leverage next
  // signal, the same posture the Mirror takes.
  const nextActions = computeNextActions(
    readiness.breakdown,
    false,
    1,
    readiness.weights,
  );
  const top = nextActions[0] ?? null;

  const layer = buildCompassSignalLayer({
    breakdown: readiness.breakdown,
    score: readiness.score,
    threshold,
    nextSignalLabel: top?.label ?? null,
  });

  // Movement: compare the two most recently stored snapshots. We pull a small
  // window and keep only rows that actually carry a snapshot, so reads saved
  // before this feature shipped are skipped rather than breaking the diff.
  const recent = await db
    .select({
      resultJson: compatibilityReadsTable.resultJson,
      createdAt: compatibilityReadsTable.createdAt,
    })
    .from(compatibilityReadsTable)
    .where(
      and(
        eq(compatibilityReadsTable.userId, userId),
        isNull(compatibilityReadsTable.deletedAt),
      ) as SQL,
    )
    .orderBy(desc(compatibilityReadsTable.createdAt))
    .limit(10);

  const snapshots = recent
    .map((r) => {
      const rj = (r.resultJson ?? {}) as { signalSnapshot?: Partial<SignalSnapshot> };
      const snap = rj.signalSnapshot;
      if (!snap || typeof snap.readinessScore !== "number") return null;
      return {
        readinessScore: snap.readinessScore,
        activeLanes: Array.isArray(snap.activeLanes)
          ? snap.activeLanes.filter((x): x is string => typeof x === "string")
          : [],
        capturedAt:
          typeof snap.capturedAt === "string"
            ? snap.capturedAt
            : r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
      };
    })
    .filter(
      (x): x is { readinessScore: number; activeLanes: string[]; capturedAt: string } =>
        x !== null,
    );

  let movement: {
    previousScore: number;
    currentScore: number;
    delta: number;
    lastReadAt: string | null;
    newSignals: string[];
    note: string;
  } | null = null;
  if (snapshots.length >= 2) {
    const latest = snapshots[0]!;
    const prev = snapshots[1]!;
    const delta = latest.readinessScore - prev.readinessScore;
    const labelById = new Map<string, string>(
      SIGNAL_REGISTRY.map((c) => [c.id as string, c.label] as const),
    );
    const newSignals = latest.activeLanes
      .filter((id) => !prev.activeLanes.includes(id))
      .map((id) => labelById.get(id) ?? id);
    let note: string;
    if (delta > 0) {
      note = `Your readiness is up ${delta} ${delta === 1 ? "point" : "points"} since your last read.`;
    } else if (delta < 0) {
      const drop = Math.abs(delta);
      note = `Your readiness slipped ${drop} ${drop === 1 ? "point" : "points"} since your last read. Some signals fade when they go quiet.`;
    } else {
      note = "Your readiness held steady since your last read.";
    }
    if (newSignals.length > 0) {
      note += ` New since then: ${newSignals.join(", ")}.`;
    }
    movement = {
      previousScore: prev.readinessScore,
      currentScore: latest.readinessScore,
      delta,
      lastReadAt: prev.capturedAt,
      newSignals,
      note,
    };
  }

  res.json(
    GetCompassSignalContextResponse.parse({
      available: true,
      readinessScore: readiness.score,
      stage: layer.stage,
      stageLabel: layer.stageLabel,
      activeLaneCount: layer.activeLaneCount,
      totalLaneCount: layer.totalLaneCount,
      signalLayer: { headline: layer.headline, lines: layer.lines },
      activeSignals: describeActiveSignals(readiness.breakdown),
      nextSignal: top
        ? {
            label: top.label,
            detail: top.detail,
            href: top.href,
            points: top.points,
          }
        : null,
      mirror: {
        href: "/your-mirror",
        line: "This read feeds Your Mirror, the full picture the machine keeps of you.",
      },
      movement,
    }),
  );
});

export default router;
