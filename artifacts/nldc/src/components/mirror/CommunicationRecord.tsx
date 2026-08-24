import { useEffect, useState } from "react";
import { ArrowRight, HeartHandshake, Loader2, MessagesSquare, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { flagLabel } from "@/lib/flags";
import { proposeCommunicationLearning } from "@/lib/mirrorLearnings";

interface CareDialectState {
  hasProfile: boolean;
  isDemo: boolean;
  testedGiveTop: string | null;
  testedReceiveTop: string | null;
}

interface FlagState {
  bringFlags: string[];
  seekFlags: string[];
}

const DIALECT_LABELS: Record<string, string> = {
  spokenWarmth: "Spoken Warmth",
  helpingHands: "Helping Hands",
  thoughtfulTokens: "Thoughtful Tokens",
  undividedTime: "Undivided Time",
  closeContact: "Close Contact",
  steadyPresence: "Steady Presence",
};

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("Your communication record could not load.");
  return response.json() as Promise<T>;
}

export function CommunicationRecord() {
  const [care, setCare] = useState<CareDialectState | null>(null);
  const [flags, setFlags] = useState<FlagState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"care_dialect" | "standards" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadJson<CareDialectState>("/me/care-dialect"),
      loadJson<FlagState>("/me/flags"),
    ])
      .then(([careResult, flagResult]) => {
        setCare(careResult.isDemo ? null : careResult);
        setFlags(flagResult);
      })
      .catch((err: Error) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function propose(source: "care_dialect" | "standards") {
    setBusy(source);
    setMessage(null);
    try {
      await proposeCommunicationLearning(source);
      setMessage("Sent to confirmed-learning review. Nothing was confirmed automatically.");
      window.dispatchEvent(new Event("mirror-learning-updated"));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const hasFlags = Boolean((flags?.bringFlags.length ?? 0) + (flags?.seekFlags.length ?? 0));

  return (
    <section className="rounded-[2rem] border border-foreground/10 bg-background/72 p-5 shadow-sm sm:p-7">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(326_100%_50%)]">
          <MessagesSquare className="h-4 w-4" /> Communication
        </p>
        <h2 className="mt-2 font-serif text-2xl font-bold">How care, needs, and standards travel.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          This is one contextual capability, not a pile of personality labels.
          Saved results stay traceable and only become learning after your review.
        </p>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading communication context</div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-foreground/10 bg-background/58 p-5">
            <HeartHandshake className="h-5 w-5 text-[hsl(326_100%_50%)]" />
            <h3 className="mt-3 font-bold">Care preferences</h3>
            {care?.hasProfile && care.testedGiveTop && care.testedReceiveTop ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  You tend to give through <strong className="text-foreground">{DIALECT_LABELS[care.testedGiveTop] ?? care.testedGiveTop}</strong> and receive through <strong className="text-foreground">{DIALECT_LABELS[care.testedReceiveTop] ?? care.testedReceiveTop}</strong>.
                </p>
                <Button className="mt-4" size="sm" variant="outline" disabled={busy !== null} onClick={() => propose("care_dialect")}>
                  {busy === "care_dialect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send to learning review
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">No saved Care Dialect yet.</p>
            )}
            <Link href="/care-dialect" className="mt-4 flex items-center gap-2 text-sm font-semibold text-[hsl(248_62%_52%)]">Review Care Dialect <ArrowRight className="h-4 w-4" /></Link>
          </article>

          <article className="rounded-2xl border border-foreground/10 bg-background/58 p-5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="mt-3 font-bold">Relationship standards</h3>
            {hasFlags ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  You have named {[...(flags?.bringFlags ?? []), ...(flags?.seekFlags ?? [])].slice(0, 4).map(flagLabel).join(", ")}.
                </p>
                <Button className="mt-4" size="sm" variant="outline" disabled={busy !== null} onClick={() => propose("standards")}>
                  {busy === "standards" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send to learning review
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">No relationship standards have been saved yet.</p>
            )}
            <Link href="/flags" className="mt-4 flex items-center gap-2 text-sm font-semibold text-[hsl(248_62%_52%)]">Review standards <ArrowRight className="h-4 w-4" /></Link>
          </article>
        </div>
      )}

      {message && <div className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-sm leading-6">{message}</div>}

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/connection-style" className="font-semibold text-[hsl(248_62%_52%)]">Connection pattern lens</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/blueprint" className="font-semibold text-[hsl(248_62%_52%)]">Personal blueprint</Link>
        <span className="text-xs text-muted-foreground">These two lenses remain transitional until their saved behavior is absorbed.</span>
      </div>
    </section>
  );
}

