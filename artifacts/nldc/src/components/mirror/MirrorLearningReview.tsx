import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideMirrorLearning,
  listMirrorLearnings,
  syncMirrorLearnings,
  type MirrorLearning,
  type MirrorLearningDecision,
} from "@/lib/mirrorLearnings";

export function MirrorLearningReview({
  canSync,
}: {
  canSync: boolean;
}) {
  const [learnings, setLearnings] = useState<MirrorLearning[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let active = true;
    listMirrorLearnings()
      .then((result) => { if (active) setLearnings(result.learnings); })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => {
      listMirrorLearnings()
        .then((result) => setLearnings(result.learnings))
        .catch((err: Error) => setError(err.message));
    };
    window.addEventListener("mirror-learning-updated", refresh);
    return () => window.removeEventListener("mirror-learning-updated", refresh);
  }, []);

  const counts = useMemo(
    () => ({
      proposed: learnings.filter((item) => item.status === "proposed").length,
      confirmed: learnings.filter((item) => item.status === "confirmed").length,
    }),
    [learnings],
  );

  async function sync() {
    setBusyId("sync");
    setError(null);
    try {
      setLearnings((await syncMirrorLearnings()).learnings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function decide(id: number, decision: MirrorLearningDecision) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await decideMirrorLearning(id, decision);
      setLearnings((items) => items.map((item) => item.id === id ? updated : item));
      setEditingId(null);
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="mirror-learning" className="rounded-[2rem] border border-foreground/10 bg-background/72 p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            Confirmed learning
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold">You decide what becomes true here.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Echo can propose a learning from visible evidence. You can confirm,
            correct, or dismiss it. Matching use is a separate choice after confirmation.
          </p>
        </div>
        <Button variant="outline" onClick={sync} disabled={!canSync || busyId !== null}>
          {busyId === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Review current themes
        </Button>
      </div>

      <div className="mt-5 flex gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded-full bg-amber-500/10 px-3 py-1">{counts.proposed} proposed</span>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1">{counts.confirmed} confirmed</span>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error} No prior learning was replaced.
        </div>
      )}
      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your decisions
        </div>
      ) : learnings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 p-5 text-sm leading-6 text-muted-foreground">
          Nothing has been proposed yet. Once Echo has a grounded working theme,
          review it here. No learning is confirmed automatically.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {learnings.map((item) => (
            <article key={item.id} className="rounded-2xl border border-foreground/10 bg-background/58 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.source.label}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Observed: {item.observation}</p>
                </div>
                <span className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-bold capitalize">{item.status}</span>
              </div>

              <p className="mt-4 font-serif text-xl font-bold leading-snug">
                {item.memberLearning ?? item.proposedLearning}
              </p>

              {editingId === item.id ? (
                <div className="mt-4 space-y-3">
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={draft.trim().length < 3 || busyId !== null} onClick={() => decide(item.id, { action: "revise", learning: draft.trim() })}>Save correction for review</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">A correction returns to proposed. If this learning was approved for matching, candidacy pauses until you review your choices.</p>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.status === "proposed" && (
                    <Button size="sm" disabled={busyId !== null} onClick={() => decide(item.id, { action: "confirm" })}>
                      <Check className="mr-1.5 h-4 w-4" /> Confirm for me
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => { setEditingId(item.id); setDraft(item.memberLearning ?? item.proposedLearning); }}>
                    <Edit3 className="mr-1.5 h-4 w-4" /> Correct
                  </Button>
                  {item.status === "proposed" && (
                    <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => decide(item.id, { action: "dismiss" })}>
                      <X className="mr-1.5 h-4 w-4" /> Not true for me
                    </Button>
                  )}
                  {item.status === "dismissed" && (
                    <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => decide(item.id, { action: "revise", learning: item.proposedLearning })}>Reopen for review</Button>
                  )}
                  {item.status === "confirmed" && (
                    <>
                      <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => decide(item.id, { action: "unconfirm" })}>Return to review</Button>
                      <Button size="sm" variant={item.matchingUseApproved ? "default" : "outline"} disabled={busyId !== null} onClick={() => decide(item.id, { action: "set_matching", approved: !item.matchingUseApproved })}>
                        {item.matchingUseApproved ? "Matching use approved" : "Allow for matching"}
                      </Button>
                    </>
                  )}
                </div>
              )}
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Source: {item.source.type.replaceAll("_", " ")} · evidence confidence {item.confidence}% · matching use {item.matchingUseApproved ? "allowed" : "not allowed"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
