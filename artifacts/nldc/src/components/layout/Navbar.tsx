import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, LogOut, User as UserIcon, ArrowRight, Compass } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { ThemeToggle } from "@/components/ThemeToggle";

const PRIMARY_LINKS = [
  { name: "Try Free",  href: "/quizzes" },
  { name: "Pricing",    href: "/pricing" },
  { name: "Journal",    href: "/blog" },
] as const;

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeAll = () => setMobileOpen(false);
  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-foreground/8 bg-background/95 backdrop-blur-xl shadow-[0_2px_16px_rgb(0_0_0/0.07)]"
          : "border-b border-transparent bg-transparent"
      }`}
      ref={navRef}
    >
      <div className="container mx-auto px-4 md:px-6 h-20 md:h-24 flex items-center justify-between">

        {/* Logo — featured, bigger, with wordmark */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group" onClick={closeAll}>
          <img
            src="/matchlab-logo.png"
            alt="MatchLab Club"
            className="h-12 md:h-14 w-auto transition-transform group-hover:scale-[1.04]"
            style={{ filter: "drop-shadow(0 2px 14px hsl(326 100% 60% / 0.45)) drop-shadow(0 0 18px hsl(248 75% 60% / 0.35))" }}
          />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-serif font-bold text-lg md:text-xl text-foreground tracking-tight">
              MatchLab<span className="gradient-text">.</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Club</span>
          </div>
        </Link>

        {/* Desktop Nav — minimal: 3 marketing links + Dashboard (if authed) + Account/Sign-in + CTA */}
        <nav className="hidden md:flex items-center gap-1">
          {PRIMARY_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={closeAll}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                isActive(l.href)
                  ? "text-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {l.name}
            </Link>
          ))}

          {isAuthenticated && (
            <Link
              href="/dashboard"
              onClick={closeAll}
              aria-current={isActive("/dashboard") ? "page" : undefined}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                isActive("/dashboard")
                  ? "text-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
              data-testid="link-dashboard"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              Dashboard
            </Link>
          )}

          <div className="w-px h-5 bg-foreground/10 mx-2" />

          <ThemeToggle className="mr-1" />

          {isLoading ? null : isAuthenticated ? (
            <Link
              href="/account"
              onClick={closeAll}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              data-testid="link-account"
            >
              <UserIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="max-w-[120px] truncate">{user?.firstName || user?.email || "Account"}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { closeAll(); login(); }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              data-testid="button-login"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" /> Sign In
            </button>
          )}

          <Button
            asChild
            className="ml-1 rounded-full px-5 h-9 text-sm font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse hover:opacity-90 transition-opacity text-white"
          >
            <Link href="/start" onClick={closeAll}>Get My Audit <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </nav>

        {/* Mobile Right Cluster */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle />
          <button
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-foreground/8 bg-background/98 backdrop-blur-xl animate-in slide-in-from-top-2">
          <div className="px-5 py-4 flex flex-col gap-1">
            {PRIMARY_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeAll}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`text-base font-medium py-2.5 transition-colors ${
                  isActive(l.href)
                    ? "text-[hsl(248_62%_52%)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.name}
              </Link>
            ))}

            {isAuthenticated && (
              <Link
                href="/dashboard"
                onClick={closeAll}
                aria-current={isActive("/dashboard") ? "page" : undefined}
                className={`flex items-center gap-2 text-base font-medium py-2.5 transition-colors ${
                  isActive("/dashboard")
                    ? "text-[hsl(248_62%_52%)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="link-dashboard-mobile"
              >
                <Compass className="w-4 h-4" aria-hidden="true" /> Dashboard
              </Link>
            )}

            <div className="h-px bg-foreground/8 my-2" />

            {isLoading ? null : isAuthenticated ? (
              <button
                type="button"
                onClick={() => { closeAll(); logout(); }}
                className="text-left text-base font-medium text-muted-foreground hover:text-foreground py-2.5 flex items-center gap-2"
                data-testid="button-logout-mobile"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" /> Sign Out
                <span className="ml-auto text-xs text-muted-foreground/70 truncate max-w-[140px]">
                  {user?.firstName || user?.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { closeAll(); login(); }}
                className="text-left text-base font-medium text-muted-foreground hover:text-foreground py-2.5 flex items-center gap-2"
                data-testid="button-login-mobile"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" /> Sign In
              </button>
            )}

            <Button
              asChild
              className="mt-3 w-full rounded-full h-11 text-sm font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white"
            >
              <Link href="/start" onClick={closeAll}>Get My Audit <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
