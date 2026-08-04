import { useState } from "react";
import { PLAYBOOK, type PlaybookEntry } from "@workspace/echo";
import { useAskFounderCopilot } from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleFromId(id: string): string {
  return id
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

function PlaybookCard({ entry }: { entry: PlaybookEntry }) {
  return (
    <div
      className="glass rounded-2xl p-5 space-y-3"
      data-testid={`echo-playbook-card-${entry.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-serif font-bold text-base text-foreground leading-tight">
          {titleFromId(entry.id)}
        </h3>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60">
          {formatDate(entry.date)}
        </span>
      </div>
      <p className="text-sm text-foreground/85 leading-relaxed">{entry.decision}</p>
      <div className="pt-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] italic bg-white/5 border border-white/10 text-muted-foreground/80">
          <span className="font-semibold not-italic text-muted-foreground/60">
            Revisit when:
          </span>
          <span className="italic">{entry.revisitWhen}</span>
        </span>
      </div>
    </div>
  );
}

function AskEchoSection() {
  const [question, setQuestion] = useState("");
  const [contextHint, setContextHint] = useState("");
  const mutation = useAskFounderCopilot();

  const answer = mutation.data?.answer ?? null;
  const isFallback = Boolean(mutation.data?.fallback);
  const isPending = mutation.isPending;
  const canSubmit = question.trim().length >= 4 && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const trimmedHint = contextHint.trim();
    mutation.mutate({
      data: {
        question: question.trim(),
        ...(trimmedHint.length > 0 ? { contextHint: trimmedHint } : {}),
      },
    });
  };

  const handleReset = () => {
    setQuestion("");
    setContextHint("");
    mutation.reset();
  };

  return (
    <div className="space-y-3" data-testid="echo-ask-section">
      <div className="space-y-1">
        <h3 className="font-serif font-bold text-base text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-foreground/70" aria-hidden />
          Ask Echo
        </h3>
        <p className="text-xs text-muted-foreground/70">
          Free-form strategic question. Echo answers in voice, using the playbook below as reference.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should I do about..."
          rows={3}
          maxLength={2000}
          disabled={isPending}
          data-testid="echo-ask-question"
          className="bg-white/5 border-white/10"
        />
        <Textarea
          value={contextHint}
          onChange={(e) => setContextHint(e.target.value)}
          placeholder="Optional context (a specific signup, a metric, a moment)"
          rows={2}
          maxLength={1000}
          disabled={isPending}
          data-testid="echo-ask-context"
          className="bg-white/5 border-white/10 text-sm"
        />
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={!canSubmit}
            data-testid="echo-ask-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />
                Thinking...
              </>
            ) : (
              "Ask"
            )}
          </Button>
          {mutation.isError ? (
            <span className="text-xs text-red-400" data-testid="echo-ask-error">
              Something went wrong. Try again in a moment.
            </span>
          ) : null}
        </div>
      </form>
      {answer ? (
        <div
          className="glass rounded-2xl p-5 space-y-3"
          data-testid="echo-ask-answer"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground/70">
              <Sparkles className="w-3 h-3" aria-hidden />
              Echo
            </span>
            {isFallback ? (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-300"
                data-testid="echo-ask-fallback-pill"
              >
                fell back to playbook
              </span>
            ) : null}
          </div>
          <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif">
            {answer}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-muted-foreground/70 hover:text-foreground underline-offset-2 hover:underline"
            data-testid="echo-ask-reset"
          >
            ask another
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function EchoPlaybookPanel() {
  return (
    <section className="space-y-6" data-testid="echo-playbook-panel">
      <div className="space-y-1">
        <h2 className="font-serif font-bold text-xl text-foreground">Echo's playbook</h2>
        <p className="text-sm text-muted-foreground/70">
          The strategic decisions on the table right now.
        </p>
      </div>
      <AskEchoSection />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLAYBOOK.map((entry) => (
          <PlaybookCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
