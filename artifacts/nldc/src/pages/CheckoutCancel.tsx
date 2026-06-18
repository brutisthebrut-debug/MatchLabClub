import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { ArrowLeft, RefreshCw, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CheckoutCancel() {
  const params = new URLSearchParams(
  typeof window !== "undefined" ? window.location.search : ""
  );
  const product = params.get("product") || "dating-reset";

  useMeta("Order Cancelled", "No worries, your order wasn't completed. Come back whenever you're ready.");

  return (
  <AppLayout>
  <div className="container mx-auto px-4 md:px-6 py-24 max-w-xl text-center">
  <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  >
  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-8 border border-white/10">
  <ArrowLeft className="w-8 h-8 text-muted-foreground" />
  </div>

  <h1 className="font-serif text-3xl font-bold text-foreground mb-4">
  No worries, nothing was charged.
  </h1>

  <p className="text-muted-foreground leading-relaxed mb-3">
  Your order wasn't completed, and nothing was taken from your card. Come back whenever you're ready.
  </p>

  <p className="text-muted-foreground/60 text-sm mb-10">
  If something felt wrong or confusing, we'd love to know, email us at hello@matchlab.club.
  </p>

  <div className="flex flex-col sm:flex-row gap-4 justify-center">
  <Link
  href={`/checkout/${product}`}
  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
  >
  <RefreshCw className="w-4 h-4" />
  Try again
  </Link>
  <Link
  href="/pricing"
  className="inline-flex items-center justify-center gap-2 px-6 py-3 glass rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
  >
  See all plans
  </Link>
  </div>

  <div className="mt-12 glass rounded-2xl p-6 text-left">
  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
  <MessageCircle className="w-4 h-4 text-[hsl(248_62%_52%)]" />
  Free tools, no card needed
  </p>
  <ul className="space-y-2 text-sm text-muted-foreground">
  <li>→ <Link href="/signal-check" className="hover:text-foreground transition-colors">3-Min Signal Check</Link>, free, instant score</li>
  <li>→ <Link href="/start" className="hover:text-foreground transition-colors">Full Profile Signal Audit</Link>, still free</li>
  <li>→ <Link href="/lab" className="hover:text-foreground transition-colors">Chemistry Lab</Link>, message coaching</li>
  </ul>
  </div>
  </motion.div>
  </div>
  </AppLayout>
  );
}
