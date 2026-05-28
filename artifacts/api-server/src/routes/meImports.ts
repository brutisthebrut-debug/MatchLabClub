import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, importedSourcesTable } from "@workspace/db";
import { CreateInstagramPasteBody } from "@workspace/api-zod";
import { extractAndValidateJson } from "@workspace/ai-schemas";
import { buildEchoSystemPrompt } from "@workspace/echo";
import { getOrCreateAnonClaimToken } from "../lib/anonClaimToken";
import { generate } from "../lib/aiService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Shape we expect Anthropic to return for an Instagram paste tone read.
 * Kept tight so the model can't pad it out with marketing prose.
 */
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
type InstagramToneRead = z.infer<typeof InstagramToneReadSchema>;

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

async function runInstagramToneRead(args: {
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
          : result.error ?? "no_output";
      await db
        .update(importedSourcesTable)
        .set({
          status: "fallback",
          parsedSummary: { ...originalPayload, aiError: reason },
          processedAt: new Date(),
        })
        .where(eq(importedSourcesTable.id, importId));
      return;
    }

    const raw = result.raw ?? result.output;
    const parsed = extractAndValidateJson<InstagramToneRead>(InstagramToneReadSchema, raw);
    if (!parsed.ok) {
      await db
        .update(importedSourcesTable)
        .set({
          status: "fallback",
          parsedSummary: {
            ...originalPayload,
            aiError: "schema_validation_failed",
          },
          processedAt: new Date(),
        })
        .where(eq(importedSourcesTable.id, importId));
      return;
    }

    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: { ...originalPayload, aiToneRead: parsed.value },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        importId,
      },
      "Instagram tone read enrichment failed",
    );
    await db
      .update(importedSourcesTable)
      .set({
        status: "fallback",
        parsedSummary: {
          ...originalPayload,
          aiError: err instanceof Error ? err.message : "unknown_error",
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId))
      .catch(() => {
        // swallow — we already logged the original failure
      });
  }
}

/**
 * POST /api/me/instagram-paste
 *
 * Anon-first capture surface. Persists a copy-paste of the user's
 * Instagram bio + a handful of recent captions to `imported_sources` with
 * `source='instagram-paste'` and `status='pending'`. For authenticated
 * users, kicks off a fire-and-forget Anthropic tone-read enrichment that
 * upgrades the row to `status='complete'` (or `'fallback'`) once done.
 * Anonymous users never have their content shipped to Anthropic — they
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

export default router;
