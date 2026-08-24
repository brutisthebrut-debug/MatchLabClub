import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  photoLabRunsTable,
  profilePhotosTable,
} from "@workspace/db";
import {
  RankPhotoLabBody,
  RankPhotoLabResponse,
} from "@workspace/api-zod";
import {
  rankPhotosDeterministic,
  type PhotoLabPhotoInput,
} from "../lib/aiEngine";
import { comparePhotosVision } from "../lib/aiService";
import { computeReadiness } from "./matching";
import { computeNextActions } from "../lib/readiness";

const router: IRouter = Router();

type PhotoLabBody = {
  photos: Array<
    PhotoLabPhotoInput & {
      imageBase64?: string | null;
      imageMediaType?: string | null;
    }
  >;
  datingGoal?: string | null;
  sourceApp?: string | null;
};
type PhotoLabResult = ReturnType<typeof RankPhotoLabResponse.parse>;

function sourcePhotoId(inputId: string): number | null {
  const match = /^profile-photo-(\d+)$/.exec(inputId);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function serializeRun(row: typeof photoLabRunsTable.$inferSelect) {
  return {
    id: row.id,
    sourcePhotoIds: row.sourcePhotoIds,
    inputSnapshot: row.inputSnapshot,
    result: row.result,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

async function ownedSourcePhotoIds(
  userId: string,
  body: PhotoLabBody,
): Promise<number[] | null> {
  const parsed = body.photos.map((photo) => sourcePhotoId(photo.id));
  if (parsed.some((id) => id === null)) return null;
  const ids = Array.from(new Set(parsed as number[]));
  if (ids.length !== body.photos.length) return null;

  const owned = await db
    .select({ id: profilePhotosTable.id })
    .from(profilePhotosTable)
    .where(
      and(
        eq(profilePhotosTable.userId, userId),
        inArray(profilePhotosTable.id, ids),
      ),
    );
  return owned.length === ids.length ? ids : null;
}

function durableInputSnapshot(body: PhotoLabBody): Record<string, unknown> {
  return {
    photos: body.photos.map((photo) => ({
      id: photo.id,
      shotType: photo.shotType,
      wellLit: photo.wellLit ?? null,
      genuineExpression: photo.genuineExpression ?? null,
    })),
    datingGoal: body.datingGoal ?? null,
    sourceApp: body.sourceApp ?? null,
  };
}

async function buildRanking(
  req: Request,
  body: PhotoLabBody,
): Promise<PhotoLabResult> {
  const userId = req.user?.id;
  const ranking = rankPhotosDeterministic({
    photos: body.photos.map(
      (photo): PhotoLabPhotoInput => ({
        id: photo.id,
        shotType: photo.shotType,
        wellLit: photo.wellLit ?? undefined,
        genuineExpression: photo.genuineExpression ?? undefined,
      }),
    ),
    datingGoal: body.datingGoal ?? null,
    sourceApp: body.sourceApp ?? null,
  });

  // Images are used only for this optional in-memory vision pass. Neither the
  // request bytes nor image metadata are copied into the durable run record.
  let visionMode: "live" | "fallback" = "fallback";
  let visionFallbackReason: string | null = null;
  let visionAnalysis: Awaited<
    ReturnType<typeof comparePhotosVision>
  >["analysis"] = null;
  const withImages = body.photos.filter(
    (photo) =>
      typeof photo.imageBase64 === "string" &&
      photo.imageBase64.trim().length > 0,
  );
  if (userId && withImages.length > 0) {
    const vision = await comparePhotosVision({
      photos: withImages.map((photo) => ({
        id: photo.id,
        imageBase64: photo.imageBase64 as string,
        imageMediaType: photo.imageMediaType ?? null,
      })),
      userId,
      sourceApp: body.sourceApp ?? null,
      datingGoal: body.datingGoal ?? null,
    });
    if (vision.analysis) {
      visionMode = "live";
      visionAnalysis = vision.analysis;
    } else {
      visionFallbackReason = vision.fallbackReason ?? null;
    }
  }

  let mirror: { href: string; line: string } | null = null;
  let nextSignal: {
    label: string;
    detail: string;
    href: string;
    points: number;
  } | null = null;
  if (userId) {
    mirror = {
      href: "/your-mirror",
      line: "This photo read is part of your Profile Project record.",
    };
    try {
      const readiness = await computeReadiness(userId);
      const next = computeNextActions(
        readiness.breakdown,
        false,
        1,
        readiness.weights,
      );
      const top = next[0] ?? null;
      nextSignal = top
        ? {
            label: top.label,
            detail: top.detail,
            href: top.href,
            points: top.points,
          }
        : null;
    } catch (err) {
      req.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Photo Lab readiness next-signal failed",
      );
    }
  }

  return RankPhotoLabResponse.parse({
    leadShotId: ranking.leadShotId,
    leadShotRationale: ranking.leadShotRationale,
    summary: ranking.summary,
    ranked: ranking.ranked,
    checklist: ranking.checklist,
    visionMode,
    visionFallbackReason,
    visionAnalysis,
    nextSignal,
    mirror,
  });
}

// Compatibility endpoint for anonymous and temporary Photo Lab sessions.
// Signed-in durable runs use /me/photo-lab-runs.
router.post("/photo-lab/rank", async (req, res) => {
  const parsed = RankPhotoLabBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_payload",
      detail: parsed.error.message,
    });
    return;
  }
  res.json(await buildRanking(req, parsed.data as PhotoLabBody));
});

// Create an immutable, reopenable Photo Lab run from member-owned photos.
router.post("/me/photo-lab-runs", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = RankPhotoLabBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_payload",
      detail: parsed.error.message,
    });
    return;
  }

  const body = parsed.data as PhotoLabBody;
  const sourcePhotoIds = await ownedSourcePhotoIds(req.user.id, body);
  if (!sourcePhotoIds) {
    res.status(400).json({
      error: "Every analysis input must reference a distinct profile photo you own.",
    });
    return;
  }

  const result = await buildRanking(req, body);
  const [run] = await db
    .insert(photoLabRunsTable)
    .values({
      userId: req.user.id,
      sourcePhotoIds,
      inputSnapshot: durableInputSnapshot(body),
      result: result as unknown as Record<string, unknown>,
    })
    .returning();

  res.status(201).json(serializeRun(run!));
});

router.get("/me/photo-lab-runs", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(photoLabRunsTable)
    .where(eq(photoLabRunsTable.userId, req.user.id))
    .orderBy(desc(photoLabRunsTable.createdAt), desc(photoLabRunsTable.id))
    .limit(50);
  res.json({ runs: rows.map(serializeRun) });
});

router.get("/me/photo-lab-runs/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    res.status(404).json({ error: "Photo analysis not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(photoLabRunsTable)
    .where(
      and(
        eq(photoLabRunsTable.id, id),
        eq(photoLabRunsTable.userId, req.user.id),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Photo analysis not found" });
    return;
  }
  res.json(serializeRun(row));
});

router.delete("/me/photo-lab-runs/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    res.status(404).json({ error: "Photo analysis not found" });
    return;
  }
  const [deleted] = await db
    .delete(photoLabRunsTable)
    .where(
      and(
        eq(photoLabRunsTable.id, id),
        eq(photoLabRunsTable.userId, req.user.id),
      ),
    )
    .returning({ id: photoLabRunsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Photo analysis not found" });
    return;
  }
  res.json({ deleted: true, id: deleted.id });
});

export default router;
