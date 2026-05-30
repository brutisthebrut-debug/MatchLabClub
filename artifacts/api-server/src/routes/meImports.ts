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

/**
 * Deterministic, key-free Instagram tone read. This is the always-on baseline
 * the architecture promises: when Anthropic is unavailable, the account has not
 * granted AI content consent, or the model output fails validation, we still
 * produce a real tone read from keyword and voice cues so the connector is
 * never a dead end. No external calls, no rate limits.
 */
function buildVoiceSummary(
  adjectives: string[],
  emojiCount: number,
  questions: number,
): string {
  const lead = adjectives.slice(0, 3).join(", ");
  const energy =
    emojiCount >= 2
      ? "Their captions carry visible energy and warmth."
      : "Their captions stay measured and let the detail do the work.";
  const close =
    questions >= 1
      ? "They tend to invite a response rather than just broadcast."
      : "They lean toward statements over questions, so give them an easy hook to reply to.";
  return `Reads as ${lead}. ${energy} ${close}`;
}

function deterministicInstagramTone(bio: string, captions: string[]): InstagramToneRead {
  const text = `${bio}\n${captions.join("\n")}`;
  const corpus = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => corpus.includes(w));

  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;

  const adjectives: string[] = [];
  const signals: string[] = [];
  const suggestions: string[] = [];

  if (emojiCount >= 2 || exclamations >= 2) adjectives.push("playful");
  if (questions >= 1) adjectives.push("curious");

  const themes: { words: string[]; adjective: string; signal: string; suggestion: string }[] = [
    { words: ["travel", "wander", "passport", "flight", "trip", "abroad", "adventure", "explore"], adjective: "adventurous", signal: "Travel and new places are a core part of how they spend their energy.", suggestion: "Open with a specific place from their captions and ask what pulled them there." },
    { words: ["gym", "run", "running", "lift", "yoga", "hike", "climb", "marathon", "fitness", "workout"], adjective: "energetic", signal: "An active, physical lifestyle shows up often, so shared-activity dates will land.", suggestion: "Suggest an active first date that matches their pace, like a walk-and-coffee or a class." },
    { words: ["coffee", "ramen", "brunch", "cook", "baking", "wine", "restaurant", "foodie", "dinner", "taco"], adjective: "warm", signal: "Food and small rituals are how they connect, so casual sit-down dates suit them.", suggestion: "Reference a food spot they mentioned and propose trying one together." },
    { words: ["art", "music", "paint", "write", "film", "photo", "design", "creative", "studio", "band"], adjective: "expressive", signal: "A creative streak runs through their voice; they value originality over polish.", suggestion: "Ask about the work behind one of their posts instead of complimenting the result." },
    { words: ["beach", "mountain", "trail", "camp", "ocean", "sunset", "lake", "outdoors", "nature"], adjective: "grounded", signal: "Outdoor and nature moments recur, hinting at someone who recharges away from screens.", suggestion: "Float a low-key outdoor plan that gives room to actually talk." },
    { words: ["book", "read", "reading", "novel", "library", "bookshop", "poetry"], adjective: "thoughtful", signal: "A reflective, reading-leaning side suggests they value depth in conversation.", suggestion: "Trade a recommendation and ask what they are into right now." },
    { words: ["friends", "party", "night out", "weekend", "crew", "squad", "dancing"], adjective: "outgoing", signal: "A strong social orbit means they likely enjoy people-rich, lively settings.", suggestion: "Lean into a fun, social-flavored first plan rather than an intense one-on-one." },
    { words: ["dog", "cat", "puppy", "pup", "rescue", "kitten"], adjective: "soft", signal: "Pets feature prominently, an easy warmth and conversation anchor.", suggestion: "Ask about their pet by name; it is a reliably warm opener." },
    { words: ["work", "founder", "startup", "building", "launch", "career", "hustle", "project"], adjective: "driven", signal: "Ambition and building things come through; they will respect direction and intent.", suggestion: "Acknowledge what they are building before pivoting to something personal." },
  ];

  for (const t of themes) {
    if (has(t.words)) {
      adjectives.push(t.adjective);
      signals.push(t.signal);
      suggestions.push(t.suggestion);
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 12) adjectives.push("direct");
  else if (wordCount >= 60) adjectives.push("expansive");

  const dedupe = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

  let adj = dedupe(adjectives);
  for (const a of ["genuine", "approachable", "easygoing", "warm", "grounded"]) {
    if (adj.length >= 3) break;
    if (!adj.includes(a)) adj.push(a);
  }
  adj = adj.slice(0, 5);

  let sig = dedupe(signals);
  for (const s of [
    "Their bio leans on everyday detail over big claims, which reads as authentic.",
    "There is enough specificity here to start a real conversation, not just a generic compliment.",
  ]) {
    if (sig.length >= 2) break;
    if (!sig.includes(s)) sig.push(s);
  }
  sig = sig.slice(0, 5);

  let sug = dedupe(suggestions);
  for (const s of [
    "Pick the single most specific detail they shared and ask one genuine follow-up.",
    "Match their energy: keep the first message short, warm, and easy to answer.",
  ]) {
    if (sug.length >= 2) break;
    if (!sug.includes(s)) sug.push(s);
  }
  sug = sug.slice(0, 4);

  return {
    tone: { adjectives: adj, voiceSummary: buildVoiceSummary(adj, emojiCount, questions) },
    datingRelevant: { signals: sig, suggestions: sug },
  };
}

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
  const deterministic = deterministicInstagramTone(bio, captions);

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
          status: "complete",
          parsedSummary: {
            ...originalPayload,
            aiToneRead: deterministic,
            toneEngine: "deterministic",
            aiError: reason,
          },
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
          status: "complete",
          parsedSummary: {
            ...originalPayload,
            aiToneRead: deterministic,
            toneEngine: "deterministic",
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
        parsedSummary: {
          ...originalPayload,
          aiToneRead: parsed.value,
          toneEngine: "anthropic",
        },
        processedAt: new Date(),
      })
      .where(eq(importedSourcesTable.id, importId));
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        importId,
      },
      "Instagram tone read enrichment failed, serving deterministic read",
    );
    await db
      .update(importedSourcesTable)
      .set({
        status: "complete",
        parsedSummary: {
          ...originalPayload,
          aiToneRead: deterministic,
          toneEngine: "deterministic",
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
 * users, kicks off a fire-and-forget tone-read enrichment that upgrades the
 * row to `status='complete'` once done. Anthropic writes the read when content
 * consent is granted and the call succeeds; otherwise the always-on
 * deterministic engine produces the read (`toneEngine='deterministic'`), so the
 * source never stalls in a fallback state.
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
