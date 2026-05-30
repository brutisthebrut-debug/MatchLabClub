import { Link } from "wouter";

export function Footer() {
  return (
  <footer className="relative border-t border-border bg-[hsl(248_45%_97%)] overflow-hidden">
  {/* Decorative orb */}
  <div className="orb orb-violet absolute w-96 h-96 -bottom-32 -left-32 opacity-60 pointer-events-none" />

  <div className="container mx-auto px-4 md:px-6 py-14 md:py-16 relative z-10">
  <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-12">

  {/* Brand */}
  <div className="col-span-2">
  <Link href="/" className="flex items-center mb-5 w-fit group">
  <img
  src="/matchlab-logo.png"
  alt="MatchLab Club"
  className="h-12 w-auto transition-opacity group-hover:opacity-85"
  />
  </Link>
  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
  A second brain for your dating life. It sits on top of Tinder, Hinge, and Bumble and turns the real signals you already generate into a readiness score, then uses it to introduce you to real people. It never replaces the apps, it makes you better at them.
  </p>
  <p className="text-muted-foreground/60 text-xs mt-4 leading-relaxed max-w-xs">
  Hybrid AI: deterministic baseline always-on, Anthropic Claude layered on top, opt-in per account.
  </p>
  </div>

  {/* Try it free */}
  <div>
  <h3 className="font-sans font-semibold text-sm text-foreground/70 uppercase tracking-widest mb-5">Try It Free</h3>
  <ul className="space-y-3 text-sm">
  <li><Link href="/signal-check" className="text-muted-foreground hover:text-foreground transition-colors">Free Signal Check</Link></li>
  <li><Link href="/sample-report" className="text-muted-foreground hover:text-foreground transition-colors">Sample audit</Link></li>
  <li><Link href="/quizzes" className="text-muted-foreground hover:text-foreground transition-colors">Personality quizzes</Link></li>
  <li><Link href="/coach" className="text-muted-foreground hover:text-foreground transition-colors">Message coach</Link></li>
  <li><Link href="/compatibility-compass" className="text-muted-foreground hover:text-foreground transition-colors">Compatibility Compass</Link></li>
  </ul>
  </div>

  {/* Product */}
  <div>
  <h3 className="font-sans font-semibold text-sm text-foreground/70 uppercase tracking-widest mb-5">Product</h3>
  <ul className="space-y-3 text-sm">
  <li><Link href="/start" className="text-muted-foreground hover:text-foreground transition-colors">Full Dating Audit</Link></li>
  <li><Link href="/insights" className="text-muted-foreground hover:text-foreground transition-colors">Communication Insights</Link></li>
  <li><Link href="/wellness" className="text-muted-foreground hover:text-foreground transition-colors">Wellness Center</Link></li>
  <li><Link href="/me" className="text-muted-foreground hover:text-foreground transition-colors">Self Hub</Link></li>
  <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
  </ul>
  </div>

  {/* Trust & co */}
  <div>
  <h3 className="font-sans font-semibold text-sm text-foreground/70 uppercase tracking-widest mb-5">Trust &amp; Co</h3>
  <ul className="space-y-3 text-sm">
  <li><Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Journal</Link></li>
  <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy policy</Link></li>
  <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of service</Link></li>
  <li><Link href="/waitlist" className="text-muted-foreground hover:text-foreground transition-colors">Early access</Link></li>
  <li><Link href="/partners/shebangs" className="text-muted-foreground hover:text-foreground transition-colors">Partner: Shebangs.club</Link></li>
  </ul>
  </div>
  </div>

  <div className="divider-gradient mt-12 mb-8" />

  <div className="flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground/60 gap-2">
  <p>&copy; {new Date().getFullYear()} MatchLab Club. All rights reserved.</p>
  <p>Private &amp; encrypted · Your data, your call · Never sold</p>
  </div>
  </div>
  </footer>
  );
}
