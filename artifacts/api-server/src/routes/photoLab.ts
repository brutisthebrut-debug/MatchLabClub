import { Router, type IRouter } from "express";
import { RankPhotoLabBody, RankPhotoLabResponse } from "@workspace/api-zod";
import {
  rankPhotosDeterministic,
  type PhotoLabPhotoInput,
} from "../lib/aiEngine";
import { comparePhotosVision } from "../lib/aiService";
import { computeReadiness } from "./matching";
import { computeNextActions } from "../lib/readiness";

const router: IRouter = Router();

// Photo Lab: rank several photos and recommend a single lead shot. The
// deterministic ranking is always on and is built only from the composition
// attributes the member declares per photo, never from the pixels. When the
// deep AI lane is on and images are supplied, an opt-in Claude vision pass adds
// depth. Photos are never stored. Anon-safe: callers without a session still get
// the deterministic ranking, just without the Mirror tie-in and next signal.
router.post("/photo-lab/rank", async (req, res) => {
  const parsed = RankPhotoLabBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", detail: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const userId = req.user?.id;

  const ranking = rankPhotosDeterministic({
    photos: body.photos.map(
      (p): PhotoLabPhotoInput => ({
        id: p.id,
        shotType: p.shotType,
        wellLit: p.wellLit ?? undefined,
        genuineExpression: p.genuineExpression ?? undefined,
      }),
    ),
    datingGoal: body.datingGoal ?? null,
    sourceApp: body.sourceApp ?? null,
  });

  // Opt-in vision layer. comparePhotosVision enforces consent + daily cap and
  // never throws, returning a fallback reason instead.
  let visionMode: "live" | "fallback" = "fallback";
  let visionFallbackReason: string | null = null;
  let visionAnalysis: Awaited<
    ReturnType<typeof comparePhotosVision>
  >["analysis"] = null;
  const withImages = body.photos.filter(
    (p) => typeof p.imageBase64 === "string" && p.imageBase64.trim().length > 0,
  );
  if (userId && withImages.length > 0) {
    const vision = await comparePhotosVision({
      photos: withImages.map((p) => ({
        id: p.id,
        imageBase64: p.imageBase64 as string,
        imageMediaType: p.imageMediaType ?? null,
      })),
      userId,
      sourceApp: body.sourceApp ?? null,
      datingGoal: body.datingGoal ?? null,
    });
    if (vision.analysis) {
      visionMode = "live";
      visionAnalysis = vision.analysis;
    } else {
      visionMode = "fallback";
      visionFallbackReason = vision.fallbackReason ?? null;
    }
  }

  // Handoff back to Your Mirror and the next best signal for signed-in members.
  let mirror: { href: string; line: string } | null = null;
  let nextSignal: {
    label: string;
    detail: string;
    href: string;
    points: number;
  } | null = null;
  if (userId) {
    // The Mirror tie-in is always offered to signed-in members. The next-best
    // signal is best-effort: a transient readiness failure must not suppress the
    // /your-mirror handoff.
    mirror = {
      href: "/your-mirror",
      line: "This ranking feeds Your Mirror, the full picture the machine keeps of you.",
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

  const payload = RankPhotoLabResponse.parse({
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
  res.json(payload);
});

export default router;
