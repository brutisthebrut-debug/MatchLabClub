import { useEffect } from "react";

/**
 * Inject a JSON-LD structured-data block into <head>. Renders nothing.
 *
 * Each instance must have a stable `id` so it can be replaced/cleaned up on
 * unmount without touching other structured-data scripts on the page.
 */
export function JsonLd({ id, data }: { id: string; data: Record<string, unknown> }) {
  useEffect(() => {
    const scriptId = `jsonld-${id}`;
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = scriptId;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({ "@context": "https://schema.org", ...data });

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [id, data]);

  return null;
}
