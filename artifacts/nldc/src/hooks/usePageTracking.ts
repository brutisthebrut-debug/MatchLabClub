import { useEffect } from "react";
import { useLocation } from "wouter";
import { trackPageView } from "@/lib/analytics";

export function usePageTracking(): void {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
}
