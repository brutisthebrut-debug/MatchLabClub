import { Link, useLocation } from "wouter";
import {
  HeartHandshake,
  Route,
  Sparkles,
  SunMedium,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIMARY_DESTINATIONS,
  destinationForLocation,
  type PrimaryDestinationId,
} from "@/lib/echoJourney";

const ICONS: Record<
  PrimaryDestinationId,
  typeof SunMedium
> = {
  today: SunMedium,
  matches: HeartHandshake,
  matchlab: UserRound,
  journey: Route,
  play: Sparkles,
};

export function MobilePrimaryNav() {
  const [location] = useLocation();
  const active = destinationForLocation(location);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-foreground/10 bg-background/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_35px_hsl(248_55%_5%/0.08)] backdrop-blur-2xl md:hidden"
      data-testid="mobile-primary-nav"
    >
      {PRIMARY_DESTINATIONS.map((destination) => {
        const Icon = ICONS[destination.id];
        const selected = active === destination.id;
        return (
          <Link
            key={destination.id}
            href={destination.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors",
              selected
                ? "bg-[hsl(248_62%_52%/0.1)] text-[hsl(var(--primary))]"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
            data-testid={`mobile-destination-${destination.id}`}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            <span className="max-w-full truncate">
              {destination.id === "matchlab" ? "MatchLab" : destination.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
