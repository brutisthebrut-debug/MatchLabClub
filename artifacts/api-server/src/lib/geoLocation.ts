import { createRequire } from "node:module";
import { logger } from "./logger";

type GeoLookupFn = (ip: string) => {
  city?: string;
  region?: string;
  country?: string;
} | null;

let geoLookup: GeoLookupFn | null = null;
let geoLoadAttempted = false;

function loadGeoLookup(): GeoLookupFn | null {
  if (geoLoadAttempted) return geoLookup;
  geoLoadAttempted = true;
  try {
    const require_ = createRequire(import.meta.url);
    const mod = require_("geoip-lite") as {
      lookup: (ip: string) => {
        city?: string;
        region?: string;
        country?: string;
      } | null;
    };
    geoLookup = (ip: string) => mod.lookup(ip);
  } catch (err) {
    logger.warn(
      { err },
      "geoip-lite unavailable; sign-in location lookups disabled",
    );
    geoLookup = null;
  }
  return geoLookup;
}

const REGION_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  IE: "Ireland",
  NZ: "New Zealand",
  MX: "Mexico",
  BR: "Brazil",
  IN: "India",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  SG: "Singapore",
  ZA: "South Africa",
};

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80:")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

/**
 * Returns a coarse human-readable approximate location for an IP, e.g.
 * "Brooklyn, NY, US" or "London, GB". Returns null if the IP is private,
 * empty, or cannot be resolved. Lookups are local (bundled MaxMind GeoLite
 * data via geoip-lite), no third-party calls are made.
 */
export function describeIpLocation(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const normalized = normalizeIp(ip);
  if (!normalized || isPrivateIp(normalized)) return null;

  const lookup = loadGeoLookup();
  if (!lookup) return null;

  let result: { city?: string; region?: string; country?: string } | null;
  try {
    result = lookup(normalized);
  } catch (err) {
    logger.warn({ err, ip: normalized }, "geoip lookup threw");
    return null;
  }
  if (!result) return null;

  const country = result.country?.trim();
  if (!country) return null;
  const city = result.city?.trim();
  const region = result.region?.trim();
  const countryLabel = REGION_NAMES[country] ?? country;

  const parts: string[] = [];
  if (city) parts.push(city);
  if (country === "US" && region) {
    parts.push(region);
    parts.push("US");
  } else {
    if (region && region !== city) parts.push(region);
    parts.push(countryLabel);
  }
  return parts.join(", ");
}
