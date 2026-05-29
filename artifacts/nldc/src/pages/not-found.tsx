import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Search } from "lucide-react";

const SUGGESTIONS = [
  { label: "Dashboard", href: "/dashboard", desc: "Your Signal Score and tools" },
  { label: "Signal Audit", href: "/start", desc: "Get your free profile audit" },
  { label: "Message Coach", href: "/coach", desc: "Coached replies for any conversation" },
  { label: "Wellness", href: "/wellness", desc: "8 dimensions of your readiness" },
];

export default function NotFound() {
  useMeta("Page Not Found", "This page doesn't exist, head back to the dashboard or pick a tool.");
  return (
  <AppLayout>
  <div className="min-h-screen flex items-center justify-center px-4 py-24 relative">
  <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-25 pointer-events-none" />
  <div className="max-w-lg w-full relative z-10 text-center">
  <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
  >
  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%/0.2)] to-[hsl(326_100%_55%/0.15)] mx-auto mb-6 flex items-center justify-center border border-[hsl(248_62%_52%/0.2)]">
  <Search className="w-7 h-7 text-[hsl(248_62%_62%)]" />
  </div>
  <p className="text-[hsl(248_62%_62%)] text-sm font-semibold tracking-widest uppercase mb-2">404</p>
  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Page not found</h1>
  <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
  That link doesn't go anywhere. Try one of these instead, or head back to the dashboard.
  </p>

  <div className="grid grid-cols-2 gap-3 mb-8 text-left">
  {SUGGESTIONS.map(s => (
  <Link key={s.href} href={s.href}
  className="glass-strong rounded-xl p-3 border border-white/5 hover:border-[hsl(248_62%_52%/0.25)] transition-colors block">
  <p className="text-sm font-semibold text-foreground">{s.label}</p>
  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
  </Link>
  ))}
  </div>

  <div className="flex items-center justify-center gap-3">
  <Button asChild variant="outline" className="rounded-full gap-2">
  <Link href="/"><ArrowLeft className="w-4 h-4" />Home</Link>
  </Button>
  <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 gap-2">
  <Link href="/dashboard"><Sparkles className="w-4 h-4" />Dashboard</Link>
  </Button>
  </div>
  </motion.div>
  </div>
  </div>
  </AppLayout>
  );
}
