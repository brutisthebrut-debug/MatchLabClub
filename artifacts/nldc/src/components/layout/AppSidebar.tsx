import { Link, useLocation } from "wouter";
import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { computeClimb } from "@/lib/climb";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Eye,
  Sparkles,
  ClipboardList,
  MessageCircle,
  Gauge,
  BookOpen,
  Shuffle,
  ListChecks,
  Plug,
  HeartHandshake,
  ShieldAlert,
  Target,
  ImageUp,
  Users,
  ShieldCheck,
  FileText,
  Compass,
  Images,
  RotateCcw,
  Flame,
  Reply,
  UserPen,
  Beaker,
  MessagesSquare,
  Unplug,
  Flag,
  Share2,
  Tag,
  Newspaper,
  Ticket,
  Send,
  Map as MapIcon,
  Clapperboard,
  Settings,
  ScrollText,
  Trash2,
  Lock,
  Trophy,
  ArrowRight,
  ChevronDown,
  X,
  LogOut,
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
  // Primary links are shown whenever the section is open. Everything in `more`
  // sits behind a "Show all" disclosure so the rail reads as a focused spine
  // while keeping every route one click away. No page is ever orphaned.
  primary: NavLink[];
  more: NavLink[];
};

// The approved v1 shell has exactly five primary destinations. Existing tools
// stay reachable through the secondary disclosures and in-page hub tabs, but
// they do not compete with the member's main journey in the rail.
const OVERVIEW: NavLink[] = [
  { name: "Today", href: "/today", icon: Sparkles },
  { name: "Matches", href: "/matches", icon: HeartHandshake },
  { name: "My MatchLab", href: "/me", icon: Eye },
  { name: "Journey", href: "/journey", icon: BookOpen },
  { name: "Play", href: "/quiz", icon: Shuffle },
];

const SECTIONS: NavSection[] = [
  {
    id: "more-matchlab",
    label: "More MatchLab",
    primary: [
      { name: "Echo", href: "/echo", icon: Sparkles },
      {
        name: "Matching settings",
        href: "/matching",
        icon: HeartHandshake,
        badge: "Pilot",
      },
      { name: "Connection Center", href: "/connections", icon: Plug },
    ],
    more: [
      { name: "Signal Audit", href: "/start", icon: ClipboardList },
      { name: "Audit history", href: "/dashboard", icon: LayoutDashboard },
      { name: "Message Studio", href: "/coach", icon: MessageCircle },
      { name: "Readiness", href: "/progress/readiness", icon: Gauge },
      { name: "Journal", href: "/mirror/journal", icon: BookOpen },
      { name: "Date Safety", href: "/date-safety", icon: ShieldAlert },
      { name: "What it takes", href: "/match-path", icon: Target },
      { name: "Match photos", href: "/photos", icon: ImageUp },
      { name: "Future Connections", href: "/future-connections", icon: Users },
      { name: "Get Verified", href: "/verification", icon: ShieldCheck },
      { name: "Blueprint", href: "/blueprint", icon: FileText },
      { name: "Glow-Up Bio", href: "/glow-up", icon: Sparkles },
      {
        name: "Compatibility Compass",
        href: "/compatibility-compass",
        icon: Compass,
      },
      { name: "Before & After", href: "/gallery", icon: Images },
      { name: "Photo Lab", href: "/photo-lab", icon: Images },
      { name: "Start My Reset", href: "/copilot/reset", icon: RotateCcw },
      { name: "Flirt Coach", href: "/copilot/flirt", icon: Flame },
      { name: "Help Me Reply", href: "/copilot/reply", icon: Reply },
      { name: "Improve My Profile", href: "/copilot/profile", icon: UserPen },
      {
        name: "Prepare For A Date",
        href: "/copilot/prep",
        icon: HeartHandshake,
      },
      { name: "Experiments", href: "/progress/experiments", icon: Beaker },
      { name: "Follow-Up", href: "/progress/followup", icon: ListChecks },
      { name: "Companion", href: "/progress/companion", icon: MessagesSquare },
      {
        name: "Pattern Breaker",
        href: "/progress/pattern-breaker",
        icon: Unplug,
      },
      { name: "Green and red flags", href: "/flags", icon: Flag },
      { name: "Share Card", href: "/share-card", icon: Share2 },
    ],
  },
  {
    id: "founder",
    label: "About & Beta",
    primary: [
      { name: "Feedback", href: "/feedback", icon: Send },
      { name: "Roadmap", href: "/roadmap", icon: MapIcon },
    ],
    more: [
      { name: "Pricing", href: "/pricing", icon: Tag },
      { name: "Sample Read", href: "/sample-report", icon: FileText },
      { name: "Blog", href: "/blog", icon: Newspaper },
      { name: "Early Access", href: "/waitlist", icon: Ticket },
      { name: "Demo Journey", href: "/copilot/demo", icon: Clapperboard },
    ],
  },
  {
    id: "account",
    label: "Account",
    primary: [
      { name: "Account & Billing", href: "/account", icon: Settings },
      { name: "Sessions", href: "/account/sessions", icon: ScrollText },
      { name: "Trash", href: "/trash", icon: Trash2 },
    ],
    more: [
      { name: "Privacy", href: "/privacy", icon: Lock },
      { name: "Terms", href: "/terms", icon: FileText },
    ],
  },
];

function isActiveHref(location: string, href: string) {
  return location === href || location.startsWith(href + "/");
}

// Among every link in the rail, the one whose href is the longest match for the
// current location wins. This keeps prefix-nested routes (e.g. /mirror vs
// /mirror/dates, or /copilot vs /copilot/weekly-plan) that now live in different
// sections from each lighting up at once: only the single most specific
// destination reads as active, and its section is the one that auto-opens.
function bestMatchHref(location: string): string | null {
  let best: string | null = null;
  const consider = (href: string) => {
    if (
      isActiveHref(location, href) &&
      (best === null || href.length > best.length)
    ) {
      best = href;
    }
  };
  for (const link of OVERVIEW) consider(link.href);
  for (const section of SECTIONS) {
    for (const link of section.primary) consider(link.href);
    for (const link of section.more) consider(link.href);
  }
  return best;
}

function sectionForLocation(location: string): string | null {
  const best = bestMatchHref(location);
  if (best === null) return null;
  for (const section of SECTIONS) {
    const all = [...section.primary, ...section.more];
    if (all.some((l) => l.href === best)) return section.id;
  }
  return null;
}

function moreHasActive(location: string, section: NavSection) {
  const best = bestMatchHref(location);
  return best !== null && section.more.some((l) => l.href === best);
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

function NextBestAction({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data } = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const action = data?.nextActions?.[0];
  if (!action) return null;

  return (
    <Link
      href={action.href}
      onClick={onNavigate}
      className="block rounded-xl border border-[hsl(248_62%_52%/0.2)] bg-[hsl(248_62%_52%/0.06)] px-3 py-2.5 transition-colors hover:bg-[hsl(248_62%_52%/0.1)]"
      data-testid="sidebar-next-best-action"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[hsl(248_62%_52%)]">
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        Do this next
      </span>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {action.label}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {action.detail}
      </p>
    </Link>
  );
}

function ClimbSummary({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data } = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  if (!data) return null;

  const climb = computeClimb(
    data.readiness?.score ?? 0,
    data.readinessThreshold ?? 50,
  );
  const streak = data.activityStreak?.current ?? 0;

  return (
    <Link
      href="/milestones"
      onClick={onNavigate}
      className="block rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2.5 transition-colors hover:bg-foreground/5"
      data-testid="sidebar-climb-summary"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/60">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          Level {climb.level}
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[hsl(20_90%_50%)]">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {streak}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
          style={{ width: `${climb.next ? climb.progressToNextPct : 100}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
        {climb.next
          ? `${climb.pointsToNext} to ${climb.next.title}`
          : "Top of the climb"}
      </p>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const activeSection = sectionForLocation(location);
  const activeHref = bestMatchHref(location);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeSection) setOpen((prev) => ({ ...prev, [activeSection]: true }));
  }, [activeSection]);

  // If the current route lives in a section's "more" bucket, reveal it so the
  // active link is always visible.
  useEffect(() => {
    for (const section of SECTIONS) {
      if (moreHasActive(location, section)) {
        setShowAll((prev) => ({ ...prev, [section.id]: true }));
      }
    }
  }, [location]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Link
          href="/today"
          onClick={onNavigate}
          className="flex items-center gap-2.5 group"
        >
          <img
            src="/matchlab-logo.png"
            alt="MatchLab Club"
            className="h-12 w-auto transition-transform group-hover:scale-[1.04]"
            style={{
              filter: "drop-shadow(0 2px 10px hsl(326 100% 60% / 0.4))",
            }}
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

      {/* Echo is the companion-first entry point for the signed-in experience. */}
      <div className="px-3 pb-3">
        <Link
          href="/echo"
          onClick={onNavigate}
          className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          data-testid="sidebar-echo-cta"
        >
          Talk to Echo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <div className="pb-2">
          <NextBestAction onNavigate={onNavigate} />
        </div>
        <div className="pb-2">
          <ClimbSummary onNavigate={onNavigate} />
        </div>
        <div className="space-y-1">
          {OVERVIEW.map((link) => (
            <NavRow
              key={link.href}
              link={link}
              active={activeHref === link.href}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {SECTIONS.map((section) => {
          const isOpen = open[section.id] ?? false;
          const expanded = showAll[section.id] ?? false;
          return (
            <div key={section.id} className="pt-2">
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => ({
                    ...prev,
                    [section.id]: !prev[section.id],
                  }))
                }
                aria-expanded={isOpen}
                aria-controls={`sidebar-panel-${section.id}`}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground/50 transition-colors hover:text-foreground/80"
                data-testid={`sidebar-section-${section.id}`}
              >
                {section.label}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div
                  id={`sidebar-panel-${section.id}`}
                  className="mt-1 space-y-0.5"
                >
                  {section.primary.map((link) => (
                    <NavRow
                      key={link.href}
                      link={link}
                      active={activeHref === link.href}
                      onNavigate={onNavigate}
                    />
                  ))}
                  {expanded &&
                    section.more.map((link) => (
                      <NavRow
                        key={link.href}
                        link={link}
                        active={activeHref === link.href}
                        onNavigate={onNavigate}
                      />
                    ))}
                  {section.more.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAll((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                      className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
                      data-testid={`sidebar-showall-${section.id}`}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          expanded && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                      {expanded
                        ? "Show less"
                        : `Show all (${section.more.length} more)`}
                    </button>
                  )}
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
            <span className="truncate font-medium">
              {user?.firstName || user?.email || "Account"}
            </span>
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
