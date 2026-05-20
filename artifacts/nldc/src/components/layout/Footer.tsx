import { Link } from "wouter";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-[hsl(232_38%_5%)] overflow-hidden">
      {/* Decorative orb */}
      <div className="orb orb-violet absolute w-96 h-96 -bottom-32 -left-32 opacity-60 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 py-14 md:py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-5 w-fit group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-serif text-lg font-bold gradient-text-violet">Next Level Dating Club</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              The private coaching studio for people who want to be understood accurately — not just liked more.
            </p>
            <p className="text-muted-foreground/50 text-xs mt-4 leading-relaxed max-w-xs">
              No generic advice. No vague confidence tips. Just honest, specific, actionable coaching built around who you actually are.
            </p>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-sm text-foreground/70 uppercase tracking-widest mb-5">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/start" className="text-muted-foreground hover:text-foreground transition-colors">Free Dating Audit</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/coach" className="text-muted-foreground hover:text-foreground transition-colors">Message Coaching</Link></li>
              <li><Link href="/insights" className="text-muted-foreground hover:text-foreground transition-colors">Import Communication Patterns</Link></li>
              <li><Link href="/integrations" className="text-muted-foreground hover:text-foreground transition-colors">Integrations</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-sm text-foreground/70 uppercase tracking-widest mb-5">Trust</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/waitlist" className="text-muted-foreground hover:text-foreground transition-colors">Podcast Listeners</Link></li>
              <li><Link href="/partners/shebangs" className="text-muted-foreground hover:text-foreground transition-colors">Partner: Shebangs.club</Link></li>
            </ul>
          </div>
        </div>

        <div className="divider-gradient mt-12 mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground/50 gap-2">
          <p>&copy; {new Date().getFullYear()} Next Level Dating Club. All rights reserved.</p>
          <p>Private, encrypted, confidential. Your data is never sold.</p>
        </div>
      </div>
    </footer>
  );
}
