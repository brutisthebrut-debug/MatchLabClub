import { Link, useLocation } from "wouter";
import { HUBS, type HubId } from "@/lib/hubs";
import { cn } from "@/lib/utils";

function isTabActive(location: string, href: string): boolean {
  return location === href || location.startsWith(href + "/");
}

// Route-based cluster sub-nav. Rendered as the first child inside a page's
// AppLayout so every tool in a cluster shares one consistent header and the
// cluster reads as a single hub. Each tab is a real route, so deep links and
// code-splitting keep working.
export function HubTabs({ hub, className }: { hub: HubId; className?: string }) {
  const [location] = useLocation();
  const def = HUBS[hub];

  return (
    <nav
      aria-label={`${def.label} sections`}
      className={cn(
        "border-b border-foreground/8 bg-background/70 backdrop-blur-xl",
        className,
      )}
      data-testid={`hubtabs-${hub}`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          {def.label}
        </span>
        {def.tabs.map((tab) => {
          const active = isTabActive(location, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              data-testid={`hubtab-${hub}-${tab.href}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
