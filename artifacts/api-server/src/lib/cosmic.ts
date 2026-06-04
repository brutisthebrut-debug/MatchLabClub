import pkg from "circular-natal-horoscope-js";
import type { CosmicPlacements } from "@workspace/db";

const { Origin, Horoscope } = pkg;

const FIRE = new Set(["Aries", "Leo", "Sagittarius"]);
const EARTH = new Set(["Taurus", "Virgo", "Capricorn"]);
const AIR = new Set(["Gemini", "Libra", "Aquarius"]);
const WATER = new Set(["Cancer", "Scorpio", "Pisces"]);

const CARDINAL = new Set(["Aries", "Cancer", "Libra", "Capricorn"]);
const FIXED = new Set(["Taurus", "Leo", "Scorpio", "Aquarius"]);
const MUTABLE = new Set(["Gemini", "Virgo", "Sagittarius", "Pisces"]);

export interface ComputeChartInput {
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
  birthLat: number;
  birthLng: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Weighted element and modality balance across the chart, then a small set of
 * soft self-expression priors. Sun, moon, and rising carry the most weight; the
 * personal planets a little; the slow outer planets least, since they read as a
 * generation more than a person. The result is a gentle read on how someone
 * tends to express, never a claim about who they are.
 */
function deriveTraits(
  weighted: { sign: string; weight: number }[],
): Pick<CosmicPlacements, "traits" | "elements" | "modalities"> {
  const el = { fire: 0, earth: 0, air: 0, water: 0 };
  const mo = { cardinal: 0, fixed: 0, mutable: 0 };
  let total = 0;
  for (const { sign, weight } of weighted) {
    total += weight;
    if (FIRE.has(sign)) el.fire += weight;
    else if (EARTH.has(sign)) el.earth += weight;
    else if (AIR.has(sign)) el.air += weight;
    else if (WATER.has(sign)) el.water += weight;
    if (CARDINAL.has(sign)) mo.cardinal += weight;
    else if (FIXED.has(sign)) mo.fixed += weight;
    else if (MUTABLE.has(sign)) mo.mutable += weight;
  }
  const denom = total || 1;
  const fe = el.fire / denom;
  const ea = el.earth / denom;
  const ai = el.air / denom;
  const wa = el.water / denom;
  const ca = mo.cardinal / denom;
  const fi = mo.fixed / denom;
  const mu = mo.mutable / denom;
  return {
    elements: {
      fire: round2(fe),
      earth: round2(ea),
      air: round2(ai),
      water: round2(wa),
    },
    modalities: {
      cardinal: round2(ca),
      fixed: round2(fi),
      mutable: round2(mu),
    },
    traits: {
      novelty: round2(0.5 * fe + 0.3 * ai + 0.2 * mu),
      stability: round2(0.6 * ea + 0.4 * fi),
      expression: round2(0.5 * ai + 0.3 * fe + 0.2 * ca),
      depth: round2(0.6 * wa + 0.4 * fi),
    },
  };
}

/**
 * Deterministic chart computation. No external calls, no keys, no rate limits:
 * this is the always-on baseline the cosmic layer is built on. Claude only ever
 * layers poetry on top of these derived placements, never the raw birth data.
 *
 * When birth time is unknown we compute at local noon and return a sun-only
 * read: planet signs are still meaningful, but rising and midheaven need an
 * accurate time, so we leave them null and mark the mode rather than guess.
 */
export function computeChart(input: ComputeChartInput): CosmicPlacements {
  const [year, month, date] = input.birthDate.split("-").map((p) => Number(p));
  const hasTime =
    typeof input.birthTime === "string" && input.birthTime.length === 5;
  const [hour, minute] = hasTime
    ? input.birthTime!.split(":").map((p) => Number(p))
    : [12, 0];

  const origin = new Origin({
    year: year!,
    // The library expects a zero-indexed month.
    month: (month ?? 1) - 1,
    date: date ?? 1,
    hour: hour!,
    minute: minute!,
    latitude: input.birthLat,
    longitude: input.birthLng,
  });
  const horoscope = new Horoscope({
    origin,
    houseSystem: "whole-sign",
    zodiac: "tropical",
    aspectPoints: ["bodies"],
    aspectWithPoints: ["bodies"],
    aspectTypes: ["major"],
    language: "en",
  });

  const bodyByKey = new Map(
    horoscope.CelestialBodies.all.map((b) => [b.key, b]),
  );
  const sun = horoscope.CelestialBodies.sun;
  const moon = horoscope.CelestialBodies.moon;

  const personalKeys = new Set(["mercury", "venus", "mars"]);
  const weighted: { sign: string; weight: number }[] = [];
  weighted.push({ sign: sun.Sign.label, weight: 3 });
  weighted.push({ sign: moon.Sign.label, weight: 3 });
  if (hasTime) {
    weighted.push({ sign: horoscope.Ascendant.Sign.label, weight: 2 });
  }
  for (const body of horoscope.CelestialBodies.all) {
    if (body.key === "sun" || body.key === "moon") continue;
    weighted.push({
      sign: body.Sign.label,
      weight: personalKeys.has(body.key) ? 1 : 0.5,
    });
  }

  const derived = deriveTraits(weighted);

  return {
    mode: hasTime ? "full" : "sunOnly",
    sun: {
      sign: sun.Sign.label,
      degree: round2(sun.ChartPosition.Ecliptic.DecimalDegrees),
    },
    moon: {
      sign: moon.Sign.label,
      degree: round2(moon.ChartPosition.Ecliptic.DecimalDegrees),
    },
    rising: hasTime
      ? {
          sign: horoscope.Ascendant.Sign.label,
          degree: round2(
            horoscope.Ascendant.ChartPosition.Ecliptic.DecimalDegrees,
          ),
        }
      : null,
    midheaven: hasTime ? { sign: horoscope.Midheaven.Sign.label } : null,
    bodies: horoscope.CelestialBodies.all
      .filter((b) => bodyByKey.has(b.key))
      .map((b) => ({ body: b.label, sign: b.Sign.label })),
    ...derived,
  };
}

function dominantElement(
  el: CosmicPlacements["elements"],
): "fire" | "earth" | "air" | "water" {
  const entries = Object.entries(el) as [
    "fire" | "earth" | "air" | "water",
    number,
  ][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

const ELEMENT_PAIR_NOTE: Record<string, string> = {
  "fire-fire": "Two sparks, fast and bright",
  "fire-air": "Spark meets air, things catch quickly",
  "fire-earth": "Heat meets ground, push and patience",
  "fire-water": "Steam and contrast, lots to feel",
  "earth-earth": "Two builders, steady and real",
  "earth-air": "Ground meets sky, ideas need rooting",
  "earth-water": "Soil and rain, quietly nourishing",
  "air-air": "Two talkers, ideas everywhere",
  "air-water": "Words meet feeling, learning each other's language",
  "water-water": "Two deep currents, lots beneath the surface",
};

function elementPairNote(a: string, b: string): string {
  return (
    ELEMENT_PAIR_NOTE[`${a}-${b}`] ??
    ELEMENT_PAIR_NOTE[`${b}-${a}`] ??
    "A blend worth exploring"
  );
}

/**
 * A playful, bounded "cosmic resonance" between two charts. It is a garnish, not
 * a verdict: it never feeds the real compatibility score and never gates a
 * match. Deterministic and symmetric, derived only from the two derived charts
 * (element balance plus the soft trait axes), clamped into a gentle 35 to 97
 * band so it always reads as a wink, never a hard zero or a fake certainty.
 */
export function synastryResonance(
  a: CosmicPlacements,
  b: CosmicPlacements,
): { score: number; note: string } {
  const elA = a.elements;
  const elB = b.elements;
  // Element harmony: cosine-like overlap of the two element balances, lifted by
  // a small bonus for the classic complementary pairings (fire with air, earth
  // with water) so opposites can also read as a spark.
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const keys = ["fire", "earth", "air", "water"] as const;
  for (const k of keys) {
    dot += elA[k] * elB[k];
    normA += elA[k] * elA[k];
    normB += elB[k] * elB[k];
  }
  const cosine =
    normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  const complement =
    Math.min(elA.fire, elB.air) +
    Math.min(elA.air, elB.fire) +
    Math.min(elA.earth, elB.water) +
    Math.min(elA.water, elB.earth);
  const elementHarmony = Math.min(1, 0.7 * cosine + 0.6 * complement);

  // Trait resonance: how close the two soft axes sit, on average.
  const traitKeys = Object.keys(a.traits) as (keyof CosmicPlacements["traits"])[];
  let diff = 0;
  for (const k of traitKeys) diff += Math.abs(a.traits[k] - b.traits[k]);
  const traitResonance = 1 - diff / traitKeys.length;

  const blend = 0.5 * elementHarmony + 0.5 * traitResonance;
  const score = Math.round(35 + Math.max(0, Math.min(1, blend)) * 62);
  const note = elementPairNote(dominantElement(elA), dominantElement(elB));
  return { score, note };
}

export interface CosmicWeatherAction {
  label: string;
  detail: string;
  href: string;
}

const SUN_WEATHER: Record<string, string> = {
  fire: "The sky leans bold today",
  earth: "The sky leans grounded today",
  air: "The sky leans curious today",
  water: "The sky leans tender today",
};

/**
 * Daily "cosmic weather": a star-flavoured wrapper around a real readiness
 * nudge. The honest action is always carried underneath, unchanged, so the
 * star language never replaces the real step; it just makes it feel like a
 * gentle daily invitation. Deterministic, derived from the chart and the
 * already-computed next action.
 */
export function buildCosmicWeather(
  p: CosmicPlacements,
  action: CosmicWeatherAction | null,
): { headline: string; reframe: string; action: CosmicWeatherAction | null } {
  const element = dominantElement(p.elements);
  const headline = SUN_WEATHER[element] ?? "The sky is quiet today";
  const reframe = action
    ? `A good day to ${action.label.toLowerCase()}. The honest version: ${action.detail}`
    : "You are already eligible. A good day to simply show up and stay consistent.";
  return { headline, reframe, action };
}

const TRAIT_COPY: Record<keyof CosmicPlacements["traits"], string> = {
  novelty: "drawn to novelty and momentum",
  stability: "grounded, steady, building things that last",
  expression: "outward, talkative, quick to connect through words",
  depth: "emotionally deep, reading the undercurrent in a room",
};

/**
 * The deterministic reading. Honest by construction: it names what the chart
 * leans toward as a mirror for self-reflection, never as a verdict, and it ties
 * back to the real work of getting ready. Claude can make this lyrical when the
 * deep AI lane is on; this is what every account sees by default.
 */
export function buildCosmicReading(p: CosmicPlacements): {
  headline: string;
  lines: string[];
  topTrait: keyof CosmicPlacements["traits"];
} {
  const risingPart =
    p.rising && p.mode === "full" ? `, ${p.rising.sign} rising` : "";
  const headline =
    p.mode === "full"
      ? `${p.sun.sign} sun, ${p.moon?.sign ?? "unknown"} moon${risingPart}`
      : `${p.sun.sign} sun`;

  const traitEntries = Object.entries(p.traits) as [
    keyof CosmicPlacements["traits"],
    number,
  ][];
  traitEntries.sort((a, b) => b[1] - a[1]);
  const topTrait = traitEntries[0]![0];

  const lines: string[] = [];
  lines.push(
    `Your chart leans ${TRAIT_COPY[topTrait]}. Treat that as a mirror to react to, not a label to live inside.`,
  );
  if (p.moon && p.mode === "full") {
    lines.push(
      `A ${p.moon.sign} moon points at how you process feeling. Notice where that rings true and where it does not.`,
    );
  }
  if (p.mode === "sunOnly") {
    lines.push(
      "You did not give a birth time, so this is a sun-only read. Add your birth time later for your rising sign and a fuller picture.",
    );
  }
  lines.push(
    "The point is not the stars. It is what you recognise in yourself, which is exactly the kind of signal that sharpens who we match you with.",
  );

  return { headline, lines, topTrait };
}
