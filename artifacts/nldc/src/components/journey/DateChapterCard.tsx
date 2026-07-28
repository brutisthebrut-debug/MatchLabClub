import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarHeart, ShieldCheck, Sparkles } from "lucide-react";
import {
  hasPendingDate,
  markReflectionPending,
} from "@/lib/onboardingState";

export function DateChapterCard() {
  const [active] = useState(() => hasPendingDate());

  if (!active) return null;

  return (
    <section
      className="mb-5 rounded-[2rem] border border-[hsl(var(--brand-gold)/0.28)] bg-gradient-to-br from-[hsl(var(--brand-gold)/0.1)] via-card/95 to-[hsl(var(--brand-green)/0.07)] p-6 shadow-sm"
      data-testid="journey-date"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-gold))]">
        <CalendarHeart className="h-4 w-4" aria-hidden="true" />
        Chapter 7 of 8 · Date
      </p>
      <h2 className="mt-3 font-serif text-2xl font-bold text-foreground">
        Chemistry needs a room. Safety still gets a chair.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Talk here until trust feels earned. If you decide to meet, make a plan,
        tell someone you trust, and remember that a compatibility score cannot
        tell you how your nervous system feels beside a real person.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/date-safety"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
          data-testid="journey-date-safety"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Make a safety plan
        </Link>
        <Link
          href="/copilot/prep"
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Prepare with Echo
        </Link>
        <Link
          href="/reflection"
          onClick={markReflectionPending}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground"
          data-testid="journey-date-reflect"
        >
          Reflect afterward
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
