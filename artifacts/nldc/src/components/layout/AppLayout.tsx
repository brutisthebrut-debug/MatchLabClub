import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu } from "lucide-react";

// Routes that keep the marketing top-nav even when signed in.
// Everything else is treated as an "app" route and gets the sidebar shell.
const MARKETING_PREFIXES = [
  "/pricing",
  "/waitlist",
  "/roadmap",
  "/blog",
  "/quizzes",
  "/quiz",
  "/gallery",
  "/sample-report",
  "/privacy",
  "/terms",
  "/partner",
  "/partners",
  "/checkout",
  "/feedback",
];

function isMarketingRoute(location: string): boolean {
  if (location === "/") return true;
  return MARKETING_PREFIXES.some(
    (p) => location === p || location.startsWith(p + "/"),
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const showSidebar = isAuthenticated && !isMarketingRoute(location);

  if (!showSidebar) {
    return (
      <div className="min-h-[100dvh] flex flex-col flex-1">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-1">
      <AppSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (sidebar is a drawer on small screens) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-foreground/8 bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            data-testid="button-open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/matchlab-logo.png" alt="MatchLab Club" className="h-8 w-auto" />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
