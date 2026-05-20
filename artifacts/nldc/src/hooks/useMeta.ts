import { useEffect } from "react";

export function useMeta(title: string, description: string) {
  useEffect(() => {
    const fullTitle = `${title} | Next Level Dating Club`;
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

    return () => {
      document.title = "Next Level Dating Club";
    };
  }, [title, description]);
}
