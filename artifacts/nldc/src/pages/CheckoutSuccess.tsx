import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetBillingStatusQueryKey,
  useGetBillingStatus,
} from "@workspace/api-client-react";

export default function CheckoutSuccess() {
  useMeta(
    "Package activation",
    "Confirming your MatchLab package with Stripe.",
  );
  const { isAuthenticated, login } = useAuth();
  const billing = useGetBillingStatus({
    query: {
      queryKey: getGetBillingStatusQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const activated = ["active", "trialing", "beta_grant"].includes(
    billing.data?.billingState ?? "",
  );

  useEffect(() => {
    if (!isAuthenticated || activated) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void billing.refetch();
      if (attempts >= 8) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activated, billing.refetch, isAuthenticated]);

  return (
    <AppLayout>
      <main className="mesh-bg min-h-screen px-4 py-20 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong mx-auto max-w-2xl rounded-[2rem] p-8 text-center sm:p-12"
        >
          {!isAuthenticated ? (
            <>
              <ShieldCheck
                className="mx-auto h-10 w-10 text-[#3D35CC]"
                aria-hidden="true"
              />
              <h1 className="mt-5 font-serif text-3xl font-bold text-foreground">
                Sign in to confirm your package.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Stripe has returned you to MatchLab. Your signed-in account is
                required before access can be confirmed.
              </p>
              <Button
                onClick={() => login()}
                className="mt-7 rounded-full px-7"
              >
                Sign in
              </Button>
            </>
          ) : activated ? (
            <>
              <CheckCircle2
                className="mx-auto h-11 w-11 text-emerald-500"
                aria-hidden="true"
              />
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-[#3D35CC]">
                Package active
              </p>
              <h1 className="mt-2 font-serif text-4xl font-bold text-foreground">
                {billing.data?.assignment.label} is ready.
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Echo can now use the capabilities included in this package.
                Matching access remains separate from nearby availability and
                never guarantees an introduction.
              </p>
              <Button asChild className="mt-7 rounded-full px-7">
                <Link href="/today">
                  Continue with Echo{" "}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <LoaderCircle
                className="mx-auto h-11 w-11 animate-spin text-[#3D35CC]"
                aria-hidden="true"
              />
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-[#3D35CC]">
                Confirming with Stripe
              </p>
              <h1 className="mt-2 font-serif text-4xl font-bold text-foreground">
                Your payment returned successfully.
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Package access is still syncing. This page checks the server’s
                subscription truth before calling anything active.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  onClick={() => void billing.refetch()}
                  variant="outline"
                  className="rounded-full"
                >
                  Check again
                </Button>
                <Button asChild className="rounded-full">
                  <Link href="/me">View My MatchLab</Link>
                </Button>
              </div>
            </>
          )}
        </motion.section>
      </main>
    </AppLayout>
  );
}
