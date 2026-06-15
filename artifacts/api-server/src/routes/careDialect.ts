import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, careDialectProfilesTable } from "@workspace/db";
import {
  GetCareDialectResponse,
  SaveCareDialectResponse,
  SaveCareDialectBody,
} from "@workspace/api-zod";
import { generate } from "../lib/aiService";
import {
  CARE_DIALECTS,
  buildComparison,
  emptyDistribution,
  isCareDialectKey,
  tallyAxis,
  type CareDialectComparison,
  type CareDialectKey,
  type CareDialectProfileData,
  type TestedAxis,
} from "../lib/careDialect";

const router: IRouter = Router();

/**
 * The Care Dialect surface. GET returns the signed-in user's profile (or an
 * illustrative demo for signed-out callers, so the page is never empty); POST
 * scores quiz answers deterministically server-side and upserts the derived
 * result. Raw answers are never stored or sent to any prompt: only the tallied
 * distributions and top keys persist. The optional Claude narrative is layered
 * on at POST behind the per-account deep-AI consent gate and always falls back
 * to the deterministic comparison built in `careDialect.ts`.
 */

type CareDialectResponseShape = {
  hasProfile: boolean;
  isDemo: boolean;
  selfGive: CareDialectKey | null;
  selfReceive: CareDialectKey | null;
  testedGiveDistribution: Record<string, number>;
  testedGiveTop: CareDialectKey | null;
  testedReceiveDistribution: Record<string, number>;
  testedReceiveTop: CareDialectKey | null;
  comparison: CareDialectComparison;
  narrative: string | null;
  updatedAt: Date | null;
};

// Assemble the wire response from a scored profile. The distributions always
// carry all six keys (zero when unused) so the client can render a stable
// chart, and the comparison is the deterministic baseline unless a narrative
// was layered on.
function buildResponse(
  p: CareDialectProfileData,
  extra: { isDemo: boolean; narrative: string | null; updatedAt: Date | null },
): CareDialectResponseShape {
  return {
    hasProfile: Boolean(p.testedGive && p.testedReceive),
    isDemo: extra.isDemo,
    selfGive: p.selfGive,
    selfReceive: p.selfReceive,
    testedGiveDistribution: p.testedGive?.distribution ?? emptyDistribution(),
    testedGiveTop: p.testedGive?.top ?? null,
    testedReceiveDistribution:
      p.testedReceive?.distribution ?? emptyDistribution(),
    testedReceiveTop: p.testedReceive?.top ?? null,
    comparison: buildComparison(p),
    narrative: extra.narrative,
    updatedAt: extra.updatedAt,
  };
}

// A populated example for signed-out visitors. It never reflects a real person;
// it shows one aligned axis and one surprising axis so the comparison reads as a
// real, interesting result rather than an empty shell.
function demoProfile(): CareDialectProfileData {
  return {
    selfGive: "spokenWarmth",
    selfReceive: "undividedTime",
    testedGive: {
      distribution: {
        spokenWarmth: 0.25,
        helpingHands: 0.4,
        thoughtfulTokens: 0.1,
        undividedTime: 0.15,
        closeContact: 0,
        steadyPresence: 0.1,
      },
      top: "helpingHands",
    },
    testedReceive: {
      distribution: {
        spokenWarmth: 0.15,
        helpingHands: 0.1,
        thoughtfulTokens: 0,
        undividedTime: 0.45,
        closeContact: 0.2,
        steadyPresence: 0.1,
      },
      top: "undividedTime",
    },
  };
}

// Reconstruct a TestedAxis from a stored distribution + top, defending against
// a row that somehow has one without the other.
function axisFromRow(
  dist: Record<string, number> | null | undefined,
  top: string | null | undefined,
): TestedAxis | null {
  if (!dist || !isCareDialectKey(top)) return null;
  const distribution = emptyDistribution();
  for (const k of Object.keys(distribution) as CareDialectKey[]) {
    distribution[k] = typeof dist[k] === "number" ? dist[k] : 0;
  }
  return { distribution, top };
}

router.get("/me/care-dialect", async (req, res): Promise<void> => {
  // Signed-out visitors get the demo example so the page renders fully. The
  // demo is clearly flagged and never reflects a real person.
  if (!req.user?.id) {
    res.json(
      GetCareDialectResponse.parse(
        buildResponse(demoProfile(), {
          isDemo: true,
          narrative: null,
          updatedAt: null,
        }),
      ),
    );
    return;
  }

  const userId = req.user.id;
  const rows = await db
    .select()
    .from(careDialectProfilesTable)
    .where(eq(careDialectProfilesTable.userId, userId))
    .limit(1);
  const row = rows[0];

  // No saved profile yet: return an empty (but well-formed) profile so the
  // client can show the intro/quiz state without special-casing a 404.
  if (!row) {
    res.json(
      GetCareDialectResponse.parse(
        buildResponse(
          {
            selfGive: null,
            selfReceive: null,
            testedGive: null,
            testedReceive: null,
          },
          { isDemo: false, narrative: null, updatedAt: null },
        ),
      ),
    );
    return;
  }

  const profile: CareDialectProfileData = {
    selfGive: isCareDialectKey(row.selfGive) ? row.selfGive : null,
    selfReceive: isCareDialectKey(row.selfReceive) ? row.selfReceive : null,
    testedGive: axisFromRow(row.testedGiveDist, row.testedGiveTop),
    testedReceive: axisFromRow(row.testedReceiveDist, row.testedReceiveTop),
  };

  // GET never calls Claude: a read should never drain the daily cap. The stored
  // deterministic comparison is the baseline; narrative is refreshed on POST.
  res.json(
    GetCareDialectResponse.parse(
      buildResponse(profile, {
        isDemo: false,
        narrative: null,
        updatedAt: row.updatedAt ?? null,
      }),
    ),
  );
});

router.post("/me/care-dialect", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;

  const parsed = SaveCareDialectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Care Dialect submission" });
    return;
  }

  const { selfGive, selfReceive, giveAnswers, receiveAnswers } = parsed.data;
  const testedGive = tallyAxis(giveAnswers);
  const testedReceive = tallyAxis(receiveAnswers);
  // The contract requires at least one answer per axis, so both tallies are
  // present here; guard anyway so a future contract change can't 500.
  if (!testedGive || !testedReceive) {
    res.status(400).json({ error: "Care Dialect quiz needs answers on both axes" });
    return;
  }

  const now = new Date();
  await db
    .insert(careDialectProfilesTable)
    .values({
      userId,
      selfGive: selfGive ?? null,
      selfReceive: selfReceive ?? null,
      testedGiveDist: testedGive.distribution,
      testedGiveTop: testedGive.top,
      testedReceiveDist: testedReceive.distribution,
      testedReceiveTop: testedReceive.top,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: careDialectProfilesTable.userId,
      set: {
        selfGive: selfGive ?? null,
        selfReceive: selfReceive ?? null,
        testedGiveDist: testedGive.distribution,
        testedGiveTop: testedGive.top,
        testedReceiveDist: testedReceive.distribution,
        testedReceiveTop: testedReceive.top,
        updatedAt: now,
      },
    });

  const profile: CareDialectProfileData = {
    selfGive: selfGive ?? null,
    selfReceive: selfReceive ?? null,
    testedGive,
    testedReceive,
  };
  const comparison = buildComparison(profile);

  // Optional deep-AI lane: a short reflection layered on the deterministic
  // comparison. Consent-gated and daily-capped inside generate(); on consent
  // off, cap hit, provider error, or any throw we keep narrative null and the
  // deterministic comparison.insight stands on its own. We send only the
  // derived top dialects and the deterministic read, never raw answers.
  let narrative: string | null = null;
  const giveName = CARE_DIALECTS[testedGive.top].name;
  const receiveName = CARE_DIALECTS[testedReceive.top].name;
  const system = [
    "You are a warm, grounded relationship coach writing one short reflection",
    "about a person's Care Dialect (an original give/receive model of how they",
    "show and want care). You are given only their tested top dialect on each",
    "axis and a deterministic read of how that compares to what they guessed.",
    "Write 2 to 3 sentences, second person, specific and kind, no advice lists.",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'elevate', 'dive in', 'in today's world'. No emojis. Sound human.",
    "Return only the reflection text, no preamble, no quotes.",
  ].join("\n");
  const userPrompt = [
    `Tested top way of giving care: ${giveName}.`,
    `Tested top way of receiving care: ${receiveName}.`,
    `Deterministic read (${comparison.alignment}): ${comparison.insight}`,
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: userPrompt,
        requireContentConsent: true,
        userId,
        context: { toolName: "Care Dialect" },
        maxTokens: 320,
      },
      "",
    );
    if (aiResult.mode === "live" && !aiResult.isFallback) {
      const text = aiResult.output.trim();
      if (text) narrative = text;
    } else if (aiResult.fallbackReason) {
      req.log.info(
        { fallbackReason: aiResult.fallbackReason },
        "care dialect narrative fell back to deterministic baseline",
      );
    }
  } catch (err) {
    narrative = null;
    req.log.warn(
      { err },
      "care dialect deep-AI lane threw; using deterministic baseline",
    );
  }

  res.status(200).json(
    SaveCareDialectResponse.parse(
      buildResponse(profile, { isDemo: false, narrative, updatedAt: now }),
    ),
  );
});

export default router;
