import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, FileSearch, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMirrorTrends, type MirrorTrendReport } from "@/lib/mirrorTrends";

const ACTION_LABELS: Record<string, string> = {
  proposed: "Proposed for review",
  source_refreshed: "Source evidence refreshed",
  confirm: "Confirmed by you",
  revise: "Corrected and returned to review",
  dismiss: "Dismissed by you",
  unconfirm: "Returned to review",
  matching_approved: "Approved for matching use",
  matching_revoked: "Matching use removed",
  source_removed: "Source removed",
};

export function MirrorTrends() {
  const [report, setReport] = useState<MirrorTrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    void getMirrorTrends()
      .then(setReport)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    window.addEventListener("mirror-learning-updated", load);
    return () => window.removeEventListener("mirror-learning-updated", load);
  }, []);

  return (
    <section className="rounded-[2rem] border border-foreground/10 bg-background/72 p-5 shadow-sm sm:p-7">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_52%)]">
        <Clock3 className="h-4 w-4" /> Changes over time
      </p>
      <h2 className="mt-2 font-serif text-2xl font-bold">What is becoming clearer, and what is not.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Every item stays tied to its source. Low-confidence proposals and possible tensions remain visible instead of being flattened into a score.
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading change history</div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          {error}
          <Button className="ml-3" size="sm" variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </div>
      ) : report ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
            <p className="font-bold">{report.summary.headline}</p>
            <p className="mt-2 text-sm text-muted-foreground">{report.summary.confirmed} confirmed · {report.summary.inReview} in review · {report.summary.dismissed} dismissed</p>
          </div>

          {report.sources.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 font-bold"><FileSearch className="h-4 w-4" /> Current source map</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {report.sources.map((item) => (
                  <article key={item.learningId} className="rounded-2xl border border-foreground/10 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-[hsl(248_62%_52%)]">{item.source.label}</span>
                      <span className="text-muted-foreground">{item.confidence}% source confidence</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{item.status === "confirmed" ? "Member-confirmed" : "Still in review"}{item.matchingUseApproved ? " · separately approved for matching" : ""}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {report.uncertainties.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-4">
              <h3 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Still uncertain</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {report.uncertainties.map((item) => <li key={item.learningId}><strong className="text-foreground">{item.sourceLabel}:</strong> {item.reason} ({item.confidence}% confidence)</li>)}
              </ul>
            </div>
          )}

          {report.contradictions.length > 0 && (
            <div className="rounded-2xl border border-[hsl(326_100%_50%/0.2)] bg-[hsl(326_100%_50%/0.05)] p-4">
              <h3 className="font-bold">Possible tensions to review</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">These may both be true in different contexts. They are questions, not errors.</p>
              <div className="mt-3 space-y-3">
                {report.contradictions.map((item) => (
                  <article key={`${item.label}-${item.left.learningId}-${item.right.learningId}`} className="rounded-xl border border-foreground/10 bg-background/70 p-3 text-sm">
                    <p className="font-bold">{item.label}</p>
                    <p className="mt-2 text-muted-foreground">{item.left.sourceLabel}: {item.left.text}</p>
                    <p className="mt-1 text-muted-foreground">{item.right.sourceLabel}: {item.right.text}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {report.changes.length > 0 && (
            <div>
              <h3 className="font-bold">Recent member-governed changes</h3>
              <ol className="mt-3 space-y-2">
                {report.changes.slice(0, 8).map((change) => (
                  <li key={change.id} className="rounded-xl border border-foreground/10 p-3 text-sm">
                    <span className="font-bold">{ACTION_LABELS[change.action] ?? change.action}</span>
                    <span className="text-muted-foreground"> · {change.source.label}{change.createdAt ? ` · ${new Date(change.createdAt).toLocaleDateString()}` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
