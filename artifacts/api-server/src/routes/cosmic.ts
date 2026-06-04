import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cosmicChartsTable, type CosmicChartRow } from "@workspace/db";
import {
  SaveCosmicChartBody,
  SaveCosmicReactionBody,
  SetCosmicRelocationBody,
} from "@workspace/api-zod";
import { cosmicReadingSchema, parseAiJson } from "@workspace/ai-schemas";
import {
  computeChart,
  buildCosmicReading,
  buildCosmicWeather,
} from "../lib/cosmic";
import { computeAstrocartography } from "../lib/astrocartography";
import { computeNextActions } from "../lib/readiness";
import { computeReadiness, readinessThreshold } from "./matching";
import { generate } from "../lib/aiService";

const router: IRouter = Router();

function serialize(row: CosmicChartRow) {
  const reading = buildCosmicReading(row.placements);
  return {
    birthDate: row.birthDate,
    birthTime: row.birthTime ?? null,
    birthPlace: row.birthPlace,
    birthLat: row.birthLat,
    birthLng: row.birthLng,
    placements: row.placements,
    reaction: row.reaction ?? null,
    reading: {
      headline: reading.headline,
      lines: reading.lines,
      topTrait: reading.topTrait,
      source: "deterministic" as const,
      deep: null,
    },
  };
}

async function loadChart(userId: string): Promise<CosmicChartRow | undefined> {
  const [row] = await db
    .select()
    .from(cosmicChartsTable)
    .where(eq(cosmicChartsTable.userId, userId))
    .limit(1);
  return row;
}

router.get("/me/cosmic", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = await loadChart(req.user.id);
  if (!row) {
    res.status(404).json({ error: "No chart yet" });
    return;
  }
  res.json(serialize(row));
});

router.post("/me/cosmic", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SaveCosmicChartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Compute deterministically from the birth moment, then store only the derived
  // placements alongside the inputs. One chart per person: saving again replaces
  // it in place, since a person has one birth moment.
  const placements = computeChart({
    birthDate: parsed.data.birthDate,
    birthTime: parsed.data.birthTime ?? null,
    birthPlace: parsed.data.birthPlace,
    birthLat: parsed.data.birthLat,
    birthLng: parsed.data.birthLng,
  });
  const [row] = await db
    .insert(cosmicChartsTable)
    .values({
      userId: req.user.id,
      birthDate: parsed.data.birthDate,
      birthTime: parsed.data.birthTime ?? null,
      birthPlace: parsed.data.birthPlace,
      birthLat: parsed.data.birthLat,
      birthLng: parsed.data.birthLng,
      placements,
    })
    .onConflictDoUpdate({
      target: cosmicChartsTable.userId,
      set: {
        birthDate: parsed.data.birthDate,
        birthTime: parsed.data.birthTime ?? null,
        birthPlace: parsed.data.birthPlace,
        birthLat: parsed.data.birthLat,
        birthLng: parsed.data.birthLng,
        placements,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.post("/me/cosmic/reaction", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SaveCosmicReactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await loadChart(req.user.id);
  if (!existing) {
    res.status(404).json({ error: "No chart to react to" });
    return;
  }
  const [row] = await db
    .update(cosmicChartsTable)
    .set({ reaction: parsed.data.reaction, updatedAt: new Date() })
    .where(eq(cosmicChartsTable.userId, req.user.id))
    .returning();
  res.json(serialize(row));
});

router.post("/me/cosmic/reading", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = await loadChart(req.user.id);
  if (!row) {
    res.status(404).json({ error: "No chart yet" });
    return;
  }
  // Deterministic baseline is always returned and is the honest, always-on read
  // every account sees. The opt-in Claude synthesis is layered on top only when
  // the deep AI lane is on and under the daily cap; it gets derived placements
  // only, never the raw birth moment, and any failure falls back to baseline.
  const reading = buildCosmicReading(row.placements);
  const p = row.placements;
  let headline = reading.headline;
  let lines = reading.lines;
  let source: "deterministic" | "claude" = "deterministic";
  let deep: { headline: string; lines: string[] } | null = null;

  const signLines = [
    `Sun in ${p.sun.sign}`,
    p.moon ? `Moon in ${p.moon.sign}` : "Moon unknown",
    p.rising ? `Rising in ${p.rising.sign}` : "Rising unknown (no birth time)",
  ].join(", ");
  const traitLines = [
    `novelty ${p.traits.novelty}`,
    `stability ${p.traits.stability}`,
    `expression ${p.traits.expression}`,
    `depth ${p.traits.depth}`,
  ].join(", ");
  const system = [
    "You are Cosmic Compass, a playful but honest astrology guide inside a",
    "relationship-readiness app. You write a short, warm, lyrical reflection",
    "from a person's derived chart leanings. Never claim destiny or certainty:",
    "frame everything as a mirror for self-reflection, not a verdict. Always tie",
    "back gently to the real work of becoming relationship-ready.",
    "",
    `Chart leanings (derived, no personal data): ${signLines}.`,
    `Soft trait axes (0 to 1): ${traitLines}.`,
    `The deterministic read says this person leans: ${reading.topTrait}.`,
    "",
    "Return JSON only. No prose, no code fences. Match this shape exactly:",
    '{ "headline": "a short evocative title",',
    '  "lines": ["2 to 5 short reflective lines, each one sentence"] }',
    "",
    "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
    "'seamless', 'elevate', 'transformative', 'dive in', or 'in today's world'.",
    "No emojis. Vary sentence length. Sound human, not like a fortune cookie.",
  ].join("\n");

  try {
    const aiResult = await generate(
      {
        provider: "anthropic",
        system,
        user: "Write my cosmic reflection.",
        expectJson: true,
        requireContentConsent: true,
        userId: req.user.id,
        context: { toolName: "Cosmic Compass" },
        maxTokens: 500,
      },
      "",
    );

    if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
      const ai = parseAiJson(cosmicReadingSchema, aiResult.output);
      if (ai) {
        headline = ai.headline;
        lines = ai.lines;
        source = "claude";
        deep = { headline: ai.headline, lines: ai.lines };
      }
    } else if (aiResult.fallbackReason) {
      req.log.info(
        { fallbackReason: aiResult.fallbackReason },
        "cosmic reading fell back to deterministic baseline",
      );
    }
  } catch (err) {
    headline = reading.headline;
    lines = reading.lines;
    source = "deterministic";
    deep = null;
    req.log.warn(
      { err },
      "cosmic deep-AI lane threw; using deterministic baseline",
    );
  }

  res.json({
    headline,
    lines,
    topTrait: reading.topTrait,
    source,
    deep,
  });
});

router.get("/me/cosmic/lines", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = await loadChart(req.user.id);
  if (!row) {
    res.status(404).json({ error: "No chart yet" });
    return;
  }
  // Lines need a birth time. Without one we report sun-only mode with no lines
  // rather than guess a midheaven; the frontend keeps the relocation toggle but
  // explains why the map is empty.
  const astro = computeAstrocartography({
    birthDate: row.birthDate,
    birthTime: row.birthTime ?? null,
    birthPlace: row.birthPlace,
    birthLat: row.birthLat,
    birthLng: row.birthLng,
  });
  if (!astro) {
    res.json({
      mode: "sunOnly" as const,
      lines: [],
      loveLineCities: [],
      relocationOpen: row.relocationOpen,
    });
    return;
  }
  res.json({ ...astro, relocationOpen: row.relocationOpen });
});

router.post("/me/cosmic/relocation", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SetCosmicRelocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await loadChart(req.user.id);
  if (!existing) {
    res.status(404).json({ error: "No chart yet" });
    return;
  }
  const [row] = await db
    .update(cosmicChartsTable)
    .set({ relocationOpen: parsed.data.open, updatedAt: new Date() })
    .where(eq(cosmicChartsTable.userId, req.user.id))
    .returning();
  res.json({ relocationOpen: row!.relocationOpen });
});

router.get("/me/cosmic/weather", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = await loadChart(req.user.id);
  if (!row) {
    res.status(404).json({ error: "No chart yet" });
    return;
  }
  // Daily cosmic weather is a star-flavoured wrapper around the user's real
  // top readiness nudge. The honest action travels underneath unchanged, so
  // the star language never replaces the real step it points at.
  const readiness = await computeReadiness(req.user.id);
  const threshold = await readinessThreshold();
  const eligible = readiness.score >= threshold;
  const actions = computeNextActions(
    readiness.breakdown,
    eligible,
    1,
    readiness.weights,
  );
  const top = actions[0];
  const weather = buildCosmicWeather(
    row.placements,
    top
      ? { label: top.label, detail: top.detail, href: top.href }
      : null,
  );
  res.json(weather);
});

export default router;
