/**
 * Deterministic, dependency-free geography for matching proximity.
 *
 * The matching engine used to treat location as a binary string match on a
 * free-text city hint, so "SF" and "San Francisco" read as different places and
 * there was no notion of distance at all. This module gives the engine real,
 * graded distance for the cities we can resolve, while degrading gracefully to
 * an alias-aware string match for anything we cannot.
 *
 * Everything here is pure and offline: a small bundled gazetteer of common
 * metros plus an alias table. No external geocoding call, no API key, no
 * network at request time. A city we cannot resolve never hard-blocks a match;
 * it simply falls back to canonical-name equality.
 *
 * City-to-city distance is not PII (it is derived only from the coarse city
 * hint a member chose to share), so it is safe to surface in match reasons.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ProximityResult {
  /** Graded closeness 0-1 (1 = effectively same place). Symmetric. */
  score: number;
  /** Great-circle miles between the two cities, or null if not resolvable. */
  distanceMiles: number | null;
  /** True when both hints canonicalize to the same city name. */
  sameCanonicalCity: boolean;
  /** True when at least one side could not be resolved to coordinates. */
  approximate: boolean;
}

/**
 * Alias table: common shorthands and airport-style codes mapped to the
 * canonical city name used as the gazetteer key. Lowercased on both sides.
 */
const CITY_ALIASES: Readonly<Record<string, string>> = {
  sf: "san francisco",
  "san fran": "san francisco",
  frisco: "san francisco",
  "the city": "san francisco",
  sfo: "san francisco",
  nyc: "new york",
  "new york city": "new york",
  manhattan: "new york",
  brooklyn: "new york",
  bk: "new york",
  la: "los angeles",
  "l.a.": "los angeles",
  lax: "los angeles",
  chi: "chicago",
  chitown: "chicago",
  philly: "philadelphia",
  vegas: "las vegas",
  nola: "new orleans",
  dc: "washington",
  "washington dc": "washington",
  "washington d.c.": "washington",
  "d.c.": "washington",
  atl: "atlanta",
  "the bay": "san francisco",
  pdx: "portland",
  sd: "san diego",
  stl: "saint louis",
  "st louis": "saint louis",
  "st. louis": "saint louis",
  "st paul": "saint paul",
  "st. paul": "saint paul",
};

/**
 * Bundled gazetteer of common metros (US-heavy, with a handful of major world
 * cities), keyed by canonical lowercase name. Coordinates are city-center
 * approximations, which is the right granularity for radius-based dating.
 */
const GAZETTEER: Readonly<Record<string, GeoPoint>> = {
  "new york": { lat: 40.7128, lng: -74.006 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  houston: { lat: 29.7604, lng: -95.3698 },
  phoenix: { lat: 33.4484, lng: -112.074 },
  philadelphia: { lat: 39.9526, lng: -75.1652 },
  "san antonio": { lat: 29.4241, lng: -98.4936 },
  "san diego": { lat: 32.7157, lng: -117.1611 },
  dallas: { lat: 32.7767, lng: -96.797 },
  "san jose": { lat: 37.3382, lng: -121.8863 },
  austin: { lat: 30.2672, lng: -97.7431 },
  jacksonville: { lat: 30.3322, lng: -81.6557 },
  "fort worth": { lat: 32.7555, lng: -97.3308 },
  columbus: { lat: 39.9612, lng: -82.9988 },
  charlotte: { lat: 35.2271, lng: -80.8431 },
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  indianapolis: { lat: 39.7684, lng: -86.1581 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  denver: { lat: 39.7392, lng: -104.9903 },
  washington: { lat: 38.9072, lng: -77.0369 },
  boston: { lat: 42.3601, lng: -71.0589 },
  "el paso": { lat: 31.7619, lng: -106.485 },
  nashville: { lat: 36.1627, lng: -86.7816 },
  detroit: { lat: 42.3314, lng: -83.0458 },
  "oklahoma city": { lat: 35.4676, lng: -97.5164 },
  portland: { lat: 45.5152, lng: -122.6784 },
  "las vegas": { lat: 36.1699, lng: -115.1398 },
  memphis: { lat: 35.1495, lng: -90.049 },
  louisville: { lat: 38.2527, lng: -85.7585 },
  baltimore: { lat: 39.2904, lng: -76.6122 },
  milwaukee: { lat: 43.0389, lng: -87.9065 },
  albuquerque: { lat: 35.0844, lng: -106.6504 },
  tucson: { lat: 32.2226, lng: -110.9747 },
  fresno: { lat: 36.7378, lng: -119.7871 },
  sacramento: { lat: 38.5816, lng: -121.4944 },
  "kansas city": { lat: 39.0997, lng: -94.5786 },
  mesa: { lat: 33.4152, lng: -111.8315 },
  atlanta: { lat: 33.749, lng: -84.388 },
  omaha: { lat: 41.2565, lng: -95.9345 },
  "colorado springs": { lat: 38.8339, lng: -104.8214 },
  raleigh: { lat: 35.7796, lng: -78.6382 },
  "long beach": { lat: 33.7701, lng: -118.1937 },
  "virginia beach": { lat: 36.8529, lng: -75.978 },
  miami: { lat: 25.7617, lng: -80.1918 },
  oakland: { lat: 37.8044, lng: -122.2712 },
  minneapolis: { lat: 44.9778, lng: -93.265 },
  tulsa: { lat: 36.154, lng: -95.9928 },
  "saint louis": { lat: 38.627, lng: -90.1994 },
  "saint paul": { lat: 44.9537, lng: -93.09 },
  tampa: { lat: 27.9506, lng: -82.4572 },
  orlando: { lat: 28.5383, lng: -81.3792 },
  pittsburgh: { lat: 40.4406, lng: -79.9959 },
  cincinnati: { lat: 39.1031, lng: -84.512 },
  cleveland: { lat: 41.4993, lng: -81.6944 },
  "new orleans": { lat: 29.9511, lng: -90.0715 },
  "salt lake city": { lat: 40.7608, lng: -111.891 },
  "santa monica": { lat: 34.0195, lng: -118.4912 },
  pasadena: { lat: 34.1478, lng: -118.1445 },
  berkeley: { lat: 37.8715, lng: -122.273 },
  "palo alto": { lat: 37.4419, lng: -122.143 },
  "jersey city": { lat: 40.7178, lng: -74.0431 },
  newark: { lat: 40.7357, lng: -74.1724 },
  // A handful of major world metros for international members.
  london: { lat: 51.5074, lng: -0.1278 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  vancouver: { lat: 49.2827, lng: -123.1207 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  berlin: { lat: 52.52, lng: 13.405 },
  paris: { lat: 48.8566, lng: 2.3522 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  "mexico city": { lat: 19.4326, lng: -99.1332 },
};

/** Default radius (miles) the proximity falloff is tuned around. */
export const DEFAULT_RADIUS_MILES = 35;

/**
 * Canonicalize a free-text city hint to a comparable key: trimmed, lowercased,
 * punctuation-light, and resolved through the alias table. Strips a trailing
 * state/country qualifier after a comma ("Austin, TX" -> "austin") since the
 * gazetteer is keyed by city name. Returns "" for empty input.
 */
export function canonicalizeCity(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().toLowerCase();
  if (s.length === 0) return "";
  // Drop a trailing ", state/country" qualifier; keep the city portion.
  const comma = s.indexOf(",");
  if (comma > 0) s = s.slice(0, comma).trim();
  // Collapse internal whitespace.
  s = s.replace(/\s+/g, " ");
  return CITY_ALIASES[s] ?? s;
}

/** Resolve a city hint to coordinates, or null when not in the gazetteer. */
export function geocodeCity(raw: string | null | undefined): GeoPoint | null {
  const key = canonicalizeCity(raw);
  if (key.length === 0) return null;
  return GAZETTEER[key] ?? null;
}

/** Great-circle distance in miles between two points (haversine). */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.7613; // Earth radius in miles.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Map a distance to a graded 0-1 proximity, tuned around `radiusMiles`. Inside
 * the inner band (40% of radius) it reads as full credit; it falls off linearly
 * to zero at twice the radius. The curve is symmetric in its two cities by
 * construction (distance is symmetric).
 */
export function distanceToScore(
  distanceMiles: number,
  radiusMiles: number = DEFAULT_RADIUS_MILES,
): number {
  const r = radiusMiles > 0 ? radiusMiles : DEFAULT_RADIUS_MILES;
  const near = r * 0.4;
  const far = r * 2;
  if (distanceMiles <= near) return 1;
  if (distanceMiles >= far) return 0;
  return clamp01(1 - (distanceMiles - near) / (far - near));
}

/**
 * Graded proximity between two free-text city hints. Resolvable on both sides:
 * real great-circle distance graded by `radiusMiles`. Otherwise: alias-aware
 * canonical equality (same city = 1, different or unknown = 0), flagged
 * `approximate` so callers can soften the copy. Always symmetric.
 */
export function proximityBetween(
  cityA: string | null | undefined,
  cityB: string | null | undefined,
  radiusMiles: number = DEFAULT_RADIUS_MILES,
): ProximityResult {
  const canonA = canonicalizeCity(cityA);
  const canonB = canonicalizeCity(cityB);
  const sameCanonicalCity = canonA.length > 0 && canonA === canonB;

  const pointA = geocodeCity(cityA);
  const pointB = geocodeCity(cityB);

  if (pointA && pointB) {
    const distanceMiles = haversineMiles(pointA, pointB);
    return {
      score: distanceToScore(distanceMiles, radiusMiles),
      distanceMiles,
      sameCanonicalCity,
      approximate: false,
    };
  }

  // Fallback: we cannot place one or both cities, so degrade to canonical
  // equality. Same name reads as same place; anything else is treated as far,
  // never a hard block elsewhere in the engine.
  return {
    score: sameCanonicalCity ? 1 : 0,
    distanceMiles: null,
    sameCanonicalCity,
    approximate: true,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
