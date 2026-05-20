import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles, ChevronDown, TrendingUp, BookOpen, MessageSquare, Gift, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";

const YOUR_BLUEPRINT_PROFILE = [
  { name: "Dating Diagnosis",     href: "/diagnosis",      desc: "Your category + what to fix first" },
  { name: "3-Min Signal Check",   href: "/signal-check",   desc: "Instant score — great starting point" },
  { name: "Profile Glow-Up",      href: "/glow-up",        desc: "10 rewrites for any style or platform" },
  { name: "Before & After Gallery",href: "/gallery",        desc: "Sample rewrites across 8 real scenarios" },
  { name: "Mirror Profile",       href: "/mirror",         desc: "See yourself the way others might" },
  { name: "Profile Reader",       href: "/profile-reader", desc: "Decode someone else's profile" },
  { name: "Photo Scan",           href: "/scan",           desc: "Screenshot → instant mini-audit" },
];

const YOUR_BLUEPRINT_INSIGHT = [
  { name: "Dating Signal Type Quiz",href: "/quiz",                 desc: "8 questions → your dating archetype" },
  { name: "Dating Blueprint",       href: "/blueprint",            desc: "Your personalized dating action plan" },
  { name: "Dating Archetype",       href: "/archetype",            desc: "6-question quiz — shareable result" },
  { name: "Connection Style",       href: "/connection-style",     desc: "Your attachment pattern + risk loop" },
  { name: "Compatibility Compass",  href: "/compatibility-compass",desc: "Dynamics that support vs. challenge you" },
  { name: "Post-Meeting Reflect",   href: "/reflection",           desc: "Pursue / pause / pass read" },
];

const MESSAGE_TOOLS = [
  { name: "Message Coach",   href: "/coach",        desc: "Coached replies for any conversation" },
  { name: "Message Lab",     href: "/lab",          desc: "Tone analysis + 4 styled reply options" },
  { name: "Next Message",    href: "/next-message", desc: "7 copy-ready options for any situation" },
  { name: "Import Patterns", href: "/insights",     desc: "Analyse communication style from history" },
  { name: "Style Map",       href: "/style-map",    desc: "9 communication dimensions mapped" },
];

const GROWTH_TRACKER = [
  { name: "My Timeline",         href: "/progress/timeline",          desc: "Dated notes — wins, patterns, questions" },
  { name: "Pattern Board",       href: "/progress/patterns",          desc: "Recurring themes from your entries" },
  { name: "Weekly Experiments",  href: "/progress/experiments",       desc: "Try it, track it, learn from it" },
  { name: "Follow-Up Check",     href: "/progress/followup",          desc: "Questions tied to your notes" },
  { name: "Progress Scorecard",  href: "/progress/scorecard",         desc: "7 growth dimensions with trend arrows" },
  { name: "Learning Feed",       href: "/progress/feed",              desc: "Observations based on what you log" },
  { name: "Control Center",      href: "/progress/control",           desc: "Your data, your toggles" },
  { name: "Insights Roadmap",    href: "/progress/insights-roadmap",  desc: "What's being built — and your control" },
  { name: "Readiness Guide",     href: "/progress/readiness",         desc: "Goal-based readiness read" },
  { name: "Companion Workspace", href: "/progress/companion",         desc: "Copy-ready guidance for common situations" },
  { name: "What Changed?",       href: "/copilot/what-changed",       desc: "Quick check-in on what's shifted" },
];

const OFFERS = [
  { name: "Pricing",          href: "/pricing",        desc: "Free · $97 · $197 — see what's included" },
  { name: "Podcast Perks",    href: "/waitlist",       desc: "Listener discount + early access perks" },
  { name: "Platform Vision",  href: "/roadmap",        desc: "What's live, in dev, and on the roadmap" },
  { name: "Sample Report",    href: "/sample-report",  desc: "See a real Dating Reset Report" },
];

const SETTINGS_TRUST = [
  { name: "Wellness Center",    href: "/wellness",     desc: "8 dimensions of your readiness" },
  { name: "Connection Center",  href: "/connections",  desc: "Bring in context — on your terms" },
  { name: "Personal Data Vault",href: "/vault",        desc: "Preview, export, or delete your data" },
  { name: "Life Context",       href: "/life-context", desc: "Approved insights, one view" },
  { name: "User Control",       href: "/user-control", desc: "Approve, edit, export, delete" },
  { name: "Integrations",       href: "/integrations", desc: "Connected apps & privacy" },
  { name: "Privacy",            href: "/privacy",      desc: "How we handle data" },
  { name: "Beta Feedback",      href: "/feedback",     desc: "Help shape what gets built next" },
];

type DropdownId = "blueprint" | "messages" | "growth" | "offers" | null;

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

  const isActive = (hrefs: string[]) => hrefs.some(h => location === h || location.startsWith(h + "/"));

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-white/5 bg-[hsl(232_38%_7%/0.92)] backdrop-blur-xl shadow-[0_8px_40px_rgb(0_0_0/0.4)]"
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
        <nav className="hidden md:flex items-center gap-1">

          {/* Your Blueprint */}
          <button
            onClick={() => toggle("blueprint")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${activeMenu === "blueprint" || isActive(["/blueprint", "/diagnosis", "/signal-check", "/glow-up", "/mirror", "/profile-reader", "/archetype", "/connection-style", "/compatibility-compass", "/reflection"]) ? "text-[hsl(268_52%_78%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Your Blueprint
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === "blueprint" ? "rotate-180" : ""}`} />
          </button>
          {activeMenu === "blueprint" && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[580px] glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(268_52%_68%/0.2)] animate-in fade-in-0 zoom-in-95 z-50">
              <div className="grid grid-cols-2 gap-x-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Profile Tools</p>
                  {YOUR_BLUEPRINT_PROFILE.map(t => (
                    <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                    </Link>
                  ))}
                </div>
                <div className="border-l border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Self-Insight</p>
                  {YOUR_BLUEPRINT_INSIGHT.map(t => (
                    <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message Tools */}
          <button
            onClick={() => toggle("messages")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${activeMenu === "messages" || isActive(["/coach", "/lab", "/next-message", "/insights", "/style-map"]) ? "text-[hsl(190_55%_72%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message Tools
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === "messages" ? "rotate-180" : ""}`} />
          </button>
          {activeMenu === "messages" && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(190_55%_60%/0.2)] animate-in fade-in-0 zoom-in-95 z-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Message Tools</p>
              {MESSAGE_TOOLS.map(t => (
                <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                  <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Growth Tracker */}
          <button
            onClick={() => toggle("growth")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${activeMenu === "growth" || isActive(["/progress"]) ? "text-[hsl(142_55%_72%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Growth Tracker
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === "growth" ? "rotate-180" : ""}`} />
          </button>
          {activeMenu === "growth" && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(142_55%_60%/0.2)] animate-in fade-in-0 zoom-in-95 z-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Growth Tracker</p>
              {GROWTH_TRACKER.map(t => (
                <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                  <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Offers + Settings/Trust */}
          <button
            onClick={() => toggle("offers")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${activeMenu === "offers" || isActive(["/pricing", "/waitlist", "/integrations", "/roadmap", "/wellness", "/life-context", "/user-control", "/future-connections", "/privacy"]) ? "text-[hsl(43_65%_72%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}
          >
            <Gift className="w-3.5 h-3.5" />
            Offers
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === "offers" ? "rotate-180" : ""}`} />
          </button>
          {activeMenu === "offers" && (
            <div className="absolute top-16 right-4 w-[580px] glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(43_65%_65%/0.2)] animate-in fade-in-0 zoom-in-95 z-50">
              <div className="grid grid-cols-2 gap-x-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Offers</p>
                  {OFFERS.map(t => (
                    <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                    </Link>
                  ))}
                </div>
                <div className="border-l border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Settings &amp; Trust</p>
                  {SETTINGS_TRUST.map(t => (
                    <Link key={t.href} href={t.href} onClick={closeAll} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-xs font-semibold text-foreground leading-tight">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 leading-tight">{t.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="w-px h-5 bg-white/10 mx-1" />

          <Link href="/copilot" onClick={closeAll}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors ${location.startsWith("/copilot") ? "text-[hsl(268_52%_78%)] bg-[hsl(268_52%_68%/0.1)]" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}>
            <Sparkles className="w-3.5 h-3.5" />
            Copilot
          </Link>

          <Link href="/dashboard" onClick={closeAll}
            className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${location === "/dashboard" ? "text-[hsl(268_52%_78%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}>
            Dashboard
          </Link>

          {isLoading ? null : isAuthenticated ? (
            <Link
              href="/account"
              onClick={closeAll}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${location === "/account" ? "text-[hsl(268_52%_78%)] bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/4"}`}
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
        <div className="md:hidden border-t border-white/5 bg-[hsl(232_38%_7%/0.98)] backdrop-blur-xl animate-in slide-in-from-top-2 max-h-[85vh] overflow-y-auto">
          {/* Accordion sections */}
          {(
            [
              {
                id: "blueprint",
                label: "Your Blueprint",
                icon: <BookOpen className="w-3.5 h-3.5" />,
                color: "hsl(268 52% 78%)",
                subsections: [
                  { heading: "Profile Tools", links: YOUR_BLUEPRINT_PROFILE },
                  { heading: "Self-Insight",  links: YOUR_BLUEPRINT_INSIGHT },
                ],
              },
              {
                id: "messages",
                label: "Message Tools",
                icon: <MessageSquare className="w-3.5 h-3.5" />,
                color: "hsl(190 55% 72%)",
                subsections: [{ heading: null, links: MESSAGE_TOOLS }],
              },
              {
                id: "growth",
                label: "Growth Tracker",
                icon: <TrendingUp className="w-3.5 h-3.5" />,
                color: "hsl(142 55% 72%)",
                subsections: [{ heading: null, links: GROWTH_TRACKER }],
              },
              {
                id: "wingman",
                label: "Wingman Studio",
                icon: <Sparkles className="w-3.5 h-3.5" />,
                color: "hsl(268 52% 78%)",
                subsections: [
                  {
                    heading: null,
                    links: [
                      { name: "✦ AI Copilot",           href: "/copilot",               desc: "" },
                      { name: "Start My Reset",          href: "/copilot/reset",          desc: "" },
                      { name: "Help Me Reply",           href: "/copilot/reply",          desc: "" },
                      { name: "Improve My Profile",      href: "/copilot/profile",        desc: "" },
                      { name: "Debrief What Happened",   href: "/copilot/debrief",        desc: "" },
                      { name: "Weekly Growth Plan",      href: "/copilot/weekly-plan",    desc: "" },
                      { name: "Prepare for a Date",      href: "/copilot/prep",           desc: "" },
                      { name: "Flirt Coach",             href: "/copilot/flirt",          desc: "" },
                      { name: "What Changed?",           href: "/copilot/what-changed",   desc: "" },
                    ],
                  },
                ],
              },
              {
                id: "offers",
                label: "Offers & Vision",
                icon: <Gift className="w-3.5 h-3.5" />,
                color: "hsl(43 65% 72%)",
                subsections: [{ heading: null, links: OFFERS }],
              },
              {
                id: "settings",
                label: "Settings & Trust",
                icon: null,
                color: "hsl(268 52% 68%)",
                subsections: [{ heading: null, links: SETTINGS_TRUST }],
              },
            ] as Array<{
              id: string;
              label: string;
              icon: React.ReactNode | null;
              color: string;
              subsections: Array<{ heading: string | null; links: Array<{ name: string; href: string; desc: string }> }>;
            }>
          ).map(section => (
            <div key={section.id} className="border-b border-white/5 last:border-0">
              <button
                onClick={() => setMobileSection(prev => prev === section.id ? null : section.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium" style={{ color: mobileSection === section.id ? section.color : undefined }}>
                  {section.icon && <span style={{ color: section.color }}>{section.icon}</span>}
                  {section.label}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform text-muted-foreground/40"
                  style={{ transform: mobileSection === section.id ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {mobileSection === section.id && (
                <div className="pb-2 px-5 flex flex-col gap-0">
                  {section.subsections.map((sub, si) => (
                    <div key={si}>
                      {sub.heading && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 pt-2 pb-1">{sub.heading}</p>
                      )}
                      {sub.links.map(t => (
                        <Link
                          key={t.href}
                          href={t.href}
                          onClick={closeAll}
                          className="block text-sm text-muted-foreground hover:text-foreground py-2 transition-colors leading-tight"
                        >
                          {t.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Bottom: Dashboard + auth + CTA */}
          <div className="px-5 py-4 flex flex-col gap-1.5">
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
                <LogOut className="w-4 h-4" />Sign Out
                <span className="ml-auto text-[11px] text-muted-foreground/70 truncate max-w-[140px]">{user?.firstName || user?.email}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { closeAll(); login(); }}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground py-1.5 flex items-center gap-2"
                data-testid="button-login-mobile"
              >
                <LogIn className="w-4 h-4" />Sign In
              </button>
            )}
            <Button asChild className="rounded-full w-full mt-2 bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold" onClick={closeAll}>
              <Link href="/start">Start Here — Get My Free Audit</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
