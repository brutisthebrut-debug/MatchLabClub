import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Flame, Sparkles } from "lucide-react";
import {
  useGetWellnessDaily,
  getGetWellnessDailyQueryKey,
  useCreateWellnessAnswer,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";

export function SignalOfTheDay() {
  const qc = useQueryClient();
  const { data } = useGetWellnessDaily({
    query: { queryKey: getGetWellnessDailyQueryKey() },
  });
  const create = useCreateWellnessAnswer();
  const [draft, setDraft] = useState("");

  if (!data) return null;

  const { question, streak, answeredToday, dimensionsCovered, dimensionsTotal } =
    data;

  async function submit(): Promise<void> {
    const answer = draft.trim();
    if (!question || !answer || create.isPending) return;
    await create.mutateAsync({
      data: {
        questionId: question.questionId,
        dimension: question.dimension,
        questionText: question.questionText,
        answer,
      },
    });
    setDraft("");
    qc.invalidateQueries({ queryKey: getGetWellnessDailyQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  }

  return (
    <section className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-[hsl(248_62%_52%/0.06)] to-[hsl(326_100%_60%/0.06)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles
            className="h-4 w-4 text-[hsl(326_100%_50%)]"
            aria-hidden="true"
          />
          Signal of the Day
        </h2>
        <span
          className="flex items-center gap-1.5 rounded-full border border-[hsl(326_100%_60%/0.25)] bg-background px-2.5 py-1 text-xs font-semibold text-foreground"
          data-testid="signal-streak"
        >
          <Flame
            className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
            aria-hidden="true"
          />
          {streak.current} day{streak.current === 1 ? "" : "s"}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        One question a day. Each answer teaches the machine a little more about you
        and lifts your match readiness. {dimensionsCovered} of {dimensionsTotal}{" "}
        areas covered so far.
      </p>

      {question ? (
        <div className="mt-4">
          <p
            className="text-base font-medium text-foreground"
            data-testid="signal-question"
          >
            {question.questionText}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {question.dimensionLabel}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Answer in your own words"
            className="mt-3 w-full resize-none rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm focus:border-foreground/40 focus:outline-none"
            data-testid="signal-input"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending || !draft.trim()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              data-testid="signal-save"
            >
              {create.isPending ? "Saving" : "Log it"}
            </button>
            {answeredToday && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Check
                  className="h-3.5 w-3.5 text-[hsl(150_60%_40%)]"
                  aria-hidden="true"
                />
                You have answered today. Keep going if you like.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-foreground/10 bg-background p-3 text-sm text-foreground">
          <Check
            className="h-4 w-4 text-[hsl(150_60%_40%)]"
            aria-hidden="true"
          />
          You have answered everything we ask for now. New questions arrive as we
          add them.
        </div>
      )}
    </section>
  );
}
