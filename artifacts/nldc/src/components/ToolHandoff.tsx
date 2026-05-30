import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";

export type HandoffStep = {
  label: string;
  href: string;
  desc?: string;
};

/**
 * Shared "next best step" handoff shown at the end of every tool result so the
 * user always has a forward path and can see how the tool fed their readiness.
 * No dead ends: the trail keeps climbing toward matching.
 */
export function ToolHandoff({
  fedLine,
  steps,
  testId = "tool-handoff",
}: {
  fedLine: string;
  steps: HandoffStep[];
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
