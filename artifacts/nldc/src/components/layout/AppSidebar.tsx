import { ThemeToggle } from "@/components/ThemeToggle";
import {
  MEMBER_DESTINATIONS,
  TRUST_DESTINATION,
  destinationIdForPath,
  type MemberDestination,
} from "@/lib/memberDestinations";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { LogOut, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";

function NavRow({
  destination,
  active,
  onNavigate,
}: {
  destination: MemberDestination;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = destination.icon;
  return (
    <Link
      href={destination.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors",
        active
          ? "bg-[hsl(248_62%_52%/0.11)] text-[hsl(248_62%_52%)]"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
      data-testid={`sidebar-link-${destination.id}`}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-[hsl(248_62%_52%/0.12)]"
            : "bg-foreground/5 group-hover:bg-foreground/8",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-current">
          {destination.label}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[11px] leading-4",
            active ? "text-[hsl(248_35%_48%)]" : "text-muted-foreground/80",
          )}
        >
          {destination.description}
        </span>
      </span>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const activeDestination = destinationIdForPath(location);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Link
          href="/today"
          onClick={onNavigate}
          className="group flex items-center gap-2.5"
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

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Member destinations">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
          Your MatchLab
        </p>
        <div className="space-y-1">
          {MEMBER_DESTINATIONS.map((destination) => (
            <NavRow
              key={destination.id}
              destination={destination}
              active={activeDestination === destination.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="my-4 border-t border-foreground/8" />

        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
          Control
        </p>
        <NavRow
          destination={TRUST_DESTINATION}
          active={activeDestination === TRUST_DESTINATION.id}
          onNavigate={onNavigate}
        />
      </nav>

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
      <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:border-r md:border-foreground/8 md:bg-background/60 md:backdrop-blur-xl">
        <div className="sticky top-0 h-[100dvh]">
          <SidebarBody onNavigate={() => {}} />
        </div>
      </aside>

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
            className="fixed inset-y-0 left-0 z-50 w-80 max-w-[88vw] border-r border-foreground/8 bg-background shadow-2xl animate-in slide-in-from-left"
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
