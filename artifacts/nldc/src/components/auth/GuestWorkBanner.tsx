import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { hasAnyAnonymousIds } from "@/lib/anonymousIds";
import { Button } from "@/components/ui/button";
import { LogIn, ShieldCheck, X } from "lucide-react";

const DISMISS_KEY = "nldc:guestWorkBanner:dismissed";

function wasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Slim, dismissible banner shown to anonymous visitors who already have work
 * saved locally (an audit, coaching session, quiz answer, etc.). It makes the
 * anonymous-first model obvious: their work is real and saved here, and signing
 * in keeps it while turning it into readiness and matching. It never blocks the
 * page and stays hidden until there is something worth saving. Authenticated
 * users and first-time visitors with no work never see it.
 */
export function GuestWorkBanner() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [location] = useLocation();
  const [hasWork, setHasWork] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);

  // localStorage is not reactive, so re-check whenever the route changes (a
  // fresh anonymous audit drops the user on a new page) or auth state settles.
  useEffect(() => {
    setHasWork(hasAnyAnonymousIds());
  }, [location, isAuthenticated, isLoading]);

  const onCheckout = location === "/checkout" || location.startsWith("/checkout/");

  if (isLoading || isAuthenticated || dismissed || !hasWork || onCheckout) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage may be unavailable (private mode); the banner simply
      // reappears next visit, which is acceptable.
    }
  };

  return (
    <div
      data-testid="guest-work-banner"
      className="border-b border-[hsl(248_62%_52%/0.18)] bg-gradient-to-r from-[hsl(248_62%_52%/0.1)] to-[hsl(326_100%_59%/0.1)]"
    >
      <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[hsl(248_62%_52%/0.25)] bg-background/60 sm:mt-0">
            <ShieldCheck className="h-4 w-4 text-[hsl(248_62%_62%)]" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm leading-relaxed text-foreground">
            Your work is saved on this device. Sign in to keep it safe across devices, build your
            Match Readiness, and unlock matching.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button
            onClick={() => login()}
            className="h-9 rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] px-5 text-sm font-semibold text-white hover:opacity-90"
            data-testid="button-guest-banner-signin"
          >
            <LogIn className="mr-1.5 h-4 w-4" aria-hidden="true" /> Sign in
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            data-testid="button-guest-banner-dismiss"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
