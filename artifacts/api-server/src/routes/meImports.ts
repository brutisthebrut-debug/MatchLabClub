import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, importedSourcesTable } from "@workspace/db";
import {
  CreateInstagramPasteBody,
  CreateQuizResultBody,
  CreateSourcePasteBody,
  CreateVoiceIntroBody,
} from "@workspace/api-zod";
import { pasteCaptureSources } from "../lib/signalRegistry";
import { getOrCreateAnonClaimToken } from "../lib/anonClaimToken";
import {
  deterministicVoiceRead,
  runInstagramToneRead,
  runVoiceIntroRead,
} from "../lib/importEnrichment";
import { recordJourneyEvent } from "../lib/journeyEvents";

const router: IRouter = Router();

/**
 * POST /api/me/instagram-paste
 *
 * Anon-first capture surface. Persists a copy-paste of the user's
 * Instagram bio + a handful of recent captions to `imported_sources` with
 * `source='instagram-paste'` and `status='pending'`. For authenticated
 * users, kicks off a fire-and-forget tone-read enrichment that upgrades the
 * row to `status='complete'` once done. Anthropic writes the read when content
 * consent is granted and the call succeeds; otherwise the always-on
 * deterministic engine produces the read (`toneEngine='deterministic'`), so the
 * source never stalls in a fallback state.
 * Anonymous users never have their content shipped to Anthropic, they
 * must claim/sign in first so the consent gate can apply.
 */
router.post("/me/instagram-paste", async (req, res): Promise<void> => {
  const parsed = CreateInstagramPasteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  const originalPayload = {
    bio: parsed.data.bio,
    recentCaptions: parsed.data.recentCaptions,
  };

  const [inserted] = await db
    .insert(importedSourcesTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      source: "instagram-paste",
      status: "pending",
      parsedSummary: originalPayload,
    })
    .returning({
      id: importedSourcesTable.id,
      source: importedSourcesTable.source,
      status: importedSourcesTable.status,
      uploadedAt: importedSourcesTable.uploadedAt,
    });

  req.log.info(
    {
      userId: userId ?? null,
      importId: inserted?.id,
      captionCount: parsed.data.recentCaptions.length,
    },
    "Captured Instagram paste",
  );

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonToken,
    props: { source: "instagram-paste" },
  });

  res.status(201).json({
    id: inserted!.id,
    source: inserted!.source,
    status: inserted!.status,
    uploadedAt:
      inserted!.uploadedAt instanceof Date
        ? inserted!.uploadedAt.toISOString()
        : String(inserted!.uploadedAt),
  });

  // Fire-and-forget Anthropic enrichment. Only for signed-in users —
  // anon users would short-circuit through the consent gate anyway, no
  // sense paying the round-trip. Errors are logged inside the helper.
  if (userId && inserted?.id) {
    setImmediate(() => {
      void runInstagramToneRead({
        importId: inserted.id,
        userId,
        bio: parsed.data.bio,
        captions: parsed.data.recentCaptions,
        originalPayload,
      });
    });
  }
});

/**
 * POST /api/me/source-paste
 *
 * Generic consent-first capture surface for paste-based Connection Center
 * connectors (taste, lifestyle, and any future paste source). The accepted
 * `source` values come straight from the living signal registry's
 * paste-capturable entries, so adding a connector is a registry edit plus a
 * capture UI, with no allowlist to maintain here. We store the raw items
 * against the row so the user can review or purge them, but only the derived
 * item count (`parsedSummary.counts.items`) ever feeds scoring, the Mirror, or
 * matching reasoning, and the raw items are never sent to any prompt. Status is
 * stamped `complete` immediately: this is a deterministic count, there is no
 * enrichment pass and no Claude tool involved. Anon-safe via the standard
 * claim-token cookie.
 */
router.post("/me/source-paste", async (req, res): Promise<void> => {
  const parsed = CreateSourcePasteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const allowed = pasteCaptureSources();
  const match = allowed.find((s) => s.source === parsed.data.source);
  if (!match) {
    res.status(400).json({
      error: `Unknown source '${parsed.data.source}'. Expected one of: ${allowed
        .map((s) => s.source)
        .join(", ")}`,
    });
    return;
  }

  // Drop blank entries defensively, then count what remains. The count is the
  // only thing that drives the signal; the trimmed items are kept verbatim for
  // the user's own review and purge.
  const items = parsed.data.items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0) {
    res.status(400).json({ error: "At least one non-empty item is required." });
    return;
  }

  const note = parsed.data.note?.trim() || undefined;
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  const [inserted] = await db
    .insert(importedSourcesTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      source: match.source,
      status: "complete",
      parsedSummary: {
        items,
        note,
        counts: { items: items.length },
      },
    })
    .returning({
      id: importedSourcesTable.id,
      source: importedSourcesTable.source,
      status: importedSourcesTable.status,
      uploadedAt: importedSourcesTable.uploadedAt,
    });

  req.log.info(
    {
      userId: userId ?? null,
      importId: inserted?.id,
      source: match.source,
      itemCount: items.length,
    },
    "Captured source paste",
  );

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonToken,
    props: { source: match.source },
  });

  res.status(201).json({
    id: inserted!.id,
    source: inserted!.source,
    status: inserted!.status,
    itemCount: items.length,
    uploadedAt:
      inserted!.uploadedAt instanceof Date
        ? inserted!.uploadedAt.toISOString()
        : String(inserted!.uploadedAt),
  });
});

/**
 * POST /api/me/voice-intro
 *
 * Records that the user recorded a short spoken intro. The recording itself is
 * never uploaded; the browser derives a handful of acoustic metrics (length,
 * energy, dynamics, pace, speech ratio) in the moment and only those numbers
 * arrive here. We store them into `imported_sources` tagged
 * `source = "voice-intro"` with a derived `counts.items` of 1, so the signal
 * feeds the `voice` lane of Match Readiness, the Mirror, and matching reasoning.
 * Unlike a plain paste, this source carries a narrative read: status lands
 * `pending`, then a fire-and-forget pass writes the read. The read follows the
 * hybrid contract: Claude is layered on opt-in behind content consent and the
 * daily cap, with the always-on deterministic engine as the fallback, so the
 * source never stalls. Only the derived numbers are ever sent to any prompt,
 * never audio. Anon-safe via the standard claim-token cookie; the Claude pass
 * only fires for signed-in users since consent is per-account.
 */
router.post("/me/voice-intro", async (req, res): Promise<void> => {
  const parsed = CreateVoiceIntroBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const metrics = {
    durationSec: parsed.data.durationSec,
    energy: parsed.data.energy,
    dynamics: parsed.data.dynamics,
    pace: parsed.data.pace,
    speechRatio: parsed.data.speechRatio,
  };

  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  // Write the always-on deterministic read synchronously so the row lands
  // `complete` the moment it is created. There is no `pending` window to strand
  // a row in, and the signal feeds readiness immediately. For signed-in users
  // we then layer the Claude read on top (consent + daily cap), overwriting the
  // deterministic read if it succeeds and falling back to it if it does not.
  const [inserted] = await db
    .insert(importedSourcesTable)
    .values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      source: "voice-intro",
      status: "complete",
      parsedSummary: {
        metrics,
        counts: { items: 1 },
        aiVoiceRead: deterministicVoiceRead(metrics),
        voiceEngine: "deterministic",
      },
      processedAt: new Date(),
    })
    .returning({
      id: importedSourcesTable.id,
      source: importedSourcesTable.source,
      status: importedSourcesTable.status,
      uploadedAt: importedSourcesTable.uploadedAt,
    });

  req.log.info(
    {
      userId: userId ?? null,
      importId: inserted?.id,
      source: "voice-intro",
    },
    "Captured voice intro metrics",
  );

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonToken,
    props: { source: "voice-intro" },
  });

  // The Claude read is per-account (consent + daily cap), so it only fires for
  // signed-in users. If it never runs or fails, the deterministic read written
  // above stands, so the source is never left without a read.
  if (userId) {
    void runVoiceIntroRead({
      importId: inserted!.id,
      userId,
      metrics,
    });
  }

  res.status(201).json({
    id: inserted!.id,
    source: inserted!.source,
    status: inserted!.status,
    uploadedAt:
      inserted!.uploadedAt instanceof Date
        ? inserted!.uploadedAt.toISOString()
        : String(inserted!.uploadedAt),
  });
});

/**
 * POST /api/me/quiz-result
 *
 * Records a completed quiz as derived signal feeding the `quizzes` lane of the
 * living signal registry, so finishing a quiz nudges Match Readiness, the
 * Mirror, and matching reasoning. We store only the derived result (which quiz,
 * which archetype, the dimensions it informs) into `imported_sources` tagged
 * `source = "quiz"`; the user's raw answer choices are never stored here and
 * never sent to any prompt. The lane counts distinct rows per source, so we
 * dedupe retakes: any prior non-deleted `quiz` row for the same slug is
 * soft-deleted before the new one lands, which keeps the count at distinct
 * quizzes completed rather than raw submissions. Status is stamped `complete`
 * immediately: this is a deterministic write with no enrichment pass and no
 * Claude tool involved. Anon-safe via the standard claim-token cookie.
 */
router.post("/me/quiz-result", async (req, res): Promise<void> => {
  const parsed = CreateQuizResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slug = parsed.data.slug.trim();
  const archetypeKey = parsed.data.archetypeKey.trim();
  const archetypeName = parsed.data.archetypeName.trim();
  const dimensions = (parsed.data.dimensions ?? [])
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  if (!slug || !archetypeKey || !archetypeName) {
    res.status(400).json({ error: "slug, archetypeKey, and archetypeName are required." });
    return;
  }

  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  // Owner predicate: signed-in rows key off the user id, anon rows off the
  // claim-token cookie so they can be merged into the account on login.
  const owner = userId
    ? eq(importedSourcesTable.userId, userId)
    : eq(importedSourcesTable.anonymousClaimToken, anonToken!);

  // Dedupe retakes atomically. The lane counts live rows per source, so a retake
  // must soft-delete the prior `quiz` row for this same slug before the new one
  // lands, keeping the count at distinct quizzes rather than raw submissions. We
  // run the soft-delete, insert, and recount inside one transaction guarded by a
  // per-owner-per-slug advisory lock so two near-simultaneous completions of the
  // same quiz (a fast double-submit) can't both slip past the dedupe and leave
  // two live rows for one slug.
  const lockKey = `quiz:${userId ?? anonToken}:${slug}`;
  const { inserted, distinctQuizzes } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`);

    await tx
      .update(importedSourcesTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          owner,
          eq(importedSourcesTable.source, "quiz"),
          isNull(importedSourcesTable.deletedAt),
          sql`${importedSourcesTable.parsedSummary}->>'slug' = ${slug}`,
        ),
      );

    const [insertedRow] = await tx
      .insert(importedSourcesTable)
      .values({
        userId: userId ?? null,
        anonymousClaimToken: anonToken,
        source: "quiz",
        status: "complete",
        parsedSummary: {
          slug,
          archetypeKey,
          archetype: archetypeName,
          dimensions,
          counts: { quizzes: 1 },
        },
      })
      .returning({
        id: importedSourcesTable.id,
        uploadedAt: importedSourcesTable.uploadedAt,
      });

    // Distinct quizzes now on file for this owner, after the dedupe above. This
    // is the same count the registry uses to fill the lane.
    const [{ value } = { value: 0 }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(importedSourcesTable)
      .where(
        and(
          owner,
          eq(importedSourcesTable.source, "quiz"),
          isNull(importedSourcesTable.deletedAt),
        ),
      );

    return { inserted: insertedRow, distinctQuizzes: value };
  });

  req.log.info(
    {
      userId: userId ?? null,
      importId: inserted?.id,
      slug,
      distinctQuizzes: Number(distinctQuizzes ?? 0),
    },
    "Captured quiz result",
  );

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonToken,
    props: { source: "quiz", slug },
  });

  res.status(201).json({
    id: inserted!.id,
    slug,
    archetypeName,
    distinctQuizzes: Number(distinctQuizzes ?? 0),
    status: "complete",
    uploadedAt:
      inserted!.uploadedAt instanceof Date
        ? inserted!.uploadedAt.toISOString()
        : String(inserted!.uploadedAt),
  });
});

export default router;
