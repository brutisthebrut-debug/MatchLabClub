import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CreditCard,
  Database,
  Eye,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetAccountSummaryQueryKey,
  getGetAiContentConsentQueryKey,
  getGetBillingStatusQueryKey,
  getGetMatchingStateQueryKey,
  useCreateBillingPortal,
  useGetAccountSummary,
  useGetAiContentConsent,
  useGetBillingStatus,
  useGetMatchingState,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

function SummaryCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  href,
  cta,
  testId,
}: {
  icon: typeof Brain;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  testId: string;
}) {
  return (
    <article
      className="glass flex h-full flex-col rounded-[2rem] border border-foreground/10 p-6 sm:p-7"
      data-testid={testId}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC]/15 to-[#FF2D9B]/15">
        <Icon className="h-5 w-5 text-[#3D35CC]" aria-hidden="true" />
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3D35CC]"
      >
        {cta}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function ReadinessRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Search;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/45 px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export default function MyMatchLab() {
  useMeta(
    "My MatchLab",
    "What MatchLab knows, what it can use, and the evidence behind your readiness.",
  );

  const { isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const summary = useGetAccountSummary({
    query: {
      queryKey: getGetAccountSummaryQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const matching = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const consent = useGetAiContentConsent({
    query: {
      queryKey: getGetAiContentConsentQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const billing = useGetBillingStatus({
    query: {
      queryKey: getGetBillingStatusQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (error) =>
        toast({
          title: "Billing controls could not open",
          description:
            error instanceof Error
              ? error.message.replace(/^HTTP \d+ [^:]+:\s*/, "")
              : "Try again in a moment.",
          variant: "destructive",
        }),
    },
  });

  const state = matching.data;
  const account = summary.data;
  const loading = summary.isLoading || matching.isLoading || consent.isLoading;
  const failed = summary.isError || matching.isError || consent.isError;
  const signalRecords = account
    ? account.audits +
      account.profiles +
      account.journalEntries +
      account.postDateNotes
    : 0;
  const searchLabel = state?.searchActive
    ? "Active"
    : state?.poolStatus === "paused"
      ? "Paused"
      : "Not started";
  const nearbyMembers = Math.max(0, state?.cityDensity ?? 0);
  const evidenceLabel = state?.eligible
    ? "Profile evidence ready"
    : "Still gathering evidence";
  const billingStateLabel =
    billing.data?.billingState === "beta_grant"
      ? "Founder beta access"
      : billing.data?.billingState === "past_due"
        ? "Payment needs attention"
        : billing.data?.billingState === "incomplete"
          ? "Activation incomplete"
          : billing.data?.billingState === "active" ||
              billing.data?.billingState === "trialing"
            ? "Billing active"
            : "No paid subscription";

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.div {...fadeUp(0)} className="mb-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
              <Brain
                className="h-3.5 w-3.5 text-[#3D35CC]"
                aria-hidden="true"
              />
              My MatchLab
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              What MatchLab knows. What you control.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Your profile model, source coverage, permissions, and readiness
              evidence live together here. Nothing gets quietly promoted from
              saved data into matching permission.
            </p>
          </motion.div>

          {!isAuthenticated ? (
            <motion.section
              {...fadeUp(0.03)}
              className="glass-strong rounded-[2rem] p-8 sm:p-10"
            >
              <ShieldCheck
                className="h-8 w-8 text-[#3D35CC]"
                aria-hidden="true"
              />
              <h2 className="mt-4 font-serif text-3xl font-bold text-foreground">
                Sign in to see your actual profile evidence.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                This page never fills an empty account with sample insights or
                sample sources. What appears here belongs to you.
              </p>
              <Button
                onClick={() => login()}
                className="mt-6 rounded-full px-6"
              >
                Sign in
              </Button>
            </motion.section>
          ) : loading ? (
            <section className="glass-strong animate-pulse rounded-[2rem] p-8">
              <div className="h-6 w-48 rounded bg-foreground/10" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="h-44 rounded-2xl bg-foreground/10" />
                <div className="h-44 rounded-2xl bg-foreground/10" />
              </div>
            </section>
          ) : failed || !state || !account ? (
            <section className="glass-strong rounded-[2rem] p-8 text-center">
              <p className="font-semibold text-foreground">
                Your MatchLab profile could not load.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Refresh in a moment. No sample profile is standing in for your
                real account.
              </p>
            </section>
          ) : (
            <>
              <motion.section
                {...fadeUp(0.03)}
                className="glass-strong rounded-[2rem] p-7 sm:p-9"
                data-testid="my-matchlab-readiness"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
                      Readiness evidence
                    </p>
                    <h2 className="mt-2 font-serif text-3xl font-bold text-foreground sm:text-4xl">
                      {evidenceLabel}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      This reflects profile evidence, not worth or access to a
                      person. Search activity and nearby availability remain
                      separate decisions and states.
                    </p>
                  </div>
                  <Link
                    href="/match-path"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
                  >
                    See readiness evidence
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <ReadinessRow
                    icon={HeartHandshake}
                    label="Profile"
                    value={state.eligible ? "Ready" : "Building"}
                  />
                  <ReadinessRow
                    icon={Search}
                    label="Search"
                    value={searchLabel}
                  />
                  <ReadinessRow
                    icon={MapPin}
                    label="Nearby market"
                    value={
                      nearbyMembers > 0
                        ? `${nearbyMembers} ${nearbyMembers === 1 ? "member" : "members"}`
                        : "Still building"
                    }
                  />
                </div>
              </motion.section>

              <motion.section
                {...fadeUp(0.045)}
                className="mt-5 rounded-[2rem] border border-foreground/10 bg-background/55 p-6 sm:p-7"
                data-testid="my-matchlab-billing"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC]/15 to-[#FF2D9B]/15">
                      <CreditCard
                        className="h-5 w-5 text-[#3D35CC]"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Package & billing
                      </p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-foreground">
                        {billing.data?.assignment.label ?? state.plan.label}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {billing.isLoading
                          ? "Checking billing status…"
                          : billing.isError
                            ? "Package access is available; billing status could not load."
                            : billingStateLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {billing.data?.portalAvailable ? (
                      <Button
                        onClick={() => portal.mutate()}
                        disabled={portal.isPending}
                        className="rounded-full"
                      >
                        {portal.isPending
                          ? "Opening billing…"
                          : "Manage billing"}
                      </Button>
                    ) : (
                      <Button asChild className="rounded-full">
                        <Link href="/pricing">See packages</Link>
                      </Button>
                    )}
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
                      Package access never changes your priority or guarantees
                      that a compatible person is available.
                    </p>
                  </div>
                </div>
              </motion.section>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <motion.div {...fadeUp(0.05)}>
                  <SummaryCard
                    icon={Eye}
                    eyebrow="Profile model"
                    title="Your current Mirror"
                    body="See Echo's current portrait, what feels well supported, and where it is still uncertain."
                    href="/your-mirror"
                    cta="Open your Mirror"
                    testId="my-matchlab-mirror"
                  />
                </motion.div>
                <motion.div {...fadeUp(0.07)}>
                  <SummaryCard
                    icon={Database}
                    eyebrow="Source coverage"
                    title={`${signalRecords} recorded ${signalRecords === 1 ? "signal" : "signals"}`}
                    body="Audits, profile reads, journal entries, and post-date notes are counted here without pretending every source has equal depth."
                    href="/connections"
                    cta="Manage sources"
                    testId="my-matchlab-sources"
                  />
                </motion.div>
                <motion.div {...fadeUp(0.09)}>
                  <SummaryCard
                    icon={LockKeyhole}
                    eyebrow="Echo permission"
                    title={
                      consent.data?.granted
                        ? "Deeper AI analysis is on"
                        : "Deterministic analysis only"
                    }
                    body="Saved source data and permission for deeper AI analysis are separate. Change that choice whenever you want."
                    href="/user-control"
                    cta="Review permissions"
                    testId="my-matchlab-permissions"
                  />
                </motion.div>
                <motion.div {...fadeUp(0.11)}>
                  <SummaryCard
                    icon={Sparkles}
                    eyebrow="Full evidence view"
                    title="Every source, read, and recent signal"
                    body="The detailed profile workspace remains available when you want the full model instead of this decision view."
                    href="/me/details"
                    cta="Open full profile"
                    testId="my-matchlab-details"
                  />
                </motion.div>
              </div>

              <motion.section
                {...fadeUp(0.13)}
                className="mt-5 flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/45 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#3D35CC]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Trust & Data stays one click away.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Review stored data, export it, or begin deletion without
                      hunting through the product.
                    </p>
                  </div>
                </div>
                <Link
                  href="/vault"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/15 bg-background px-4 py-2 text-sm font-semibold text-foreground"
                >
                  Trust & Data
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.section>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
