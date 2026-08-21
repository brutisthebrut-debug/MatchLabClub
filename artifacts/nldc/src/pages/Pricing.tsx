import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  HeartHandshake,
  LockKeyhole,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { useAuth } from "@workspace/replit-auth-web";
import {
  type BillingCheckoutRequestCadence,
  type CommercialPlan,
  getGetBillingStatusQueryKey,
  getGetCommercialPlansQueryKey,
  useCreateBillingCheckout,
  useGetBillingStatus,
  useGetCommercialPlans,
} from "@workspace/api-client-react";

const PLAN_ICONS = {
  member: UserRound,
  insight: Sparkles,
  match: Search,
  guided: HeartHandshake,
} as const;

const PLAN_RANK = { member: 0, insight: 1, match: 2, guided: 3 } as const;

const CADENCE_LABEL: Record<BillingCheckoutRequestCadence, string> = {
  monthly: "Monthly",
  annual: "Annual",
  quarterly: "Quarterly",
};

const BILLABLE_CADENCES: Record<
  "insight" | "match",
  BillingCheckoutRequestCadence[]
> = {
  insight: ["monthly", "annual"],
  match: ["monthly", "quarterly"],
};

function formatPrice(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}

function cadenceSuffix(cadence: string): string {
  if (cadence === "monthly") return "/month";
  if (cadence === "annual") return "/year";
  if (cadence === "quarterly") return "/quarter";
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^HTTP \d+ [^:]+:\s*/, "");
  }
  return "Billing could not start. Please try again.";
}

export default function Pricing() {
  useMeta(
    "MatchLab packages",
    "Choose how deeply Echo helps: build your profile, understand your patterns, activate matching, or add bounded human guidance.",
    absoluteUrl(DEFAULT_OG_IMAGE),
    { canonicalUrl: absoluteUrl("/pricing") },
  );

  const { isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const [cadence, setCadence] = useState<
    Record<"insight" | "match", BillingCheckoutRequestCadence>
  >({
    insight: "monthly",
    match: "monthly",
  });

  const plans = useGetCommercialPlans({
    query: { queryKey: getGetCommercialPlansQueryKey(), retry: false },
  });
  const billing = useGetBillingStatus({
    query: {
      queryKey: getGetBillingStatusQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const checkout = useCreateBillingCheckout({
    mutation: {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (error) =>
        toast({
          title: "Checkout is not ready yet",
          description: errorMessage(error),
          variant: "destructive",
        }),
    },
  });

  const orderedPlans = useMemo(() => {
    const catalog = plans.data?.plans ?? [];
    return [...catalog].sort((a, b) => PLAN_RANK[a.key] - PLAN_RANK[b.key]);
  }, [plans.data]);

  const currentPlan = billing.data?.assignment.key ?? "member";

  const startCheckout = (planKey: "insight" | "match") => {
    if (!isAuthenticated) {
      login();
      return;
    }
    checkout.mutate({ data: { planKey, cadence: cadence[planKey] } });
  };

  return (
    <AppLayout>
      <main className="mesh-bg relative min-h-screen overflow-hidden px-4 py-12 sm:px-6 lg:py-16">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
              <CircleDollarSign
                className="h-3.5 w-3.5 text-[#3D35CC]"
                aria-hidden="true"
              />
              MatchLab packages
            </p>
            <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Start useful. Go deeper when it earns its place.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every package has a complete job. Moving up changes what MatchLab
              can do for you; it never buys priority, guarantees a person, or
              creates nearby supply.
            </p>
          </motion.header>

          {plans.isLoading ? (
            <section
              className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
              aria-label="Loading packages"
            >
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="glass h-96 animate-pulse rounded-[2rem] border border-foreground/10"
                />
              ))}
            </section>
          ) : plans.isError || orderedPlans.length === 0 ? (
            <section className="glass-strong mx-auto mt-12 max-w-2xl rounded-[2rem] p-8 text-center">
              <LockKeyhole
                className="mx-auto h-8 w-8 text-[#3D35CC]"
                aria-hidden="true"
              />
              <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">
                The package catalog could not load.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                MatchLab will not substitute old offers or guessed prices.
                Refresh when the connected API is available.
              </p>
            </section>
          ) : (
            <section
              className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
              aria-label="MatchLab packages"
            >
              {orderedPlans.map((plan, index) => {
                const Icon = PLAN_ICONS[plan.key];
                const isCurrent = currentPlan === plan.key;
                const isIncluded = PLAN_RANK[currentPlan] > PLAN_RANK[plan.key];
                const billablePlanKey =
                  plan.key === "insight" || plan.key === "match"
                    ? plan.key
                    : null;
                const selectedCadence = billablePlanKey
                  ? cadence[billablePlanKey]
                  : null;
                const selectedPrice = selectedCadence
                  ? plan.prices.find(
                      (price) => price.cadence === selectedCadence,
                    )
                  : plan.prices[0];

                return (
                  <motion.article
                    key={plan.key}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                    className={`flex h-full flex-col rounded-[2rem] border p-6 ${plan.key === "match" ? "glass-strong border-[#3D35CC]/35 shadow-[0_18px_60px_-35px_rgba(61,53,204,0.65)]" : "glass border-foreground/10"}`}
                    data-testid={`plan-${plan.key}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC]/15 to-[#FF2D9B]/15">
                        <Icon
                          className="h-5 w-5 text-[#3D35CC]"
                          aria-hidden="true"
                        />
                      </div>
                      {isCurrent ? (
                        <span className="rounded-full bg-[#3D35CC]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#3D35CC]">
                          Current
                        </span>
                      ) : plan.key === "guided" ? (
                        <span className="rounded-full border border-foreground/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Capacity limited
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-5 font-serif text-2xl font-bold text-foreground">
                      {plan.label}
                    </h2>
                    <p className="mt-2 min-h-16 text-sm leading-relaxed text-muted-foreground">
                      {plan.outcome}
                    </p>

                    <div className="mt-5">
                      {plan.key === "guided" && plan.monthlyRangeCents ? (
                        <p className="text-2xl font-bold text-foreground">
                          {formatPrice(plan.monthlyRangeCents.min)}–
                          {formatPrice(plan.monthlyRangeCents.max)}
                          <span className="text-sm font-medium text-muted-foreground">
                            /month
                          </span>
                        </p>
                      ) : selectedPrice ? (
                        <p className="text-3xl font-bold text-foreground">
                          {formatPrice(selectedPrice.amountCents)}
                          <span className="text-sm font-medium text-muted-foreground">
                            {cadenceSuffix(selectedPrice.cadence)}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    {billablePlanKey ? (
                      <div className="mt-4 flex rounded-full border border-foreground/10 bg-background/45 p-1">
                        {BILLABLE_CADENCES[billablePlanKey].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setCadence((current) => ({
                                ...current,
                                [billablePlanKey]: option,
                              }))
                            }
                            className={`flex-1 rounded-full px-2 py-2 text-xs font-semibold transition ${cadence[billablePlanKey] === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {CADENCE_LABEL[option]}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.includes.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm leading-relaxed text-foreground/85"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#3D35CC]"
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7">
                      {plan.key === "member" ? (
                        <Button asChild className="w-full rounded-full">
                          <Link href="/today">
                            {isAuthenticated
                              ? "Continue with Echo"
                              : "Start free"}
                          </Link>
                        </Button>
                      ) : plan.key === "guided" ? (
                        <Button disabled className="w-full rounded-full">
                          Not open for purchase
                        </Button>
                      ) : isCurrent || isIncluded ? (
                        <Button
                          asChild
                          variant="outline"
                          className="w-full rounded-full"
                        >
                          <Link href="/me">
                            {isCurrent
                              ? "View your package"
                              : "Included in your package"}
                          </Link>
                        </Button>
                      ) : billablePlanKey ? (
                        <Button
                          onClick={() => startCheckout(billablePlanKey)}
                          disabled={
                            checkout.isPending ||
                            billing.data?.billingState === "beta_grant"
                          }
                          className="w-full rounded-full"
                        >
                          {checkout.isPending
                            ? "Opening secure checkout…"
                            : isAuthenticated
                              ? (plan.upgradeCta ?? `Choose ${plan.label}`)
                              : "Sign in to choose"}
                          {!checkout.isPending ? (
                            <ArrowRight
                              className="ml-2 h-4 w-4"
                              aria-hidden="true"
                            />
                          ) : null}
                        </Button>
                      ) : null}
                    </div>
                  </motion.article>
                );
              })}
            </section>
          )}

          <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-foreground/10 bg-background/45 p-5 text-center">
            <p className="text-sm font-semibold text-foreground">
              Candidate-pool participation stays available to Member accounts.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Match activates the work of searching and evaluating where
              compatible supply exists. It does not promise an introduction.
              Guided stays closed until human capacity and response limits are
              defined.
            </p>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
