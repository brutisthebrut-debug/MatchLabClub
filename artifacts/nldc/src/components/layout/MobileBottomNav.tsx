import { Link, useLocation } from "wouter";
import {
  MEMBER_DESTINATIONS,
  destinationIdForPath,
} from "@/lib/memberDestinations";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const [location] = useLocation();
  const activeDestination = destinationIdForPath(location);

  return (
    <nav
      aria-label="Primary member destinations"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/10 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_hsl(240_20%_4%/0.12)] backdrop-blur-xl md:hidden"
      data-testid="mobile-bottom-nav"
    >
      <div className="grid h-[4.5rem] grid-cols-5">
        {MEMBER_DESTINATIONS.map((destination) => {
          const active = activeDestination === destination.id;
          const Icon = destination.icon;

          return (
            <Link
              key={destination.id}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center transition-colors",
                active
                  ? "text-[hsl(248_62%_62%)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`mobile-nav-${destination.id}`}
            >
              <span
                className={cn(
                  "flex h-7 w-10 items-center justify-center rounded-full transition-colors",
                  active && "bg-[hsl(248_62%_52%/0.13)]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="max-w-full text-[10px] font-semibold leading-3">
                {destination.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
