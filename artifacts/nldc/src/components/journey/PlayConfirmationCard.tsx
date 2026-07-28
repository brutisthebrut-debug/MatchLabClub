import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetMatchingStateQueryKey,
  getGetMirrorPortraitQueryKey,
  getGetMySignalMapQueryKey,
  getListWellnessAnswersQueryKey,
  useCreateWellnessAnswer,
  useUpdateWellnessAnswerPermissions,
} from "@workspace/api-client-react";
import {
  clearPendingPlayRead,
  markWaitingPending,
  readPendingPlayRead,
} from "@/lib/onboardingState";

export function PlayConfirmationCard() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const createAnswer = useCreateWellnessAnswer();
  const updatePermissions = useUpdateWellnessAnswerPermissions();
  const [pending, setPending] = useState(() => readPendingPlayRead());
  const [allowMatching, setAllowMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!pending && !confirmed) return null;

  if (confirmed) {
    return (
      <section
        className="mb-8 rounded-[2rem] border border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green)/0.08)] p-6 shadow-sm md:p-8"
        data-testid="play-confirmation-complete"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-green))]">
          Confirmed
        </p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Good. Your word outranks the quiz.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The read is now in your Mirror. Next, I will show you what waiting
              for a considered introduction actually looks like.
            </p>
          </div>
          <Link
            href="/matching"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background"
            data-testid="play-confirmation-next"
          >
            Go to matching
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  if (!pending) return null;

  const busy = createAnswer.isPending || updatePermissions.isPending;

  async function confirm(): Promise<void> {
    if (!pending || !isAuthenticated || busy) return;
    setError(null);
    try {
      const answer = await createAnswer.mutateAsync({
        data: {
          questionId: "quiz:dating-signal-type",
          dimension: "emotional",
          category: "dating_style",
          questionText: "Which Dating Signal Type feels most like me?",
          answer: `${pending.archetypeName}: ${pending.summary}`,
        },
      });
      await updatePermissions.mutateAsync({
        id: answer.id,
        data: {
          echo: true,
          mirror: true,
          matching: allowMatching,
        },
      });
      clearPendingPlayRead();
      markWaitingPending();
      setPending(null);
      setConfirmed(true);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListWellnessAnswersQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMirrorPortraitQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMySignalMapQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMatchingStateQueryKey(),
        }),
      ]);
    } catch {
      setError("I could not save that confirmation. Nothing changed—try again.");
    }
  }

  function dismiss(): void {
    clearPendingPlayRead();
    setPending(null);
  }

  return (
    <section
      className="mb-8 overflow-hidden rounded-[2rem] border border-[hsl(var(--brand-gold)/0.3)] bg-gradient-to-br from-[hsl(var(--brand-gold)/0.1)] via-card/95 to-[hsl(var(--brand-pink)/0.08)] p-6 shadow-lg md:p-8"
      data-testid="play-confirmation"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-indigo))]">
        Chapter 4 of 8 · Confirm
      </p>
      <div className="mt-3 grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
            Does this actually sound like you?
          </h2>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {pending.archetypeName}
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {pending.summary}
          </p>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            This is a derived read, not your raw quiz answers. It stays out of
            your Mirror and matching until you choose below.
          </p>

          <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-3 rounded-2xl border border-foreground/10 bg-background/70 p-4">
            <input
              type="checkbox"
              checked={allowMatching}
              onChange={(event) => setAllowMatching(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--brand-indigo))]"
              data-testid="play-confirmation-matching"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Also allow this read to inform matching
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Optional. Confirming the Mirror read does not turn matching use
                on by itself.
              </span>
            </span>
          </label>

          {error ? (
            <p className="mt-3 text-xs font-semibold text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={!isAuthenticated || busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-opacity disabled:opacity-50"
            data-testid="play-confirmation-keep"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving" : "Yes, keep this read"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/15 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            data-testid="play-confirmation-dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Not quite
          </button>
        </div>
      </div>
    </section>
  );
}
