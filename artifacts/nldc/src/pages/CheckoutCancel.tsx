import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";

export default function CheckoutCancel() {
  useMeta(
    "Checkout paused",
    "Nothing was charged. Return whenever the package is useful.",
  );

  return (
    <AppLayout>
      <main className="mesh-bg min-h-screen px-4 py-20 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong mx-auto max-w-2xl rounded-[2rem] p-8 text-center sm:p-12"
        >
          <ArrowLeft
            className="mx-auto h-10 w-10 text-[#3D35CC]"
            aria-hidden="true"
          />
          <h1 className="mt-5 font-serif text-4xl font-bold text-foreground">
            Nothing was charged.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Your current MatchLab access is unchanged. The package should earn
            its place by solving the next job, not by pressuring you at
            checkout.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="rounded-full">
              <Link href="/pricing">Review packages</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/today">Return to Echo</Link>
            </Button>
          </div>
          <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            If checkout was confusing, tell us through Feedback so we can fix
            it.
          </p>
        </motion.section>
      </main>
    </AppLayout>
  );
}
