import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { PACKAGES } from "@/lib/navigationCatalog";

export function FeatureHub() {
  const [location] = useLocation();
  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  return (
    <section
      className="mb-10"
      aria-labelledby="feature-hub-heading"
      data-testid="section-feature-hub"
    >
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Everything in MatchLab Club</p>
          <h2 id="feature-hub-heading" className="text-xl sm:text-2xl font-bold text-foreground">
            Every tool, organised.
          </h2>
        </div>
        <p className="hidden sm:block text-xs text-muted-foreground/70 max-w-xs text-right">
          The full toolkit — six tracks, every feature reachable in two clicks.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => (
          <div
            key={pkg.id}
            className="glass rounded-2xl p-5 flex flex-col"
            style={{ border: `1px solid ${pkg.color.replace(")", " / 0.2)")}` }}
            data-testid={`feature-hub-card-${pkg.id}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: pkg.color.replace(")", " / 0.12)") }}
              >
                <pkg.icon className="w-4 h-4" style={{ color: pkg.color }} aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{pkg.label}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground/75 leading-snug mb-3 pl-10">{pkg.tagline}</p>

            {/* Featured tools */}
            <ul className="space-y-0.5 mb-2" role="list">
              {pkg.tools.map(t => {
                const active = isActive(t.href);
                return (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-baseline justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                        active
                          ? "bg-foreground/5"
                          : "hover:bg-foreground/5"
                      }`}
                      data-testid={`feature-hub-link-${t.href}`}
                    >
                      <span className={`text-xs leading-tight ${active ? "font-semibold text-foreground" : "text-foreground/85"}`}>
                        {t.name}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* More */}
            {pkg.more.length > 0 && (
              <details className="mt-1 group">
                <summary
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 cursor-pointer list-none px-2 py-1 hover:text-muted-foreground transition-colors flex items-center gap-1.5"
                >
                  <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                  More {pkg.more.length}
                </summary>
                <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 mt-1 pl-3">
                  {pkg.more.map(t => (
                    <Link
                      key={t.href}
                      href={t.href}
                      className="text-[11px] text-muted-foreground/75 hover:text-foreground px-2 py-1 rounded-md hover:bg-foreground/5 transition-colors leading-tight"
                      data-testid={`feature-hub-more-${t.href}`}
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </details>
            )}

            {/* Hub link */}
            <Link
              href={pkg.hubHref}
              className="flex items-center gap-1 text-[11px] font-semibold mt-3 pt-3 border-t border-foreground/8 transition-opacity hover:opacity-80"
              style={{ color: pkg.color }}
              data-testid={`feature-hub-hub-${pkg.id}`}
            >
              {pkg.hubLabel} <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
