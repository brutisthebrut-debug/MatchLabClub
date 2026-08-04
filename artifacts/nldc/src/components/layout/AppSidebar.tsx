import { Link, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetMatchingStateQueryKey,
  getGetMySignalMapQueryKey,
  useGetMatchingState,
  useGetMySignalMap,
} from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  HeartHandshake,
  LockKeyhole,
  LogOut,
  Route,
  Settings,
  Sparkles,
  SunMedium,
  Target,
  UserRound,
  X,
} from "lucide-react";
import {
  JOURNEY_CHAPTERS,
  PRIMARY_DESTINATIONS,
  chapterForLocation,
  destinationForLocation,
  type PrimaryDestinationId,
} from "@/lib/echoJourney";

const ICONS: Record<PrimaryDestinationId, typeof SunMedium> = {
  today: SunMedium,
  matches: HeartHandshake,
  matchlab: UserRound,
  journey: Route,
  play: Sparkles,
};

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
      className="group block rounded-2xl border border-[hsl(248_62%_52%/0.22)] bg-gradient-to-br from-[hsl(248_62%_52%/0.1)] via-[hsl(285_55%_56%/0.06)] to-[hsl(326_100%_59%/0.09)] p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      data-testid="sidebar-next-best-action"
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--primary))]">
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        One move for today
      </span>
      <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
        {action.label}
      </p>
      <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
        {action.detail}
        <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      </span>
    </Link>
  );
}

function UnderstandingMeter() {
  const { isAuthenticated } = useAuth();
  const { data } = useGetMySignalMap({
    query: {
      queryKey: getGetMySignalMapQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const percent = Math.round(data?.densityPercent ?? 0);

  return (
    <Link
      href="/your-mirror"
      className="rounded-xl border border-foreground/8 bg-foreground/[0.025] px-3 py-2 text-right transition-colors hover:bg-foreground/5"
      data-testid="sidebar-understanding"
    >
      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Understanding
      </span>
      <span className="font-serif text-lg font-bold leading-none text-foreground">
        {percent}%
      </span>
    </Link>
  );
}

function StoryRail({
  location,
  onNavigate,
}: {
  location: string;
  onNavigate: () => void;
}) {
  const activeChapter = chapterForLocation(location);

  return (
    <div className="rounded-2xl border border-foreground/8 bg-foreground/[0.02] p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Play the whole story
      </p>
      <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-2.5">
        {JOURNEY_CHAPTERS.map((chapter, index) => (
          <Link
            key={`${chapter.name}-${index}`}
            href={chapter.href}
            onClick={onNavigate}
            className="group min-w-0"
            data-testid={`journey-chapter-${index}`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-all",
                  index === activeChapter
                    ? "bg-[hsl(var(--accent))] shadow-[0_0_12px_hsl(var(--accent)/0.65)]"
                    : "bg-foreground/20 group-hover:bg-[hsl(var(--primary))]",
                )}
              />
              <span
                className={cn(
                  "truncate text-[10px] font-semibold transition-colors",
                  index === activeChapter
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {chapter.name}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const activeDestination = destinationForLocation(location);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <Link
          href="/today"
          onClick={onNavigate}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <img
            src="/matchlab-logo.png"
            alt="MatchLab Club"
            className="h-12 w-auto transition-transform group-hover:scale-[1.04]"
            style={{
              filter:
                "drop-shadow(0 2px 11px hsl(326 100% 60% / 0.42)) drop-shadow(0 0 16px hsl(248 75% 60% / 0.28))",
            }}
          />
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-serif text-base font-bold tracking-tight text-foreground">
              MatchLab
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Club
            </span>
          </div>
        </Link>
        <UnderstandingMeter />
      </div>

      <div className="px-3 pb-3">
        <NextBestAction onNavigate={onNavigate} />
      </div>

      <nav
        aria-label="Primary"
        className="space-y-1 px-3"
        data-testid="desktop-primary-nav"
      >
        {PRIMARY_DESTINATIONS.map((destination) => {
          const Icon = ICONS[destination.id];
          const selected = activeDestination === destination.id;
          return (
            <Link
              key={destination.id}
              href={destination.href}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                selected
                  ? "bg-gradient-to-r from-[hsl(248_62%_52%/0.14)] to-[hsl(326_100%_59%/0.08)] text-foreground shadow-[inset_3px_0_0_hsl(var(--accent))]"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
              data-testid={`sidebar-destination-${destination.id}`}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                  selected
                    ? "bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--primary))]"
                    : "bg-foreground/[0.04] group-hover:bg-[hsl(var(--primary)/0.09)]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">{destination.name}</span>
                <span className="block truncate text-[10px] font-medium text-muted-foreground">
                  {destination.question}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 px-3">
        <StoryRail location={location} onNavigate={onNavigate} />
      </div>

      <div className="mt-auto space-y-1 border-t border-foreground/8 px-3 py-3">
        <Link
          href="/vault"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          data-testid="sidebar-trust-data"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Trust & data
        </Link>
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          data-testid="sidebar-settings"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings & billing
        </Link>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/account"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            data-testid="sidebar-account"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3D35CC] via-[#8757E8] to-[#FF2D9B] text-xs font-bold text-white">
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
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:border-r md:border-foreground/8 md:bg-[hsl(var(--sidebar)/0.8)] md:backdrop-blur-2xl">
        <div className="sticky top-0 h-[100dvh]">
          <SidebarBody onNavigate={() => {}} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-50 bg-[hsl(248_55%_5%/0.62)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="fixed inset-y-0 left-0 z-[60] w-80 max-w-[90vw] border-r border-foreground/8 bg-background shadow-2xl animate-in slide-in-from-left"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
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
