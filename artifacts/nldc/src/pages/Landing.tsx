import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Star, Headphones } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <AppLayout>
      {/* Podcast Banner */}
      <div className="bg-primary/10 border-b border-primary/20 py-2">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Headphones size={16} />
          <span>As heard on <strong>The Daily Date</strong> podcast.</span>
          <Link href="/waitlist" className="underline underline-offset-2 ml-1 hidden md:inline">
            Get early listener access &rarr;
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-16 md:pt-24 pb-20 md:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Now accepting new members
              </span>
            </motion.div>
            
            <motion.h1 
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Stop swiping.<br />
              <span className="text-primary italic font-serif">Start connecting.</span>
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Get a brilliant, warm, zero-judgment dating coach in your pocket. 
              We rewrite your profile, coach your messages, and help you find the relationship you deserve.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Button asChild size="lg" className="rounded-full h-14 px-8 text-base shadow-lg hover:shadow-xl transition-all" data-testid="button-hero-cta">
                <Link href="/start">
                  Get Your Free Profile Audit <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 sm:mt-0">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span>Join 2,000+ members</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-white border-y">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-8">
            Coaching that delivers real results
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { text: "My match rate tripled, but more importantly, the quality of conversations changed entirely.", name: "Sarah, 31", label: "Found a relationship" },
              { text: "It's like having a best friend who actually knows what they're talking about read over your shoulder.", name: "David, 28", label: "Dating intentionally" },
              { text: "The profile rewrite alone was worth it. I finally sound like myself.", name: "Elena, 35", label: "Married" }
            ].map((review, i) => (
              <div key={i} className="flex flex-col items-center text-center space-y-3 p-6 rounded-2xl bg-secondary/30">
                <div className="flex text-primary">
                  {[1,2,3,4,5].map(star => <Star key={star} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="italic text-foreground/80">"{review.text}"</p>
                <div className="mt-auto pt-4">
                  <p className="font-semibold text-foreground">{review.name}</p>
                  <p className="text-xs text-muted-foreground">{review.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Privacy */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Your Private Sanctuary</h2>
            <p className="text-lg text-muted-foreground">
              Dating is vulnerable. We treat your data with the highest level of respect and security.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { title: "Never Sold", desc: "Your data is yours. We never sell or share it with third parties." },
              { title: "Delete Anytime", desc: "One click to permanently delete your account and all history." },
              { title: "Consent First", desc: "You control exactly what we analyze and what we don't." },
              { title: "Zero Judgment", desc: "An entirely private space to process your dating life." }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">Ready to change your dating life?</h2>
          <p className="text-primary-foreground/80 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Take 2 minutes to complete our intake form and get a comprehensive analysis of your current profile.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-full h-14 px-10 text-lg text-primary font-bold shadow-xl">
            <Link href="/start">Start Your Free Audit</Link>
          </Button>
        </div>
      </section>
    </AppLayout>
  );
}
