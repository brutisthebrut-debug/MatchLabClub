import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, HeartHandshake, Hourglass } from "lucide-react";
import type { MatchProposal } from "@workspace/api-client-react";
import {
  clearPendingWaiting,
  hasPendingWaiting,
  markIntroductionPending,
} from "@/lib/onboardingState";

type WaitingIntroductionCardProps = {
  eligible: boolean;
  poolStatus: string;
  proposals: MatchProposal[];
};

export function WaitingIntroductionCard({
  eligible,
  poolStatus,
  proposals,
}: WaitingIntroductionCardProps) {
  const [journeyActive] = useState(() => hasPendingWaiting());
  const mutual = proposals.some(
    (proposal) =>
      proposal.status === "mutual_yes" || proposal.status === "completed",
  );
  const openProposal = proposals.some(
    (proposal) => proposal.status === "proposed",
  );

  useEffect(() => {
    if (!journeyActive || !mutual) return;
    clearPendingWaiting();
    markIntroductionPending();
  }, [journeyActive, mutual]);

  if (!journeyActive) return null;

  if (mutual) {
    return (
      <section
        className="mb-6 rounded-[2rem] border border-[hsl(var(--brand-pink)/0.3)] bg-gradient-to-br from-[hsl(var(--brand-indigo)/0.12)] via-card/95 to-[hsl(var(--brand-pink)/0.1)] p-6 shadow-lg md:p-8"
        data-testid="journey-introduction-ready"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-pink))]">
          Chapter 6 of 8 · Introduction
        </p>
        <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
              You both said yes. Now you meet the person, not the score.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Compatibility opened the door. It is not a verdict, a promise, or
              permission to skip consent. Your conversation is ready.
            </p>
          </div>
          <Link
            href="/matches"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 py-2.5 text-sm font-bold text-white"
            data-testid="journey-introduction-open"
          >
            Open the introduction
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const poolOn = poolStatus !== "off" && poolStatus !== "paused";
  const headline = openProposal
    ? "A considered introduction is waiting for your decision."
    : poolOn
      ? "You are in. Waiting is part of considered matching."
      : eligible
        ? "You are ready. You decide when matching begins."
        : "There is no introduction yet—and I will not fake one.";
  const detail = openProposal
    ? "Read the introduction below. Interest from one person never opens a conversation; both people must choose yes."
    : poolOn
      ? "This is not an infinite deck. MatchLab waits for a person worth interrupting your life for, and local pool depth affects how long that takes."
      : eligible
        ? "Turn on the matching list when you want to be considered. Until then, your Mirror stays yours."
        : "Keep sharpening the signals you choose to share. Readiness helps me avoid throwing strangers at you just to make the screen feel busy.";

  return (
    <section
      className="mb-6 rounded-[2rem] border border-[hsl(var(--brand-indigo)/0.24)] bg-[hsl(var(--brand-indigo)/0.07)] p-6 shadow-sm md:p-8"
      data-testid="journey-waiting"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-indigo))]">
        <Hourglass className="h-4 w-4" aria-hidden="true" />
        Chapter 5 of 8 · Waiting
      </p>
      <h2 className="mt-3 font-serif text-2xl font-bold text-foreground md:text-3xl">
        {headline}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
      {openProposal ? (
        <a
          href="#match-track"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background"
          data-testid="journey-waiting-review"
        >
          <HeartHandshake className="h-4 w-4" aria-hidden="true" />
          Review the introduction
        </a>
      ) : null}
    </section>
  );
}
