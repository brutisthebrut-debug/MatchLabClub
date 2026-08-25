import { useEffect, useState } from "react";
import { ArrowRight, HeartHandshake, Loader2, MessagesSquare, ShieldCheck, Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { flagLabel } from "@/lib/flags";
import { proposeCommunicationLearning } from "@/lib/mirrorLearnings";
import { listCommunicationRecords, type CommunicationRecord as SavedCommunicationRecord } from "@/lib/communicationRecords";
import { ConnectionStyleExperience } from "@/pages/ConnectionStyle";
import { BlueprintExperience } from "@/pages/Blueprint";

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
  const [records, setRecords] = useState<SavedCommunicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"care_dialect" | "standards" | "connection_style" | "personal_blueprint" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeLens, setActiveLens] = useState<"connection-style" | "personal-blueprint" | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("communication");
    return value === "connection-style" || value === "personal-blueprint" ? value : null;
  });

  useEffect(() => {
    Promise.all([
      loadJson<CareDialectState>("/me/care-dialect"),
      loadJson<FlagState>("/me/flags"),
      listCommunicationRecords(),
    ])
      .then(([careResult, flagResult, communicationResult]) => {
        setCare(careResult.isDemo ? null : careResult);
        setFlags(flagResult);
        setRecords(communicationResult.records);
      })
      .catch((err: Error) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const refresh = () => {
      void listCommunicationRecords()
        .then((result) => setRecords(result.records))
        .catch((err: Error) => setMessage(err.message));
    };
    window.addEventListener("communication-record-updated", refresh);
    return () => window.removeEventListener("communication-record-updated", refresh);
  }, []);

  async function propose(source: "care_dialect" | "standards" | "connection_style" | "personal_blueprint") {
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
  const connectionStyle = records.find((record) => record.lens === "connection_style");
  const blueprint = records.find((record) => record.lens === "personal_blueprint");

  function openLens(lens: "connection-style" | "personal-blueprint") {
    setActiveLens(lens);
    const url = new URL(window.location.href);
    url.searchParams.set("communication", lens);
    window.history.replaceState({}, "", url);
    window.setTimeout(() => document.getElementById(`communication-${lens}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function closeLens() {
    setActiveLens(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("communication");
    window.history.replaceState({}, "", url);
  }

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

          <article className="rounded-2xl border border-foreground/10 bg-background/58 p-5">
            <Sparkles className="h-5 w-5 text-[hsl(248_62%_52%)]" />
            <h3 className="mt-3 font-bold">Connection pattern</h3>
            {connectionStyle ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Your saved lens currently names <strong className="text-foreground">{String(connectionStyle.result.name ?? "a connection pattern")}</strong>.
                </p>
                <Button className="mt-4" size="sm" variant="outline" disabled={busy !== null} onClick={() => propose("connection_style")}>
                  {busy === "connection_style" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send to learning review
                </Button>
              </>
            ) : <p className="mt-2 text-sm leading-6 text-muted-foreground">No Connection Style result has been saved yet.</p>}
            <Button className="mt-4" size="sm" variant="ghost" onClick={() => openLens("connection-style")}>Open here <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </article>

          <article className="rounded-2xl border border-foreground/10 bg-background/58 p-5">
            <MessagesSquare className="h-5 w-5 text-[hsl(326_100%_50%)]" />
            <h3 className="mt-3 font-bold">Personal blueprint</h3>
            {blueprint ? (
              <>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{String(blueprint.result.communicationStyle ?? "Your saved blueprint is ready to review.")}</p>
                <Button className="mt-4" size="sm" variant="outline" disabled={busy !== null} onClick={() => propose("personal_blueprint")}>
                  {busy === "personal_blueprint" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send to learning review
                </Button>
              </>
            ) : <p className="mt-2 text-sm leading-6 text-muted-foreground">No Personal Blueprint has been saved yet.</p>}
            <Button className="mt-4" size="sm" variant="ghost" onClick={() => openLens("personal-blueprint")}>Open here <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </article>
        </div>
      )}

      {activeLens && (
        <div className="relative mt-6 rounded-3xl border border-foreground/10 bg-background/60 p-4 sm:p-6">
          <Button aria-label="Close Communication tool" className="absolute right-4 top-4 z-20" size="icon" variant="ghost" onClick={closeLens}>
            <X className="h-4 w-4" />
          </Button>
          {activeLens === "connection-style" ? <ConnectionStyleExperience embedded /> : <BlueprintExperience embedded />}
        </div>
      )}

      {message && <div className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-sm leading-6">{message}</div>}

    </section>
  );
}
