import { Link, useLocation } from "wouter";
import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  Wand2,
  Sparkles,
  MessageCircle,
  FlaskConical,
  ScanSearch,
  PenLine,
  ImageUp,
  Activity,
  Stethoscope,
  Compass,
  Grid3x3,
  HeartHandshake,
  Drama,
  Bot,
  RotateCcw,
  Reply,
  UserPen,
  ClipboardList,
  CalendarCheck,
  Flame,
  Gauge,
  LineChart,
  Layers,
  Beaker,
  ListChecks,
  MessagesSquare,
  Map as MapIcon,
  Rss,
  SlidersHorizontal,
  Trophy,
  Unplug,
  Plug,
  Download,
  Heart,
  Briefcase,
  Lightbulb,
  Network,
  Users,
  ShieldCheck,
  Database,
  Aperture,
  BookOpen,
  CalendarHeart,
  Eye,
  FileText,
  ScrollText,
  Settings,
  History,
  Trash2,
  LogOut,
  ArrowRight,
  ChevronDown,
  X,
  Tag,
  Newspaper,
  Images,
  Ticket,
  Send,
  Lock,
} from "lucide-react";

type NavLink = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

type NavSection = {
  id: string;
  label: string;
  links: NavLink[];
};

const OVERVIEW: NavLink[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Self Hub", href: "/me", icon: Brain },
];

const SECTIONS: NavSection[] = [
  {
    id: "tools",
    label: "Tools",
    links: [
      { name: "Message Coach", href: "/coach", icon: MessageCircle },
      { name: "Chemistry Lab", href: "/lab", icon: FlaskConical },
      { name: "Profile Reader", href: "/profile-reader", icon: ScanSearch },
      { name: "Next Message", href: "/next-message", icon: PenLine },
      { name: "Glow-Up Bio", href: "/glow-up", icon: Sparkles },
      { name: "Photo Scan", href: "/scan", icon: ImageUp },
      { name: "Signal Check", href: "/signal-check", icon: Activity },
      { name: "Diagnosis", href: "/diagnosis", icon: Stethoscope },
      { name: "Compatibility Compass", href: "/compatibility-compass", icon: Compass },
      { name: "Style Map", href: "/style-map", icon: Grid3x3 },
      { name: "Connection Style", href: "/connection-style", icon: HeartHandshake },
      { name: "Archetype", href: "/archetype", icon: Drama },
    ],
  },
  {
    id: "wingman",
    label: "Wingman",
    links: [
      { name: "Wingman Studio", href: "/copilot", icon: Bot },
      { name: "Start My Reset", href: "/copilot/reset", icon: RotateCcw },
      { name: "Help Me Reply", href: "/copilot/reply", icon: Reply },
      { name: "Improve My Profile", href: "/copilot/profile", icon: UserPen },
      { name: "Debrief", href: "/copilot/debrief", icon: ClipboardList },
      { name: "Weekly Plan", href: "/copilot/weekly-plan", icon: CalendarCheck },
      { name: "Prepare For A Date", href: "/copilot/prep", icon: HeartHandshake },
      { name: "Flirt Coach", href: "/copilot/flirt", icon: Flame },
      { name: "What Changed", href: "/copilot/what-changed", icon: LineChart },
    ],
  },
  {
    id: "progress",
    label: "Progress",
    links: [
      { name: "Timeline", href: "/progress/timeline", icon: History },
      { name: "Patterns", href: "/progress/patterns", icon: Layers },
      { name: "Scorecard", href: "/progress/scorecard", icon: Gauge },
      { name: "Readiness", href: "/progress/readiness", icon: Gauge },
      { name: "Experiments", href: "/progress/experiments", icon: Beaker },
      { name: "Follow-Up", href: "/progress/followup", icon: ListChecks },
      { name: "Companion", href: "/progress/companion", icon: MessagesSquare },
      { name: "Insights Roadmap", href: "/progress/insights-roadmap", icon: MapIcon },
      { name: "Activity Feed", href: "/progress/feed", icon: Rss },
      { name: "Control Center", href: "/progress/control", icon: SlidersHorizontal },
      { name: "Wins Log", href: "/progress/wins", icon: Trophy },
      { name: "Pattern Breaker", href: "/progress/pattern-breaker", icon: Unplug },
    ],
  },
  {
    id: "reflection",
    label: "Mirror & Reflection",
    links: [
      { name: "Mirror Profile", href: "/mirror", icon: Aperture },
      { name: "Your Mirror", href: "/your-mirror", icon: Eye },
      { name: "Journal", href: "/mirror/journal", icon: BookOpen },
      { name: "Post-Date Notes", href: "/mirror/dates", icon: CalendarHeart },
      { name: "Reflection", href: "/reflection", icon: Heart },
      { name: "Blueprint", href: "/blueprint", icon: FileText },
    ],
  },
  {
    id: "connections",
    label: "Connections & Data",
    links: [
      { name: "Connection Center", href: "/connections", icon: Plug },
      { name: "Imports", href: "/imports", icon: Download },
      { name: "Wellness Center", href: "/wellness", icon: Heart },
      { name: "Life Context", href: "/life-context", icon: Briefcase },
      { name: "Communication Insights", href: "/insights", icon: Lightbulb },
      { name: "Integrations Roadmap", href: "/integrations", icon: Network },
      { name: "Future Connections", href: "/future-connections", icon: Users },
      { name: "Matching", href: "/matching", icon: HeartHandshake, badge: "Beta" },
      { name: "Data Vault", href: "/vault", icon: Database },
      { name: "Privacy & Control", href: "/user-control", icon: ShieldCheck },
    ],
  },
  {
    id: "account",
    label: "Account",
    links: [
      { name: "Account & Billing", href: "/account", icon: Settings },
      { name: "Sessions", href: "/account/sessions", icon: ScrollText },
      { name: "Trash", href: "/trash", icon: Trash2 },
    ],
  },
  {
    id: "more",
    label: "More",
    links: [
      { name: "Pricing", href: "/pricing", icon: Tag },
      { name: "Journal", href: "/blog", icon: Newspaper },
      { name: "Roadmap", href: "/roadmap", icon: MapIcon },
      { name: "Before & After", href: "/gallery", icon: Images },
      { name: "Early Access", href: "/waitlist", icon: Ticket },
      { name: "Feedback", href: "/feedback", icon: Send },
      { name: "Privacy", href: "/privacy", icon: Lock },
      { name: "Terms", href: "/terms", icon: FileText },
    ],
  },
];

function isActiveHref(location: string, href: string) {
  return location === href || location.startsWith(href + "/");
}

function sectionForLocation(location: string): string | null {
  for (const section of SECTIONS) {
    if (section.links.some((l) => isActiveHref(location, l.href))) return section.id;
  }
  return null;
}

function NavRow({
  link,
  active,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[hsl(248_62%_52%/0.1)] text-[hsl(248_62%_52%)]"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
      data-testid={`sidebar-link-${link.href.replace(/\//g, "-").replace(/^-/, "")}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{link.name}</span>
      {link.badge && (
        <span className="ml-auto rounded-full bg-[hsl(326_100%_60%/0.12)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
          {link.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const activeSection = sectionForLocation(location);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeSection) setOpen((prev) => ({ ...prev, [activeSection]: true }));
  }, [activeSection]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 group">
          <img
            src="/matchlab-logo.png"
            alt="MatchLab Club"
            className="h-9 w-auto transition-transform group-hover:scale-[1.04]"
            style={{ filter: "drop-shadow(0 2px 10px hsl(326 100% 60% / 0.4))" }}
          />
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-base font-bold tracking-tight text-foreground">
              MatchLab<span className="gradient-text">.</span>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Club
            </span>
          </div>
        </Link>
      </div>

      {/* New audit CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/start"
          onClick={onNavigate}
          className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          data-testid="sidebar-new-audit"
        >
          New Audit <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {OVERVIEW.map((link) => (
            <NavRow
              key={link.href}
              link={link}
              active={isActiveHref(location, link.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {SECTIONS.map((section) => {
          const isOpen = open[section.id] ?? false;
          return (
            <div key={section.id} className="pt-2">
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground/50 transition-colors hover:text-foreground/80"
                data-testid={`sidebar-section-${section.id}`}
              >
                {section.label}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {section.links.map((link) => (
                    <NavRow
                      key={link.href}
                      link={link}
                      active={isActiveHref(location, link.href)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: theme + account + sign out */}
      <div className="border-t border-foreground/8 px-3 py-3">
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            data-testid="sidebar-account"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-xs font-bold text-white">
              {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </span>
            <span className="truncate font-medium">{user?.firstName || user?.email || "Account"}</span>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Sign out"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            data-testid="sidebar-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}): ReactNode {
  // Esc to close + lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-foreground/8 md:bg-background/60 md:backdrop-blur-xl">
        <div className="sticky top-0 h-[100dvh]">
          <SidebarBody onNavigate={() => {}} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-foreground/8 bg-background shadow-2xl animate-in slide-in-from-left"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
