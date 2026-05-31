import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Eye } from "lucide-react";
import { NextBestActionCoach } from "@/components/coach/NextBestActionCoach";

export type HandoffStep = {
  label: string;
  href: string;
  desc?: string;
};

/**
 * Shared "next best step" handoff shown at the end of every tool result so the
 * user always has a forward path and can see how the tool fed their readiness.
 * Every handoff leads back to Your Mirror, the model of you that this signal
 * just sharpened, so the spine stays visible from every tool. No dead ends:
 * the trail keeps climbing toward matching.
 */
export function ToolHandoff({
  fedLine,
  steps,
  mirrorHref = "/your-mirror",
  testId = "tool-handoff",
}: {
  fedLine: string;
  steps: HandoffStep[];
  mirrorHref?: string;
  testId?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl p-6 md:p-7 border border-[hsl(326_100%_60%/0.2)] bg-gradient-to-br from-[hsl(248_62%_52%/0.07)] to-[hsl(326_100%_60%/0.07)]"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-[hsl(326_100%_55%)]" aria-hidden="true" />
        <span className="text-xs uppercase tracking-widest font-bold text-[hsl(326_100%_45%)]">Next best step</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{fedLine}</p>
      <NextBestActionCoach
        variant="panel"
        className="mb-3"
        testId={`${testId}-coach`}
      />
      <Link
        href={mirrorHref}
        className="group mb-3 flex items-center gap-3 rounded-2xl border border-[hsl(248_62%_52%/0.3)] bg-background/50 p-4 transition-colors hover:border-[hsl(248_62%_52%/0.5)]"
        data-testid={`${testId}-mirror`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(248_62%_52%/0.12)]">
          <Eye className="h-4.5 w-4.5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">See your next signal in Your Mirror</span>
          <span className="block text-xs text-muted-foreground leading-relaxed">
            The model of you, what it can see and the one move that sharpens it next.
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(248_62%_52%)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.href + step.label}
            href={step.href}
            className="group rounded-2xl border border-foreground/10 bg-background/40 p-4 transition-colors hover:border-foreground/25"
            data-testid={`${testId}-step`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground text-sm">{step.label}</span>
              <ArrowRight className="h-4 w-4 text-[hsl(248_62%_52%)] flex-shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            {step.desc ? (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
