import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles, ChevronDown, Map } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const TOOLS = [
  { name: "Dating Diagnosis", href: "/diagnosis", desc: "Profile category + what to fix first" },
  { name: "Message Lab", href: "/lab", desc: "Tone analysis + 4 styled reply options" },
  { name: "3-Min Signal Check", href: "/signal-check", desc: "Free for podcast listeners — instant score" },
  { name: "Message Coach", href: "/coach", desc: "Get coached replies for any conversation" },
  { name: "Import Patterns", href: "/insights", desc: "Analyse communication style from history" },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

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
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 glass-strong rounded-2xl p-2 shadow-[0_20px_60px_rgb(0_0_0/0.5)] border border-[hsl(268_52%_68%/0.2)] animate-in fade-in-0 zoom-in-95">
                {TOOLS.map(tool => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setToolsOpen(false)}
                    className="flex flex-col gap-0.5 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                    data-testid={`link-tool-${tool.name.toLowerCase().replace(/ /g, "-")}`}
                  >
                    <span className="text-sm font-semibold text-foreground">{tool.name}</span>
                    <span className="text-xs text-muted-foreground">{tool.desc}</span>
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
        <div className="md:hidden border-t border-white/5 bg-[hsl(232_38%_7%/0.98)] backdrop-blur-xl p-5 flex flex-col gap-2 animate-in slide-in-from-top-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Tools</p>
          {TOOLS.map(tool => (
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
