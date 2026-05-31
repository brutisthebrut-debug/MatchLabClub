/**
 * SEO helpers shared across pages.
 *
 * Everything here is client-side: the app is a Vite SPA, and meta/structured
 * data are applied at runtime (see `useMeta` and `JsonLd`). Google renders JS,
 * so this keeps SEO consistent with how the rest of the app already sets meta.
 */

const FALLBACK_ORIGIN = "https://matchlab.club";

/** The site origin, resolved from the running page when available. */
export function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
}

/** Turn a root-relative path into an absolute URL for canonical / OG tags. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin().replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

/** Default social-share preview image, used when a page has no specific one. */
export const DEFAULT_OG_IMAGE = "/opengraph.jpg";

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/**
 * Normalize an article date to ISO-8601 (YYYY-MM-DD) for structured data.
 * Accepts already-ISO dates ("2026-05-28") and "Month YYYY" strings
 * ("May 2026" -> "2026-05-01"). Returns undefined when it can't parse, so
 * callers can omit invalid date properties instead of emitting bad schema.
 */
export function toIsoDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const monthYear = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    if (month) return `${monthYear[2]}-${month}-01`;
  }
  return undefined;
}

/** Brand publisher block reused across structured-data entries. */
export function publisherSchema() {
  return {
    "@type": "Organization",
    name: "MatchLab Club",
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/matchlab-logo.png"),
    },
  };
}
