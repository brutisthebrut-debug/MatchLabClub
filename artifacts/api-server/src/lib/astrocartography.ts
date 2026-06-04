import pkg from "circular-natal-horoscope-js";
import {
  gazetteerEntries,
  haversineMiles,
  titleCaseCity,
  type GeoPoint,
} from "./geo";
import type { ComputeChartInput } from "./cosmic";

const { Origin, Horoscope } = pkg;

/**
 * Astrocartography: where a chart's planetary lines fall on the map.
 *
 * This is the honest, tractable slice of astrocartography. We compute each
 * relationship-relevant planet's meridian lines (MC, where the planet sits at
 * the top of the sky, and IC, its mirror at the base). These are lines of
 * constant longitude, derived from the planet's right ascension and the
 * sidereal time at birth, so they are real geometry, not decoration. We do not
 * fake the curved AC/DC horizon lines, which need latitude-by-latitude solving;
 * we are upfront that these are the vertical meridian lines.
 *
 * Everything is deterministic and offline. The lines are derived from the same
 * birth moment that builds the chart, and we reuse the library's own midheaven
 * to recover sidereal time so the lines stay consistent with the chart the user
 * already sees, regardless of how the library handles timezones internally.
 *
 * Lines need an accurate birth time (the midheaven moves about a degree every
 * four minutes), so this returns null in sun-only mode rather than guess.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
// Mean obliquity of the ecliptic near J2000. A fixed value is plenty here: the
// drift is a fraction of a degree per century and our city ranking is coarse.
const OBLIQUITY = 23.4393;

function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** Wrap a longitude into [-180, 180). */
function norm180(d: number): number {
  return norm360(d + 180) - 180;
}

/** Right ascension (degrees, 0..360) of an ecliptic longitude, latitude ~0. */
function eclipticToRA(lonDeg: number): number {
  const lon = lonDeg * RAD;
  const ra = Math.atan2(
    Math.sin(lon) * Math.cos(OBLIQUITY * RAD),
    Math.cos(lon),
  );
  return norm360(ra * DEG);
}

export type AstroAngle = "MC" | "IC";

export interface AstroLine {
  /** Lowercase body key, e.g. "venus". */
  body: string;
  /** Display label for the body, e.g. "Venus". */
  bodyLabel: string;
  angle: AstroAngle;
  /** Longitude where this meridian line falls, in [-180, 180). */
  lng: number;
  /** Honest, plain-language read of what this line tends to amplify. */
  meaning: string;
}

export interface LoveLineCity {
  /** Canonical gazetteer key. */
  key: string;
  /** Display label, e.g. "San Francisco". */
  label: string;
  lat: number;
  lng: number;
  /** Which line this city sits closest to. */
  body: string;
  bodyLabel: string;
  angle: AstroAngle;
  /** Approximate east-west distance to that line, in miles. */
  distanceMiles: number;
}

export interface Astrocartography {
  mode: "full";
  lines: AstroLine[];
  /** Cities near a warmth or growth line, nearest first. */
  loveLineCities: LoveLineCity[];
}

// Relationship-relevant bodies and the plain read of each meridian line. Venus
// leads the love story; Jupiter is growth and luck; the Sun is vitality and
// being seen. Moon and Mars round out the map but do not drive city ranking.
const LINE_MEANING: Record<string, { MC: string; IC: string }> = {
  sun: {
    MC: "where you stand out and feel most like yourself",
    IC: "where you feel rooted and at home",
  },
  moon: {
    MC: "where your feelings are most visible to others",
    IC: "where you feel emotionally safe",
  },
  venus: {
    MC: "where warmth and attraction tend to come easily",
    IC: "where love feels like coming home",
  },
  mars: {
    MC: "where you move with drive and initiative",
    IC: "where your energy turns inward and private",
  },
  jupiter: {
    MC: "where doors open and growth feels close",
    IC: "where you expand and feel lucky at your core",
  },
};

const LINE_BODIES = ["sun", "moon", "venus", "mars", "jupiter"] as const;
// Bodies whose lines define a "love line" city for the relocation tie-in:
// warmth (Venus), growth and luck (Jupiter), and vitality (Sun).
const LOVE_BODIES = new Set(["venus", "jupiter", "sun"]);
// A city counts as "on" a line when its center is within this many miles of the
// meridian. Generous on purpose: this widens discovery, it never gates anything.
const LOVE_LINE_MILES = 400;
const MAX_LOVE_CITIES = 6;

/**
 * Compute the planetary meridian lines for a birth moment and rank known metros
 * by closeness to a warmth or growth line. Returns null in sun-only mode (no
 * birth time means no reliable midheaven, so no lines).
 */
export function computeAstrocartography(
  input: ComputeChartInput,
): Astrocartography | null {
  const hasTime =
    typeof input.birthTime === "string" && input.birthTime.length === 5;
  if (!hasTime) return null;

  const [year, month, date] = input.birthDate.split("-").map((p) => Number(p));
  const [hour, minute] = input.birthTime!.split(":").map((p) => Number(p));

  const origin = new Origin({
    year: year!,
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

  // Recover Greenwich sidereal time from the library's own midheaven so our
  // lines stay consistent with the chart it computed. The MC's right ascension
  // equals the local sidereal time at birth; subtract the birth longitude to get
  // sidereal time at Greenwich.
  const mcLon = horoscope.Midheaven.ChartPosition.Ecliptic.DecimalDegrees;
  const ramc = eclipticToRA(mcLon);
  const gst = norm360(ramc - input.birthLng);

  const byKey = new Map(horoscope.CelestialBodies.all.map((b) => [b.key, b]));

  const lines: AstroLine[] = [];
  for (const key of LINE_BODIES) {
    const body = byKey.get(key);
    if (!body) continue;
    const lon = body.ChartPosition.Ecliptic.DecimalDegrees;
    const ra = eclipticToRA(lon);
    // The planet is on the local meridian where local sidereal time equals its
    // right ascension; that local sidereal time happens at longitude RA - GST.
    const mcLng = norm180(ra - gst);
    const icLng = norm180(mcLng + 180);
    const meaning = LINE_MEANING[key]!;
    lines.push({
      body: key,
      bodyLabel: body.label,
      angle: "MC",
      lng: Math.round(mcLng * 100) / 100,
      meaning: meaning.MC,
    });
    lines.push({
      body: key,
      bodyLabel: body.label,
      angle: "IC",
      lng: Math.round(icLng * 100) / 100,
      meaning: meaning.IC,
    });
  }

  const loveLines = lines.filter((l) => LOVE_BODIES.has(l.body));
  const ranked: LoveLineCity[] = [];
  for (const { key, point } of gazetteerEntries()) {
    let best: { line: AstroLine; miles: number } | null = null;
    for (const line of loveLines) {
      // Distance from the city to the meridian, measured east-west at the city's
      // own latitude (the closest point on a line of constant longitude).
      const onLine: GeoPoint = { lat: point.lat, lng: line.lng };
      const miles = haversineMiles(point, onLine);
      if (best === null || miles < best.miles) best = { line, miles };
    }
    if (best && best.miles <= LOVE_LINE_MILES) {
      ranked.push({
        key,
        label: titleCaseCity(key),
        lat: point.lat,
        lng: point.lng,
        body: best.line.body,
        bodyLabel: best.line.bodyLabel,
        angle: best.line.angle,
        distanceMiles: Math.round(best.miles),
      });
    }
  }
  ranked.sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    mode: "full",
    lines,
    loveLineCities: ranked.slice(0, MAX_LOVE_CITIES),
  };
}

/**
 * The canonical gazetteer keys of a chart's love-line cities, for the matching
 * tie-in. A relocation-open member's candidates near any of these cities pass
 * the radius gate even when their home city is far. Empty in sun-only mode.
 */
export function loveLineCityKeys(input: ComputeChartInput): string[] {
  const astro = computeAstrocartography(input);
  if (!astro) return [];
  return astro.loveLineCities.map((c) => c.key);
}
