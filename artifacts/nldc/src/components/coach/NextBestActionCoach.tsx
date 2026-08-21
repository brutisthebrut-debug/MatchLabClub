import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Compass, CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  type ReadinessNextAction,
} from "@workspace/api-client-react";

export type NextBestActionCoachVariant = "card" | "panel";

/**
 * The single highest-value move the user can make this week, in a coach voice.
 * One source of truth (matching-state `nextActions`) feeds every surface, so
 * Home, Your Mirror, and every tool handoff recommend the same thing. Because
 * every tool invalidates the matching-state query key, finishing the action
 * refreshes this card to the next best one on its own, and the readiness reward
 * watcher celebrates the gain.
 */

interface NextBestActionCoachViewProps {
  action: ReadinessNextAction | null;
  eligible: boolean;
  variant?: NextBestActionCoachVariant;
  className?: string;
  testId?: string;
}

const COACH_EYEBROW = "Echo's suggestion";

export function NextBestActionCoachView({
  action,
  eligible,
  variant = "card",
  className,
  testId = "next-best-action",
}: NextBestActionCoachViewProps) {
  // Nothing to recommend and no qualitative review state: stay quiet rather
  // than show an empty shell. This is also the anonymous and loading state.
  if (!action && !eligible) return null;

  const isPanel = variant === "panel";
  const shell = isPanel
    ? "rounded-2xl border border-[hsl(326_100%_60%/0.25)] bg-background/50 p-4"
    : "rounded-3xl border border-[hsl(326_100%_60%/0.2)] bg-gradient-to-br from-[hsl(248_62%_52%/0.07)] to-[hsl(326_100%_60%/0.07)] p-6 md:p-7";
  const shellClass = className ? `${shell} ${className}` : shell;

  const Eyebrow = (
    <div className="mb-2 flex items-center gap-2">
      <Sparkles
        className="h-4 w-4 text-[hsl(326_100%_55%)]"
        aria-hidden="true"
      />
      <span className="text-xs font-bold uppercase tracking-widest text-[hsl(326_100%_45%)]">
        {COACH_EYEBROW}
      </span>
    </div>
  );

  // Profile evidence is broad enough for a review. This never implies that
  // matching access, market availability, or another person has been earned.
  if (!action) {
    return (
      <div className={shellClass} data-testid={testId}>
        {Eyebrow}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(142_55%_45%/0.12)]">
              <CheckCircle2
                className="h-5 w-5 text-[hsl(142_55%_42%)]"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="font-serif text-lg font-semibold text-foreground">
                Echo has enough for a real profile read
              </p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                I can explain what I see and what remains uncertain. This does
                not promise a match or change who is available.
              </p>
            </div>
          </div>
          <Link
            href="/echo"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:translate-x-0.5"
            data-testid={`${testId}-cta`}
          >
            Talk with Echo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} data-testid={testId}>
      {Eyebrow}
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        One focused move. This would replace one of Echo's guesses with
        member-confirmed evidence.
      </p>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(248_62%_52%/0.12)]">
            <Compass
              className="h-5 w-5 text-[hsl(248_62%_52%)]"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-serif text-lg font-semibold text-foreground">
                {action.label}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {action.detail}
            </p>
          </div>
        </div>
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:translate-x-0.5"
          data-testid={`${testId}-cta`}
        >
          Start
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

interface NextBestActionCoachProps {
  /**
   * Controlled mode: pass the action and eligibility a parent already has (Home
   * and Your Mirror). Omit both to let the card self-fetch matching state, which
   * is what the tool handoff uses so it is drop-in on every tool page.
   */
  action?: ReadinessNextAction | null;
  eligible?: boolean;
  variant?: NextBestActionCoachVariant;
  animate?: boolean;
  className?: string;
  testId?: string;
}

export function NextBestActionCoach({
  action,
  eligible,
  variant = "card",
  animate = false,
  className,
  testId,
}: NextBestActionCoachProps) {
  const controlled = action !== undefined;
  const { isAuthenticated } = useAuth();

  const matchingState = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated && !controlled,
    },
  });

  const resolvedAction = controlled
    ? action
    : (matchingState.data?.nextActions?.[0] ?? null);
  const resolvedEligible =
    eligible ?? (controlled ? false : (matchingState.data?.eligible ?? false));

  const view = (
    <NextBestActionCoachView
      action={resolvedAction}
      eligible={resolvedEligible}
      variant={variant}
      className={className}
      testId={testId}
    />
  );

  if (!animate) return view;
  // Only the standalone surfaces animate in; inside a handoff the parent already
  // animates, so a nested motion wrapper would double up.
  if (!resolvedAction && !resolvedEligible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {view}
    </motion.div>
  );
}
