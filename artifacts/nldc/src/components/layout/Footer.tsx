import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-[hsl(248_45%_97%)]">
      <div className="orb orb-violet pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 opacity-60" />

      <div className="container relative z-10 mx-auto px-4 py-14 md:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5 md:gap-12">
          <div className="col-span-2">
            <Link href="/" className="group mb-5 flex w-fit items-center">
              <img
                src="/matchlab-logo.png"
                alt="MatchLab Club"
                className="h-20 w-auto transition-opacity group-hover:opacity-85"
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A companion for your dating life. Echo turns the signals you
              choose to share into a clearer read of your patterns. When a real
              nearby fit exists, MatchLab can support one considered
              introduction without pretending readiness creates availability.
            </p>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground/60">
              Hybrid AI: deterministic baseline always on, Anthropic Claude
              layered on top, opt-in per account.
            </p>
          </div>

          <div>
            <h3 className="mb-5 font-sans text-sm font-semibold uppercase tracking-widest text-foreground/70">
              Try It Free
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/signal-check" className="text-muted-foreground transition-colors hover:text-foreground">Free Signal Check</Link></li>
              <li><Link href="/sample-report" className="text-muted-foreground transition-colors hover:text-foreground">Sample audit</Link></li>
              <li><Link href="/quizzes" className="text-muted-foreground transition-colors hover:text-foreground">Personality quizzes</Link></li>
              <li><Link href="/coach" className="text-muted-foreground transition-colors hover:text-foreground">Message coach</Link></li>
              <li><Link href="/compatibility-compass" className="text-muted-foreground transition-colors hover:text-foreground">Compatibility Compass</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-5 font-sans text-sm font-semibold uppercase tracking-widest text-foreground/70">
              Product
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/start" className="text-muted-foreground transition-colors hover:text-foreground">Full Dating Audit</Link></li>
              <li><Link href="/insights" className="text-muted-foreground transition-colors hover:text-foreground">Communication Insights</Link></li>
              <li><Link href="/wellness" className="text-muted-foreground transition-colors hover:text-foreground">Wellness Center</Link></li>
              <li><Link href="/me" className="text-muted-foreground transition-colors hover:text-foreground">My MatchLab</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-5 font-sans text-sm font-semibold uppercase tracking-widest text-foreground/70">
              Trust &amp; Co
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/blog" className="text-muted-foreground transition-colors hover:text-foreground">Journal</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">Privacy policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">Terms of service</Link></li>
              <li><Link href="/waitlist" className="text-muted-foreground transition-colors hover:text-foreground">Early access</Link></li>
              <li><Link href="/partners/shebangs" className="text-muted-foreground transition-colors hover:text-foreground">Partner: Shebangs.club</Link></li>
            </ul>
          </div>
        </div>

        <div className="divider-gradient mb-8 mt-12" />
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground/60 md:flex-row">
          <p>&copy; {new Date().getFullYear()} MatchLab Club. All rights reserved.</p>
          <p>Private &amp; encrypted · Your data, your call · Never sold</p>
        </div>
      </div>
    </footer>
  );
}
