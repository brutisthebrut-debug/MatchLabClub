import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="font-serif text-2xl font-bold text-primary mb-4 block inline-block">
              Next Level Dating Club
            </Link>
            <p className="text-muted max-w-sm mt-4 text-sm leading-relaxed">
              Premium dating coaching that actually works. 
              No vague advice. Just specific, actionable guidance to find the relationship you deserve.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4 text-white">Product</h3>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link href="/start" className="hover:text-primary transition-colors">Free Profile Audit</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/coach" className="hover:text-primary transition-colors">Message Coaching</Link></li>
              <li><Link href="/insights" className="hover:text-primary transition-colors">Email Insights</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4 text-white">Legal</h3>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">Privacy Promise</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} Next Level Dating Club. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Private, secure, and confidential.</p>
        </div>
      </div>
    </footer>
  );
}
