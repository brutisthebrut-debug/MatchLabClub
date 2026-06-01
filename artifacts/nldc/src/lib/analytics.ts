type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

// First-party journey instrumentation. Independent of Google Analytics: these
// beacons always fire (best-effort) so the founder's Activity view works even
// when VITE_GA_MEASUREMENT_ID is unset. The server records visits and tool
// completions against the signed-in user (from the session) or the anon id below.
const ANON_ID_KEY = "ml_anon_id";

function getAnonId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

// Browser-observable journey steps the server cannot see on its own. Keep this
// list narrow: the server enforces the same allowlist, anything else is dropped.
type ClientJourneyEventType = "visit" | "tool_completed";

// Curated trackEvent names that represent finishing a real tool. Only these are
// mirrored to the first-party `tool_completed` step; navigation and share/cancel
// events stay GA-only so the Activity feed reflects genuine tool completions.
const CURATED_TOOL_COMPLETIONS = new Set<string>([
  "audit_completed",
  "coach_session_completed",
  "quiz_completed",
  "quiz_wellness_saved",
  "onboarding_complete",
  "matching_pool_joined",
  "rehearsal_started",
]);

function recordJourneyEvent(
  eventType: ClientJourneyEventType,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        eventType,
        anonId: getAnonId(),
        props: props ?? undefined,
      }),
    }).catch(() => {});
  } catch {
    // Telemetry must never surface to the user.
  }
}

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
  // First-party visit beacon fires regardless of GA configuration.
  recordJourneyEvent("visit", { path });
  if (!isAnalyticsEnabled() || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : ""),
    page_location: typeof window !== "undefined" ? window.location.href : "",
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  // Mirror genuine tool completions to the first-party stream regardless of GA.
  if (CURATED_TOOL_COMPLETIONS.has(name)) {
    recordJourneyEvent("tool_completed", { tool: name });
  }
  if (!isAnalyticsEnabled() || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}
