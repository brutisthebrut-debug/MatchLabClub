import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles, ChevronDown, Map, Brain } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const TOOLS_PROFILE = [
  { name: "Dating Diagnosis",     href: "/diagnosis",     desc: "Profile category + what to fix first" },
  { name: "3-Min Signal Check",   href: "/signal-check",  desc: "Free for podcast listeners — instant score" },
  { name: "Profile Glow-Up",      href: "/glow-up",       desc: "10 rewrites for any style or platform" },
  { name: "Profile Reader",       href: "/profile-reader",desc: "Decode someone else's profile" },
  { name: "Message Coach",        href: "/coach",         desc: "Get coached replies for any conversation" },
  { name: "Message Lab",          href: "/lab",           desc: "Tone analysis + 4 styled reply options" },
  { name: "Next Message",         href: "/next-message",  desc: "7 copy-ready options for any situation" },
  { name: "Import Patterns",      href: "/insights",      desc: "Analyse communication style from history" },
  { name: "Style Map",            href: "/style-map",     desc: "9 communication dimensions mapped" },
];

const TOOLS_INSIGHT = [
  { name: "Dating Blueprint",      href: "/blueprint",           desc: "Your personalized dating action plan" },
  { name: "Mirror Profile",        href: "/mirror",              desc: "See yourself the way others might" },
  { name: "Dating Archetype",      href: "/archetype",           desc: "6-question quiz — shareable result" },
  { name: "Connection Style Lens", href: "/connection-style",    desc: "Your attachment pattern + risk loop" },
  { name: "Compatibility Compass", href: "/compatibility-compass",desc: "Dynamics that support vs. challenge you" },
  { name: "Post-Meeting Reflect",  href: "/reflection",          desc: "Pursue / pause / pass read" },
];

const TOOLS_PROGRESS = [
  { name: "My Timeline",          href: "/progress/timeline",        desc: "Dated notes — wins, patterns, questions" },
  { name: "Pattern Board",        href: "/progress/patterns",        desc: "Recurring themes from your entries" },
  { name: "Weekly Experiments",   href: "/progress/experiments",     desc: "Try it, track it, learn from it" },
  { name: "Follow-Up Check",      href: "/progress/followup",        desc: "Questions tied to your notes" },
  { name: "Progress Scorecard",   href: "/progress/scorecard",       desc: "7 growth dimensions with trend arrows" },
  { name: "Learning Feed",        href: "/progress/feed",            desc: "Observations based on what you log" },
  { name: "Control Center",       href: "/progress/control",         desc: "Your data, your toggles" },
  { name: "Insights Roadmap",     href: "/progress/insights-roadmap",desc: "What's being built — and your control over it" },
  { name: "Readiness Guide",      href: "/progress/readiness",       desc: "Goal-based readiness read" },
  { name: "Companion Workspace",  href: "/progress/companion",       desc: "Copy-ready guidance for common situations" },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
      if (progressRef.current && !progressRef.current.contains(e.target as Node)) {
        setProgressOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-white/5 bg-[hsl(232_38%_7%/0.92)] backdrop-blur-xl shadow-[0_8px_40px_rgb(0_0_0/0.4)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-home">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center shadow-[0_0_14px_hsl(268_52%_68%/0.4)] group-hover:shadow-[0_0_22px_hsl(268_52%_68%/0.6)] transition-shadow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif text-lg font-bold tracking-tight">
            <span className="gradient-text-violet">NLDC</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {/* Tools Dropdown */}
          <div className="relative" ref={toolsRef}>
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${toolsOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="button-tools-menu"
            >
              Tools <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
            {toolsOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[580px] glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(268_52%_68%/0.2)] animate-in fade-in-0 zoom-in-95">
                <div className="grid grid-cols-2 gap-x-2">
                  {/* Profile & Messages column */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Profile &amp; Messages</p>
                    {TOOLS_PROFILE.map(tool => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setToolsOpen(false)}
                        className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                        data-testid={`link-tool-${tool.name.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <span className="text-xs font-semibold text-foreground leading-tight">{tool.name}</span>
                        <span className="text-[11px] text-muted-foreground leading-tight">{tool.desc}</span>
                      </Link>
                    ))}
                  </div>
                  {/* Divider */}
                  <div className="border-l border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Self-Insight</p>
                    {TOOLS_INSIGHT.map(tool => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setToolsOpen(false)}
                        className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                        data-testid={`link-tool-${tool.name.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <span className="text-xs font-semibold text-foreground leading-tight">{tool.name}</span>
                        <span className="text-[11px] text-muted-foreground leading-tight">{tool.desc}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Dropdown */}
          <div className="relative" ref={progressRef}>
            <button
              onClick={() => setProgressOpen(!progressOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${progressOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Brain className="w-3.5 h-3.5 text-[hsl(190_55%_60%)]" /> Progress <ChevronDown className={`w-3.5 h-3.5 transition-transform ${progressOpen ? "rotate-180" : ""}`} />
            </button>
            {progressOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 glass-strong rounded-2xl p-3 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(190_55%_60%/0.2)] animate-in fade-in-0 zoom-in-95">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-2">Living AI Brain</p>
                {TOOLS_PROGRESS.map(tool => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setProgressOpen(false)}
                    className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground leading-tight">{tool.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{tool.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/roadmap"
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${location === "/roadmap" ? "text-[hsl(268_52%_78%)]" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="link-nav-roadmap"
          >
            <Map className="w-3.5 h-3.5" /> Vision
          </Link>

          <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/waitlist" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Podcast</Link>
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>

          <Button
            asChild
            className="rounded-full px-6 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse hover:opacity-90 transition-opacity"
            data-testid="button-nav-start"
          >
            <Link href="/start">Get My Dating Audit</Link>
          </Button>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[hsl(232_38%_7%/0.98)] backdrop-blur-xl p-5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 max-h-[80vh] overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Profile &amp; Messages</p>
          {TOOLS_PROFILE.map(tool => (
            <Link key={tool.href} href={tool.href} onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors">{tool.name}</Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Self-Insight</p>
          {TOOLS_INSIGHT.map(tool => (
            <Link key={tool.href} href={tool.href} onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors">{tool.name}</Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Living AI Brain</p>
          {TOOLS_PROGRESS.map(tool => (
            <Link key={tool.href} href={tool.href} onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors">{tool.name}</Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <Link href="/roadmap" className="text-base font-medium text-muted-foreground hover:text-foreground py-1.5 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
            <Map className="w-4 h-4" /> Platform Vision
          </Link>
          <Link href="/pricing" className="text-base font-medium text-muted-foreground hover:text-foreground py-1.5" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
          <Link href="/waitlist" className="text-base font-medium text-muted-foreground hover:text-foreground py-1.5" onClick={() => setMobileMenuOpen(false)}>Podcast</Link>
          <Link href="/dashboard" className="text-base font-medium text-muted-foreground hover:text-foreground py-1.5" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
          <Button
            asChild
            className="rounded-full w-full mt-3 bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Link href="/start">Get My Dating Audit</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
