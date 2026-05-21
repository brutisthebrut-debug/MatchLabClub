import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Menu, X, Sparkles, ChevronDown, TrendingUp, BookOpen,
  MessageSquare, Shield, LogIn, LogOut, User as UserIcon, ArrowRight, Tag,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";

// ── Package tool lists (all original routes preserved) ──────────────────────

const RESET_TOOLS = [
  { name: "Signal Check",         href: "/signal-check",          desc: "3-min quick read — instant profile score" },
  { name: "Dating Blueprint",     href: "/blueprint",             desc: "Your personalized dating action plan" },
  { name: "Profile Glow-Up",      href: "/glow-up",               desc: "10 bio rewrites for any platform" },
  { name: "Mirror Profile",       href: "/mirror",                desc: "See yourself the way others do" },
  { name: "Dating Signal Quiz",   href: "/quiz",                  desc: "8 questions → your dating archetype" },
];

const RESET_MORE = [
  { name: "Dating Diagnosis",       href: "/diagnosis" },
  { name: "Before & After Gallery", href: "/gallery" },
  { name: "Profile Reader",         href: "/profile-reader" },
  { name: "Photo Scan",             href: "/scan" },
  { name: "Dating Archetype",       href: "/archetype" },
  { name: "Connection Style",       href: "/connection-style" },
  { name: "Compatibility Compass",  href: "/compatibility-compass" },
  { name: "Post-Date Reflect",      href: "/reflection" },
];

const MESSAGES_TOOLS = [
  { name: "Message Coach",    href: "/coach",         desc: "Coached replies for any conversation" },
  { name: "Next Message",     href: "/next-message",  desc: "7 copy-ready options for any situation" },
  { name: "Flirt Coach",      href: "/copilot/flirt", desc: "Draft messages for any moment" },
  { name: "Style Map",        href: "/style-map",     desc: "9 dimensions of your communication style" },
  { name: "Import Patterns",  href: "/insights",      desc: "Analyse style from your message history" },
];

const MESSAGES_MORE = [
  { name: "Message Lab",        href: "/lab" },
  { name: "Help Me Reply",      href: "/copilot/reply" },
  { name: "Improve My Profile", href: "/copilot/profile" },
  { name: "Wingman Copilot",    href: "/copilot" },
];

const GROWTH_TOOLS = [
  { name: "Dating Wins Log",    href: "/progress/wins",            desc: "Log moments of courage and progress" },
  { name: "Pattern Breaker",    href: "/progress/pattern-breaker", desc: "5 actions to shift this week" },
  { name: "Weekly Growth Plan", href: "/copilot/weekly-plan",      desc: "A structured plan for the next 7 days" },
  { name: "Progress Scorecard", href: "/progress/scorecard",       desc: "7 growth dimensions with trend arrows" },
  { name: "Post-Date Reflect",  href: "/reflection",               desc: "Pursue / pause / pass read" },
];

const GROWTH_MORE = [
  { name: "My Timeline",          href: "/progress/timeline" },
  { name: "Pattern Board",        href: "/progress/patterns" },
  { name: "Weekly Experiments",   href: "/progress/experiments" },
  { name: "Follow-Up Check",      href: "/progress/followup" },
  { name: "Readiness Guide",      href: "/progress/readiness" },
  { name: "Companion Workspace",  href: "/progress/companion" },
  { name: "What Changed?",        href: "/copilot/what-changed" },
  { name: "Debrief",              href: "/copilot/debrief" },
];

const TRUST_TOOLS = [
  { name: "Wellness Center",    href: "/wellness",      desc: "8 dimensions of your readiness" },
  { name: "Data Vault",         href: "/vault",         desc: "Preview, export, or delete your data" },
  { name: "Connection Center",  href: "/connections",   desc: "Bring in context — on your terms" },
  { name: "User Control",       href: "/user-control",  desc: "Approve, edit, export, or delete" },
  { name: "Privacy Policy",     href: "/privacy",       desc: "How we handle your data" },
];

const TRUST_MORE = [
  { name: "Life Context",    href: "/life-context" },
  { name: "Integrations",    href: "/integrations" },
  { name: "Beta Feedback",   href: "/feedback" },
];

// ── Packages config ────────────────────────────────────────────────────────

const PACKAGES = [
  {
    id: "reset" as const,
    label: "The Dating Reset",
    tagline: "Rebuild your dating signal from the ground up",
    color: "hsl(268 52% 68%)",
    icon: BookOpen,
    tools: RESET_TOOLS,
    more: RESET_MORE,
    hubHref: "/diagnosis",
    hubLabel: "View all Reset tools",
    activeHrefs: [
      "/blueprint", "/signal-check", "/diagnosis", "/glow-up", "/mirror",
      "/profile-reader", "/archetype", "/connection-style", "/compatibility-compass",
      "/reflection", "/quiz", "/gallery", "/scan",
    ],
  },
  {
    id: "messages" as const,
    label: "Message Lab",
    tagline: "Write better messages, connect faster",
    color: "hsl(190 55% 60%)",
    icon: MessageSquare,
    tools: MESSAGES_TOOLS,
    more: MESSAGES_MORE,
    hubHref: "/lab",
    hubLabel: "View all Message Lab tools",
    activeHrefs: ["/coach", "/lab", "/next-message", "/insights", "/style-map", "/copilot"],
  },
  {
    id: "growth" as const,
    label: "Growth Tracker",
    tagline: "Track what's actually changing over time",
    color: "hsl(142 55% 60%)",
    icon: TrendingUp,
    tools: GROWTH_TOOLS,
    more: GROWTH_MORE,
    hubHref: "/progress/timeline",
    hubLabel: "View all Growth tools",
    activeHrefs: ["/progress", "/copilot/weekly-plan", "/copilot/what-changed", "/copilot/debrief"],
  },
  {
    id: "context" as const,
    label: "Context + Trust",
    tagline: "What we know about you — and what you control",
    color: "hsl(228 30% 62%)",
    icon: Shield,
    tools: TRUST_TOOLS,
    more: TRUST_MORE,
    hubHref: "/wellness",
    hubLabel: "View all Context + Trust",
    activeHrefs: [
      "/wellness", "/vault", "/connections", "/life-context",
      "/user-control", "/integrations", "/privacy", "/feedback",
    ],
  },
] as const;

type DropdownId = "reset" | "messages" | "growth" | "context" | null;

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<DropdownId>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (id: DropdownId) => setActiveMenu(prev => prev === id ? null : id);
  const closeAll = () => { setActiveMenu(null); setMobileOpen(false); };

  const isActive = (hrefs: readonly string[]) =>
    hrefs.some(h => location === h || location.startsWith(h + "/"));

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-foreground/8 bg-background/95 backdrop-blur-xl shadow-[0_2px_16px_rgb(0_0_0/0.07)]"
          : "border-b border-transparent bg-transparent"
      }`}
      ref={navRef}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0" onClick={closeAll}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center shadow-[0_0_14px_hsl(268_52%_68%/0.4)] group-hover:shadow-[0_0_22px_hsl(268_52%_68%/0.6)] transition-shadow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif text-lg font-bold tracking-tight">
            <span className="gradient-text-violet">NLDC</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5 [&_button]:whitespace-nowrap [&_a]:whitespace-nowrap">

          {PACKAGES.map(pkg => {
            const active = activeMenu === pkg.id || isActive(pkg.activeHrefs);
            return (
              <div key={pkg.id} className="relative">
                <button
                  onClick={() => toggle(pkg.id)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? "bg-white/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/4"
                  }`}
                  style={active ? { color: pkg.color } : undefined}
                >
                  <pkg.icon className="w-3.5 h-3.5" />
                  {pkg.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === pkg.id ? "rotate-180" : ""}`} />
                </button>

                {activeMenu === pkg.id && (
                  <div
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-80 glass-strong rounded-2xl shadow-[0_20px_60px_rgb(0_0_0/0.55)] animate-in fade-in-0 zoom-in-95 z-50 overflow-hidden"
                    style={{ border: `1px solid ${pkg.color.replace(")", " / 0.2)")}` }}
                  >
                    {/* Package header */}
                    <div
                      className="px-4 py-3 border-b border-white/6"
                      style={{ background: pkg.color.replace(")", " / 0.07)") }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: pkg.color.replace(")", " / 0.18)") }}
                        >
                          <pkg.icon className="w-3.5 h-3.5" style={{ color: pkg.color }} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{pkg.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 leading-snug pl-8">{pkg.tagline}</p>
                    </div>

                    {/* Featured tools */}
                    <div className="p-2">
                      {pkg.tools.map(t => (
                        <Link
                          key={t.href}
                          href={t.href}
                          onClick={closeAll}
                          className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
                        >
                          <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                        </Link>
                      ))}
                    </div>

                    {/* Footer — View all */}
                    <div className="px-4 py-2.5 border-t border-white/6">
                      <Link
                        href={pkg.hubHref}
                        onClick={closeAll}
                        className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                        style={{ color: pkg.color }}
                      >
                        {pkg.hubLabel} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Plans — plain link */}
          <Link
            href="/pricing"
            onClick={closeAll}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              location === "/pricing" || location === "/waitlist"
                ? "text-[hsl(43_65%_72%)] bg-white/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/4"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Plans
          </Link>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <Link
            href="/dashboard"
            onClick={closeAll}
            className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
              location === "/dashboard"
                ? "text-[hsl(268_52%_78%)] bg-white/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/4"
            }`}
          >
            Dashboard
          </Link>

          {isLoading ? null : isAuthenticated ? (
            <Link
              href="/account"
              onClick={closeAll}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                location === "/account"
                  ? "text-[hsl(268_52%_78%)] bg-white/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/4"
              }`}
              data-testid="link-account"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{user?.firstName || user?.email || "Account"}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { closeAll(); login(); }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-white/4"
              data-testid="button-login"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}

          <Button
            asChild
            className="ml-2 rounded-full px-5 h-9 text-sm font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse hover:opacity-90 transition-opacity"
          >
            <Link href="/start" onClick={closeAll}>Start Here →</Link>
          </Button>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-foreground/8 bg-background/98 backdrop-blur-xl animate-in slide-in-from-top-2 max-h-[85vh] overflow-y-auto">

          {PACKAGES.map(pkg => (
            <div key={pkg.id} className="border-b border-foreground/8">
              <button
                onClick={() => setMobileSection(prev => prev === pkg.id ? null : pkg.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-foreground/5 transition-colors"
              >
                <span
                  className="flex items-center gap-2.5 text-sm font-medium"
                  style={{ color: mobileSection === pkg.id ? pkg.color : undefined }}
                >
                  <span style={{ color: pkg.color }}><pkg.icon className="w-3.5 h-3.5" /></span>
                  {pkg.label}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform text-muted-foreground/40"
                  style={{ transform: mobileSection === pkg.id ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {mobileSection === pkg.id && (
                <div className="pb-3 px-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 pt-1 pb-2">Featured</p>
                  {pkg.tools.map(t => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={closeAll}
                      className="block text-sm text-muted-foreground hover:text-foreground py-2 transition-colors leading-tight"
                    >
                      {t.name}
                    </Link>
                  ))}
                  {pkg.more.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 pt-3 pb-2">More</p>
                      {pkg.more.map(t => (
                        <Link
                          key={t.href}
                          href={t.href}
                          onClick={closeAll}
                          className="block text-sm text-muted-foreground/70 hover:text-foreground py-1.5 transition-colors leading-tight"
                        >
                          {t.name}
                        </Link>
                      ))}
                    </>
                  )}
                  <Link
                    href={pkg.hubHref}
                    onClick={closeAll}
                    className="flex items-center gap-1 text-xs font-medium mt-3 pt-2 border-t border-white/6 transition-colors"
                    style={{ color: pkg.color }}
                  >
                    {pkg.hubLabel} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          ))}

          {/* Bottom: Plans, Dashboard, auth, CTA */}
          <div className="px-5 py-4 flex flex-col gap-1.5">
            <Link href="/pricing" onClick={closeAll}
              className="text-sm font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors">
              Plans &amp; Pricing
            </Link>
            <Link href="/dashboard" onClick={closeAll}
              className="text-sm font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors">
              Dashboard
            </Link>
            {isLoading ? null : isAuthenticated ? (
              <button
                type="button"
                onClick={() => { closeAll(); logout(); }}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground py-1.5 flex items-center gap-2"
                data-testid="button-logout-mobile"
              >
                <LogOut className="w-4 h-4" /> Sign Out
                <span className="ml-auto text-[11px] text-muted-foreground/70 truncate max-w-[140px]">
                  {user?.firstName || user?.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { closeAll(); login(); }}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground py-1.5 flex items-center gap-2"
                data-testid="button-login-mobile"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </button>
            )}
            <Button
              asChild
              className="mt-2 w-full rounded-full h-10 text-sm font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0"
            >
              <Link href="/start" onClick={closeAll}>Start Here →</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
