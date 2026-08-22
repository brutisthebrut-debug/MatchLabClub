import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, importedSourcesTable } from "@workspace/db";
import { getQuizBySlug, scoreQuiz } from "@workspace/quiz-engine";
import {
  CreateInstagramPasteBody,
  CreateQuizResultBody,
  CreateSourcePasteBody,
  CreateVoiceIntroBody,
} from "@workspace/api-zod";
import { pasteCaptureSources } from "../lib/signalRegistry";
import { getOrCreateAnonClaimToken } from "../lib/anonClaimToken";
import { recordJourneyEvent } from "../lib/journeyEvents";

const router: IRouter = Router();

/**
 * POST /api/me/instagram-paste
 *
 * Anon-first capture surface. Persists a copy-paste of the user's
 * Instagram bio + a handful of recent captions to `imported_sources` with
 * `source='instagram-paste'`. Saving is storage-only: Echo processing begins
 * only after the member separately enables Echo use for this source.
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
      status: "complete",
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
 * item count (`parsedSummary.counts.items`) can feed matching only after the
 * member separately enables matching use. The raw items are never sent to any
 * prompt unless Echo use is separately enabled. Status is
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
 * is stored but does not feed Echo or matching until those permissions are
 * separately enabled. Only derived metrics arrive here; audio never does.
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
 * Scores a completed canonical quiz server-side and records only the derived
 * signal feeding the `quizzes` lane. Answer indexes exist only in request
 * memory and are never persisted or sent to a prompt. The lane counts distinct
 * rows per source, so we
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
  const quiz = getQuizBySlug(slug);
  if (!quiz) {
    res.status(400).json({ error: "Unknown quiz slug." });
    return;
  }

  const answers = parsed.data.answers;
  const validAnswers =
    answers.length === quiz.questions.length &&
    answers.every(
      (optionIndex, questionIndex) =>
        Number.isInteger(optionIndex) &&
        optionIndex >= 0 &&
        optionIndex < quiz.questions[questionIndex]!.options.length,
    );
  if (!validAnswers) {
    res.status(400).json({
      error: "Answers must contain one valid option index per quiz question.",
    });
    return;
  }

  const archetypeKey = scoreQuiz(quiz, answers);
  const archetype = quiz.archetypes[archetypeKey];
  if (!archetype) {
    res.status(400).json({ error: "Quiz could not be scored." });
    return;
  }
  const archetypeName = archetype.name;
  const dimensions = quiz.feeds;

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
    archetypeKey,
    archetypeName,
    dimensions,
    distinctQuizzes: Number(distinctQuizzes ?? 0),
    status: "complete",
    uploadedAt:
      inserted!.uploadedAt instanceof Date
        ? inserted!.uploadedAt.toISOString()
        : String(inserted!.uploadedAt),
  });
});

export default router;
