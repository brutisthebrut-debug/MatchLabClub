import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "How it Works", href: "/#how-it-works" },
    { name: "Pricing", href: "/pricing" },
    { name: "Waitlist", href: "/waitlist" },
    { name: "Member Login", href: "/dashboard" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home">
          <span className="font-serif text-xl font-bold tracking-tight text-primary">NLDC</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
              {item.name}
            </Link>
          ))}
          <Button asChild className="rounded-full px-6 font-semibold" data-testid="button-nav-start">
            <Link href="/start">Start Free Audit</Link>
          </Button>
        </nav>

        {/* Mobile Nav Toggle */}
        <button 
          className="md:hidden p-2 text-foreground" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
          {navigation.map((item) => (
            <Link 
              key={item.name} 
              href={item.href} 
              className="text-base font-medium p-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <Button asChild className="rounded-full w-full mt-2" onClick={() => setMobileMenuOpen(false)}>
            <Link href="/start">Start Free Audit</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
