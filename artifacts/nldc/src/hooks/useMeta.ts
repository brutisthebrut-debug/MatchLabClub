import { useEffect } from "react";

const BRAND = "MatchLab Club";

function normalize(title: string): string {
  return title
    .replace(/\s*[·—\-|]\s*NLDC.*$/i, "")
    .replace(/\s*[·—\-|]\s*Next Level Dating Club.*$/i, "")
    .replace(/\s*[·—\-|]\s*MatchLab Club.*$/i, "")
    .trim();
}

export function useMeta(title: string, description: string, ogImage?: string) {
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
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', description);

    if (ogImage) {
      setMeta('meta[property="og:image"]', 'property=og:image', ogImage);
      setMeta('meta[name="twitter:image"]', 'name=twitter:image', ogImage);
      setMeta('meta[name="twitter:card"]', 'name=twitter:card', 'summary_large_image');
    }

    return () => {
      document.title = BRAND;
    };
  }, [title, description, ogImage]);
}
