import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetCompanion,
  getGetCompanionQueryKey,
  useSayToCompanion,
  useReviewMessageWithCompanion,
  useCompleteCompanionCommitment,
  useDismissCompanionObservation,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import type {
  CompanionObservation,
  CompanionCommitment,
} from "@workspace/api-client-react";
import {
  ArrowRight,
  Bell,
  Check,
  MessageSquare,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type EchoTurn = {
  role: "you" | "echo";
  text: string;
  followUp?: string;
  isFallback?: boolean;
};

type Tab = "talk" | "notices" | "review";

function severityClass(severity: CompanionObservation["severity"]): string {
  if (severity === "praise")
    return "border-[hsl(142_55%_45%/0.3)] bg-[hsl(142_55%_45%/0.06)]";
  if (severity === "challenge")
    return "border-[hsl(326_100%_60%/0.3)] bg-[hsl(326_100%_60%/0.06)]";
  return "border-foreground/10 bg-foreground/[0.03]";
}

/**
 * Echo, the one persistent companion, riding the corner of every signed-in app
 * page. It is a floating button that opens into a panel: talk to Echo, read the
 * notices it has made on its own, and have it react to a message you share. It
 * renders nothing for anonymous or still-loading users so it never shows an empty
 * shell, and every reply invalidates the shared matching-state query so the
 * readiness spine updates the moment Echo moves it.
 */
export function EchoPresence() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("talk");

  const { data } = useGetCompanion({
    query: {
      queryKey: getGetCompanionQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const say = useSayToCompanion();
  const review = useReviewMessageWithCompanion();
  const completeCommitment = useCompleteCompanionCommitment();
  const dismissObservation = useDismissCompanionObservation();

  const [turns, setTurns] = useState<EchoTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewDir, setReviewDir] =
    useState<"sending" | "received">("sending");

  if (!isAuthenticated || !data) return null;

  const unread = data.unreadCount ?? 0;

  function refresh(): void {
    qc.invalidateQueries({ queryKey: getGetCompanionQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  }

  async function send(message: string): Promise<void> {
    const m = message.trim();
    if (!m || say.isPending) return;
    setTurns((t) => [...t, { role: "you", text: m }]);
    setDraft("");
    try {
      const res = await say.mutateAsync({ data: { message: m } });
      setTurns((t) => [
        ...t,
        {
          role: "echo",
          text: res.answer,
          followUp: res.followUp,
          isFallback: res.isFallback,
        },
      ]);
      refresh();
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "echo",
          text: "I could not reach my deeper read just now. Try me again in a moment. Your signals are safe either way.",
        },
      ]);
    }
  }

  async function runReview(): Promise<void> {
    const t = reviewText.trim();
    if (!t || review.isPending) return;
    await review.mutateAsync({ data: { text: t, direction: reviewDir } });
  }

  async function markCommitmentDone(c: CompanionCommitment): Promise<void> {
    await completeCommitment.mutateAsync({ id: c.id });
    refresh();
  }

  async function dismiss(o: CompanionObservation): Promise<void> {
    await dismissObservation.mutateAsync({ id: o.id });
    refresh();
  }

  return (
    <>
      {/* Floating presence */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
          data-testid="echo-presence-button"
          aria-label="Open Echo"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Echo
          {unread > 0 && (
            <span
              className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#3D35CC]"
              data-testid="echo-unread-badge"
            >
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 flex max-h-[80vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-2xl"
          data-testid="echo-panel"
        >
          <div className="flex items-center justify-between border-b border-foreground/8 bg-gradient-to-br from-[hsl(248_62%_52%/0.08)] to-[hsl(326_100%_60%/0.08)] px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles
                  className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
                  aria-hidden="true"
                />
                {data.personaLabel}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Readiness {data.readinessScore} of {data.threshold}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/echo"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Open Echo's home"
                data-testid="echo-open-home"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Close Echo"
                data-testid="echo-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-foreground/8 text-xs font-medium">
            {(
              [
                ["talk", "Talk", MessageSquare],
                ["notices", "Notices", Bell],
                ["review", "Review", Target],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
                  tab === key
                    ? "border-b-2 border-[hsl(326_100%_60%)] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`echo-tab-${key}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
                {key === "notices" &&
                  (data.observations.length > 0 ||
                    data.commitments.length > 0) && (
                    <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">
                      {data.observations.length + data.commitments.length}
                    </span>
                  )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "talk" && (
              <div className="space-y-3">
                {turns.length === 0 && (
                  <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                    <p className="text-sm text-foreground">{data.greeting}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {data.read}
                    </p>
                    {data.challenge && (
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {data.challenge}
                      </p>
                    )}
                  </div>
                )}
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={t.role === "you" ? "text-right" : "text-left"}
                  >
                    <div
                      className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        t.role === "you"
                          ? "bg-foreground text-background"
                          : "border border-foreground/10 bg-foreground/[0.03] text-foreground"
                      }`}
                    >
                      {t.text}
                      {t.followUp && (
                        <button
                          type="button"
                          onClick={() => send(t.followUp as string)}
                          className="mt-2 block text-left text-[12px] font-medium text-[hsl(326_100%_45%)] underline-offset-2 hover:underline"
                        >
                          {t.followUp}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {say.isPending && (
                  <p className="text-xs text-muted-foreground">Echo is thinking...</p>
                )}
              </div>
            )}

            {tab === "notices" && (
              <div className="space-y-3">
                {data.commitments.length === 0 &&
                  data.observations.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Echo has not made any notes yet. The more you feed it, the
                      more it notices on its own.
                    </p>
                  )}
                {data.commitments.map((c) => (
                  <div
                    key={`c-${c.id}`}
                    className="flex items-start gap-2 rounded-xl border border-[hsl(326_100%_60%/0.25)] bg-[hsl(326_100%_60%/0.05)] p-3"
                    data-testid={`echo-commitment-${c.id}`}
                  >
                    <Target
                      className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(326_100%_50%)]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(326_100%_45%)]">
                        You told Echo you would
                      </p>
                      <p className="text-sm text-foreground">{c.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markCommitmentDone(c)}
                      className="shrink-0 rounded-lg border border-foreground/15 p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label="Mark done"
                      data-testid={`echo-commitment-done-${c.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {data.observations.map((o) => (
                  <div
                    key={`o-${o.id}`}
                    className={`flex items-start gap-2 rounded-xl border p-3 ${severityClass(o.severity)}`}
                    data-testid={`echo-observation-${o.id}`}
                  >
                    <p className="min-w-0 flex-1 text-sm text-foreground">
                      {o.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => dismiss(o)}
                      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Dismiss"
                      data-testid={`echo-observation-dismiss-${o.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === "review" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste one message and Echo will give you an honest read. Nothing
                  here is stored.
                </p>
                <div className="flex gap-2 text-xs">
                  {(["sending", "received"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setReviewDir(d)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 font-medium capitalize transition-colors ${
                        reviewDir === d
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/15 text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`echo-review-dir-${d}`}
                    >
                      {d === "sending" ? "I am sending" : "I received"}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Paste the message here"
                  className="w-full resize-none rounded-xl border border-foreground/15 bg-background p-3 text-sm focus:border-foreground/40 focus:outline-none"
                  data-testid="echo-review-input"
                />
                <button
                  type="button"
                  onClick={runReview}
                  disabled={review.isPending || !reviewText.trim()}
                  className="w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  data-testid="echo-review-submit"
                >
                  {review.isPending ? "Reading..." : "Get Echo's read"}
                </button>
                {review.data && (
                  <div className="space-y-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                    <p className="text-sm font-semibold text-foreground">
                      {review.data.verdict}
                    </p>
                    {review.data.strengths.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(142_55%_38%)]">
                          Working
                        </p>
                        <ul className="mt-0.5 list-disc pl-4 text-sm text-muted-foreground">
                          {review.data.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {review.data.risks.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(326_100%_45%)]">
                          Risks
                        </p>
                        <ul className="mt-0.5 list-disc pl-4 text-sm text-muted-foreground">
                          {review.data.risks.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm text-foreground">
                      {review.data.suggestion}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {tab === "talk" && (
            <div className="border-t border-foreground/8 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Tell Echo what is going on"
                  className="max-h-24 flex-1 resize-none rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                  data-testid="echo-talk-input"
                />
                <button
                  type="button"
                  onClick={() => send(draft)}
                  disabled={say.isPending || !draft.trim()}
                  className="shrink-0 rounded-xl bg-foreground p-2.5 text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  aria-label="Send to Echo"
                  data-testid="echo-talk-send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
