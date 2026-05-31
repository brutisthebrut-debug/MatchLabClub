import { useEffect } from "react";

const BRAND = "MatchLab Club";

function normalize(title: string): string {
  return title
    .replace(/\s*[·—\-|]\s*NLDC.*$/i, "")
    .replace(/\s*[·—\-|]\s*(MatchLab Club|Next Level Dating Club).*$/i, "")
    .trim();
}

export interface MetaOptions {
  /** Absolute URL for <link rel="canonical"> and og:url. */
  canonicalUrl?: string;
  /** Open Graph object type. Defaults to "website". */
  type?: "website" | "article";
}

export function useMeta(
  title: string,
  description: string,
  ogImage?: string,
  options?: MetaOptions,
) {
  const canonicalUrl = options?.canonicalUrl;
  const type = options?.type ?? "website";

  useEffect(() => {
    const clean = normalize(title);
    const fullTitle = clean ? `${clean} | ${BRAND}` : BRAND;
    document.title = fullTitle;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [attrName, attrValue] = attr.split("=");
        el.setAttribute(attrName, attrValue ?? attrName);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    setMeta('meta[name="description"]', 'name=description', description);
    setMeta('meta[property="og:title"]', 'property=og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property=og:description', description);
    setMeta('meta[property="og:type"]', 'property=og:type', type);
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', description);

    if (ogImage) {
      setMeta('meta[property="og:image"]', 'property=og:image', ogImage);
      setMeta('meta[name="twitter:image"]', 'name=twitter:image', ogImage);
      setMeta('meta[name="twitter:card"]', 'name=twitter:card', 'summary_large_image');
    }

    if (canonicalUrl) {
      setMeta('meta[property="og:url"]', 'property=og:url', canonicalUrl);
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonicalUrl);
    } else {
      // No canonical for this page: drop any stale tag left by a prior route.
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('meta[property="og:url"]')?.remove();
    }

    return () => {
      document.title = BRAND;
    };
  }, [title, description, ogImage, canonicalUrl, type]);
}
