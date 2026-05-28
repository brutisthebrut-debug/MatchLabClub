type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(MEASUREMENT_ID) && typeof window !== "undefined";
}

export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  initialized = true;

  const id = MEASUREMENT_ID as string;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  const gtag: GtagFn = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", id, { send_page_view: false });
}

export function trackPageView(path: string, title?: string): void {
  if (!isAnalyticsEnabled() || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : ""),
    page_location: typeof window !== "undefined" ? window.location.href : "",
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled() || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}
