import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListWellnessInferences,
  getListWellnessInferencesQueryKey,
  useGenerateWellnessInferences,
  useConfirmWellnessInference,
  useDismissWellnessInference,
  getGetWellnessDailyQueryKey,
  getGetMatchingStateQueryKey,
  getGetCompanionQueryKey,
  getGetMyJourneySummaryQueryKey,
  type WellnessInference,
} from "@workspace/api-client-react";
import { DIMENSION_META } from "@/lib/wellnessQuestionBank";

function dimensionLabel(dimension: string): string {
  return DIMENSION_META[dimension]?.label ?? dimension.replace(/_/g, " ");
}

function sourceLabel(kind: string): string {
  if (kind === "journal") return "your journal";
  if (kind === "audit") return "your profile drafts";
  if (kind === "coach") return "your Echo message work";
  return "your own writing";
}

export function WellnessInferences() {
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const inferences = useListWellnessInferences({
    query: {
      queryKey: getListWellnessInferencesQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const generate = useGenerateWellnessInferences();
  const confirm = useConfirmWellnessInference();
  const dismiss = useDismissWellnessInference();

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pending = inferences.data?.inferences ?? [];

  const draftFor = (inf: WellnessInference): string =>
    drafts[inf.id] ?? inf.suggestedAnswer;

  function refreshLearningSurfaces(): void {
    qc.invalidateQueries({ queryKey: getListWellnessInferencesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCompanionQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWellnessDailyQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyJourneySummaryQueryKey() });
  }

  async function onGenerate(): Promise<void> {
    if (generate.isPending || !isAuthenticated) return;
    setActionError(null);
    try {
      await generate.mutateAsync();
      refreshLearningSurfaces();
    } catch {
      setActionError(
        "Echo could not check your writing just now. Nothing was saved. Try again in a moment.",
      );
    }
  }

  async function onConfirm(inf: WellnessInference): Promise<void> {
    if (confirm.isPending) return;
    const answer = draftFor(inf).trim();
    if (!answer) return;
    setActionError(null);
    setActiveId(inf.id);
    try {
      await confirm.mutateAsync({ id: inf.id, data: { answer } });
      setDrafts((current) => {
        const next = { ...current };
        delete next[inf.id];
        return next;
      });
      refreshLearningSurfaces();
    } catch {
      setActionError(
        "Echo could not save that learning. Your draft is still here, and nothing changed in your profile.",
      );
    } finally {
      setActiveId(null);
    }
  }

  async function onDismiss(inf: WellnessInference): Promise<void> {
    if (dismiss.isPending) return;
    setActionError(null);
    setActiveId(inf.id);
    try {
      await dismiss.mutateAsync({ id: inf.id });
      qc.invalidateQueries({ queryKey: getListWellnessInferencesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetCompanionQueryKey() });
    } catch {
      setActionError(
        "Echo could not set that learning aside. It remains tentative and has not changed your profile.",
      );
    } finally {
      setActiveId(null);
    }
  }

  if (authLoading || (isAuthenticated && inferences.isLoading)) {
    return (
      <section
        id="echo-learning"
        className="rounded-2xl border border-foreground/10 bg-background/60 p-5"
        data-testid="inferences-loading"
        aria-busy="true"
      >
        <div className="h-4 w-48 animate-pulse rounded bg-foreground/10" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-foreground/10" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-foreground/10" />
      </section>
    );
  }

  if (!isAuthenticated) return null;

  if (inferences.isError) {
    return (
      <section
        id="echo-learning"
        className="rounded-2xl border border-foreground/10 bg-background/60 p-5"
        data-testid="inferences-error"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Echo could not load its tentative learnings.
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing from your account is being replaced with sample data.
        </p>
        <button
          type="button"
          onClick={() => void inferences.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-semibold text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section
      id="echo-learning"
      className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-[hsl(248_62%_52%/0.05)] to-[hsl(326_100%_60%/0.05)] p-5"
      data-testid="wellness-inferences"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles
              className="h-4 w-4 text-[hsl(326_100%_50%)]"
              aria-hidden="true"
            />
            Check what Echo thinks it learned
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            I look only at writing you chose to share. Every pattern stays
            tentative until you confirm it, correct it in your own words, or set
            it aside.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generate.isPending}
          className="shrink-0 rounded-full border border-[hsl(326_100%_60%/0.3)] bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.03] disabled:opacity-50"
          data-testid="inferences-generate"
        >
          {generate.isPending ? "Looking" : "Look for a pattern"}
        </button>
      </div>

      {actionError && (
        <p
          className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {pending.length === 0 ? (
        <p
          className="mt-4 flex items-center gap-2 rounded-xl border border-foreground/10 bg-background p-3 text-xs text-muted-foreground"
          data-testid="inferences-empty"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Nothing is waiting for your review. When you have shared enough
          writing, Echo can look for one grounded pattern without saving it as
          truth.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {pending.map((inf) => {
            const busy = activeId === inf.id;
            const draft = draftFor(inf);
            const corrected = draft.trim() !== inf.suggestedAnswer.trim();
            return (
              <div
                key={inf.id}
                className="rounded-xl border border-foreground/10 bg-background p-4"
                data-testid={`inference-${inf.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {dimensionLabel(inf.dimension)}
                  </p>
                  <span className="rounded-full border border-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Tentative
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-medium text-foreground">
                  {inf.questionText}
                </p>

                <textarea
                  value={draft}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [inf.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={5000}
                  className="mt-2 w-full resize-none rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                  data-testid={`inference-input-${inf.id}`}
                />

                <p className="mt-2 text-[11px] text-muted-foreground">
                  Drawn from {sourceLabel(inf.sourceKind)}. Saving this writes
                  your confirmed wording into your profile evidence and Journey.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirm(inf)}
                    disabled={confirm.isPending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    data-testid={`inference-confirm-${inf.id}`}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy && confirm.isPending
                      ? "Saving"
                      : corrected
                        ? "Save my correction"
                        : "Yes, this is me"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(inf)}
                    disabled={dismiss.isPending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    data-testid={`inference-dismiss-${inf.id}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy && dismiss.isPending
                      ? "Setting aside"
                      : "No, set it aside"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
