import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListWellnessInferences,
  getListWellnessInferencesQueryKey,
  useGenerateWellnessInferences,
  useConfirmWellnessInference,
  useDismissWellnessInference,
  getGetWellnessDailyQueryKey,
  getGetMatchingStateQueryKey,
  type WellnessInference,
} from "@workspace/api-client-react";
import { DIMENSION_META } from "@/lib/wellnessQuestionBank";

const DEMO_INFERENCES: WellnessInference[] = [
  {
    id: -1,
    dimension: "emotional",
    inferredQuestionId: "inferred:emotional:1",
    questionText: "What helps you feel emotionally safe with someone?",
    suggestedAnswer:
      "I feel safest when someone is steady and gives me room to explain myself in my own time.",
    sourceKind: "journal",
    rationale: "Noticed in your journal writing.",
    mode: "deterministic",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: -2,
    dimension: "physical",
    inferredQuestionId: "inferred:physical:1",
    questionText: "What physical habits make you feel your best?",
    suggestedAnswer:
      "I feel most grounded on the days I get outside and move, even a short walk resets me.",
    sourceKind: "coach",
    rationale: "Noticed in your message coach notes.",
    mode: "deterministic",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function dimensionLabel(dimension: string): string {
  return DIMENSION_META[dimension]?.label ?? dimension.replace(/_/g, " ");
}

function sourceLabel(kind: string): string {
  if (kind === "journal") return "your journal";
  if (kind === "audit") return "your profile drafts";
  if (kind === "coach") return "your message coach notes";
  return "your own writing";
}

export function WellnessInferences() {
  const qc = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  const { data } = useListWellnessInferences({
    query: {
      queryKey: getListWellnessInferencesQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const generate = useGenerateWellnessInferences();
  const confirm = useConfirmWellnessInference();
  const dismiss = useDismissWellnessInference();

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<number | null>(null);

  const pending = data?.inferences ?? [];
  const isAnon = !isAuthenticated && !isLoading;
  const showDemo = isAnon || pending.length === 0;
  const cards = showDemo ? DEMO_INFERENCES : pending;

  const draftFor = (inf: WellnessInference): string =>
    drafts[inf.id] ?? inf.suggestedAnswer;

  async function onGenerate(): Promise<void> {
    if (generate.isPending || isAnon) return;
    await generate.mutateAsync();
    qc.invalidateQueries({ queryKey: getListWellnessInferencesQueryKey() });
  }

  async function onConfirm(inf: WellnessInference): Promise<void> {
    if (confirm.isPending) return;
    const answer = draftFor(inf).trim();
    if (!answer) return;
    setActiveId(inf.id);
    try {
      await confirm.mutateAsync({ id: inf.id, data: { answer } });
      qc.invalidateQueries({ queryKey: getListWellnessInferencesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWellnessDailyQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } finally {
      setActiveId(null);
    }
  }

  async function onDismiss(inf: WellnessInference): Promise<void> {
    if (dismiss.isPending) return;
    setActiveId(inf.id);
    try {
      await dismiss.mutateAsync({ id: inf.id });
      qc.invalidateQueries({ queryKey: getListWellnessInferencesQueryKey() });
    } finally {
      setActiveId(null);
    }
  }

  return (
    <section
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
            Quiet observations
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            We read only your own writing, your journal, profile drafts, and
            message coach notes, and draft a few reflections. Nothing is saved
            until you say it is right. Edit it, confirm it, or set it aside.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generate.isPending || isAnon}
          className="shrink-0 rounded-full border border-[hsl(326_100%_60%/0.3)] bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.03] disabled:opacity-50"
          data-testid="inferences-generate"
        >
          {generate.isPending ? "Looking" : "Look for reflections"}
        </button>
      </div>

      {showDemo && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-foreground/10 bg-background p-3 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          {isAnon
            ? "Sign in and write a little, then the machine can draft reflections like these for you to confirm."
            : "Nothing waiting right now. Examples are shown below. Once you have written in your journal, profile, or message coach, look for reflections."}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {cards.map((inf) => {
          const isExample = showDemo;
          const busy = activeId === inf.id;
          return (
            <div
              key={inf.id}
              className="rounded-xl border border-foreground/10 bg-background p-4"
              data-testid={isExample ? "inference-example" : `inference-${inf.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {dimensionLabel(inf.dimension)}
                </p>
                <span className="rounded-full border border-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {inf.mode === "anthropic" ? "Deep AI read" : "Pattern read"}
                </span>
              </div>

              <p className="mt-1.5 text-sm font-medium text-foreground">
                {inf.questionText}
              </p>

              {isExample ? (
                <p className="mt-2 rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.02] px-3 py-2 text-sm text-muted-foreground">
                  {inf.suggestedAnswer}
                </p>
              ) : (
                <textarea
                  value={draftFor(inf)}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [inf.id]: e.target.value }))
                  }
                  rows={3}
                  maxLength={5000}
                  className="mt-2 w-full resize-none rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                  data-testid={`inference-input-${inf.id}`}
                />
              )}

              <p className="mt-2 text-[11px] text-muted-foreground">
                Drawn from {sourceLabel(inf.sourceKind)}. You can change the
                wording before you keep it.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm(inf)}
                  disabled={isExample || confirm.isPending || !draftFor(inf).trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  data-testid={isExample ? undefined : `inference-confirm-${inf.id}`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {busy && confirm.isPending ? "Saving" : "This is me"}
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(inf)}
                  disabled={isExample || dismiss.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  data-testid={isExample ? undefined : `inference-dismiss-${inf.id}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Not quite
                </button>
                {isExample && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Example
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
