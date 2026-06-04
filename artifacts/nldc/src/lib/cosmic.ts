// Frontend helpers for the Cosmic Compass page. The real chart is always
// computed server-side from the birth moment; this file only holds the demo
// fallback (so a signed-out visitor sees a real, played board) and a small
// curated city list so Beat 1 can capture a birth place without a geocoding
// dependency. Full geocoding and relocation arrive with the astrocartography
// beat.

export type CosmicReaction = "resonant" | "mixed" | "off";

export const COSMIC_REACTION_LABEL: Record<CosmicReaction, string> = {
  resonant: "This is so me",
  mixed: "Some of it",
  off: "Not really me",
};

export interface CuratedCity {
  label: string;
  lat: number;
  lng: number;
}

// A small, deliberately global and inclusive starter list. Users not on it can
// still enter their own coordinates. Real place search lands with Beat 2.
export const CURATED_CITIES: CuratedCity[] = [
  { label: "New York, USA", lat: 40.7128, lng: -74.006 },
  { label: "Los Angeles, USA", lat: 34.0522, lng: -118.2437 },
  { label: "London, UK", lat: 51.5072, lng: -0.1276 },
  { label: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { label: "Lagos, Nigeria", lat: 6.5244, lng: 3.3792 },
  { label: "Cairo, Egypt", lat: 30.0444, lng: 31.2357 },
  { label: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { label: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  { label: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
  { label: "Sao Paulo, Brazil", lat: -23.5558, lng: -46.6396 },
  { label: "Mexico City, Mexico", lat: 19.4326, lng: -99.1332 },
  { label: "Toronto, Canada", lat: 43.6532, lng: -79.3832 },
  { label: "Berlin, Germany", lat: 52.52, lng: 13.405 },
  { label: "Cape Town, South Africa", lat: -33.9249, lng: 18.4241 },
];

export interface DemoPlacements {
  mode: "full" | "sunOnly";
  sun: { sign: string; degree: number };
  moon: { sign: string; degree: number } | null;
  rising: { sign: string; degree: number } | null;
  midheaven: { sign: string } | null;
  bodies: { body: string; sign: string }[];
  traits: { novelty: number; stability: number; expression: number; depth: number };
  elements: { fire: number; earth: number; air: number; water: number };
  modalities: { cardinal: number; fixed: number; mutable: number };
}

// A hand-built sample so the page is never empty for a signed-out visitor. It
// never writes to the server and is clearly labelled as a sample in the UI.
export const DEMO_PLACEMENTS: DemoPlacements = {
  mode: "full",
  sun: { sign: "Scorpio", degree: 12.4 },
  moon: { sign: "Pisces", degree: 3.1 },
  rising: { sign: "Libra", degree: 21.8 },
  midheaven: { sign: "Cancer" },
  bodies: [
    { body: "Mercury", sign: "Scorpio" },
    { body: "Venus", sign: "Sagittarius" },
    { body: "Mars", sign: "Virgo" },
  ],
  traits: { novelty: 0.34, stability: 0.41, expression: 0.46, depth: 0.71 },
  elements: { fire: 0.18, earth: 0.27, air: 0.24, water: 0.31 },
  modalities: { cardinal: 0.38, fixed: 0.41, mutable: 0.21 },
};

export const DEMO_READING = {
  headline: "A deep current under a steady surface",
  lines: [
    "Your chart leans emotionally deep, reading the undercurrent in a room. Treat that as a mirror to react to, not a label to live inside.",
    "Water and earth carry your chart, so you tend to feel first and build slow.",
    "The work this points at: let people see the depth sooner than feels safe.",
  ],
  topTrait: "depth" as const,
};

export const TRAIT_LABEL: Record<string, string> = {
  novelty: "Novelty",
  stability: "Stability",
  expression: "Expression",
  depth: "Depth",
};

// Equirectangular projection: longitude maps straight to x, latitude to y, with
// no external map dependency. Returns fractions in [0, 1] so the caller can
// scale to any SVG viewBox. This is the same flat projection the dotted city
// list and meridian markers share so they always line up.
export function projectLngLat(
  lng: number,
  lat: number,
): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const y = (90 - lat) / 180;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

// Graticule longitudes/latitudes for the faint background grid. Kept coarse so
// the map reads as a quiet backdrop, never a busy chart.
export const MAP_GRID_LNGS = [-120, -60, 0, 60, 120];
export const MAP_GRID_LATS = [-60, -30, 0, 30, 60];

// Mirrors the server's CosmicLines shape closely enough for the demo board. The
// real page uses the generated type for live data; this is only the signed-out
// sample so the map is never empty.
export interface DemoLine {
  body: string;
  bodyLabel: string;
  angle: "MC" | "IC";
  lng: number;
  meaning: string;
}

export interface DemoLoveLineCity {
  key: string;
  label: string;
  lat: number;
  lng: number;
  body: string;
  bodyLabel: string;
  angle: "MC" | "IC";
  distanceMiles: number;
}

export interface DemoLines {
  mode: "full" | "sunOnly";
  lines: DemoLine[];
  loveLineCities: DemoLoveLineCity[];
  relocationOpen: boolean;
}

export const DEMO_LINES: DemoLines = {
  mode: "full",
  lines: [
    {
      body: "venus",
      bodyLabel: "Venus",
      angle: "MC",
      lng: -98,
      meaning: "Where warmth and connection come to the surface for you.",
    },
    {
      body: "venus",
      bodyLabel: "Venus",
      angle: "IC",
      lng: 82,
      meaning: "Where home and belonging feel quietly settled.",
    },
    {
      body: "mars",
      bodyLabel: "Mars",
      angle: "MC",
      lng: -10,
      meaning: "Where your drive and momentum run hottest.",
    },
  ],
  loveLineCities: [
    {
      key: "austin",
      label: "Austin, USA",
      lat: 30.2672,
      lng: -97.7431,
      body: "venus",
      bodyLabel: "Venus",
      angle: "MC",
      distanceMiles: 24,
    },
    {
      key: "mexico city",
      label: "Mexico City, Mexico",
      lat: 19.4326,
      lng: -99.1332,
      body: "venus",
      bodyLabel: "Venus",
      angle: "MC",
      distanceMiles: 96,
    },
  ],
  relocationOpen: false,
};

export interface DemoWeather {
  headline: string;
  reframe: string;
  action: { label: string; detail: string; href: string } | null;
}

export const DEMO_WEATHER: DemoWeather = {
  headline: "The sky leans tender today",
  reframe:
    "A good day to add a post-date note. The honest version: reflecting on your last date is the single highest-value signal you can feed right now.",
  action: {
    label: "Add a post-date note",
    detail:
      "Reflecting on your last date is the single highest-value signal you can feed right now.",
    href: "/me/matching",
  },
};

export interface CosmicShareSigns {
  sun: string | null;
  moon: string | null;
  rising: string | null;
}

export function buildCosmicShareText(
  signs: CosmicShareSigns,
  loveLineCityLabels: string[],
): string {
  const parts = [
    signs.sun ? `Sun ${signs.sun}` : "",
    signs.moon ? `Moon ${signs.moon}` : "",
    signs.rising ? `Rising ${signs.rising}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "";
  const cityNames = loveLineCityLabels.filter(Boolean).slice(0, 3).join(", ");
  const lovePart = cityNames ? ` My love lines run through ${cityNames}.` : "";
  return `My Cosmic Compass on MatchLab: ${parts.join(", ")}.${lovePart} A playful lens on top of the real work of getting relationship-ready.`;
}
