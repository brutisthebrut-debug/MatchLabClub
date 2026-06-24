import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Flag, Shield, Check, Download, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetFlagSelection,
  usePutFlagSelection,
  getGetFlagSelectionQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GREEN_FLAGS, RED_FLAGS, flagLabel } from "@/lib/flags";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A signed-out visitor sees a real, filled-in card instead of an empty one. The
// demo never writes to the server and is clearly labelled as a sample.
const DEMO_BRING = [
  "communicates-openly",
  "owns-mistakes",
  "consistent-effort",
  "makes-you-laugh",
];
const DEMO_SEEK = [
  "emotionally-available",
  "calm-in-conflict",
  "respects-boundaries",
  "hot-and-cold",
  "no-follow-through",
];

const MAX_PER_LIST = 12;

function Chip({
  label,
  selected,
  tone,
  onClick,
  testId,
}: {
  label: string;
  selected: boolean;
  tone: "green" | "red";
  onClick: () => void;
  testId: string;
}) {
  const base =
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all";
  const selectedClass =
    tone === "green"
      ? "border-[hsl(150_55%_55%/0.6)] bg-[hsl(150_55%_45%/0.16)] text-[hsl(150_65%_75%)]"
      : "border-[hsl(350_70%_60%/0.6)] bg-[hsl(350_70%_55%/0.16)] text-[hsl(350_80%_78%)]";
  const idleClass =
    "border-white/12 text-muted-foreground hover:border-white/30";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
      className={`${base} ${selected ? selectedClass : idleClass}`}
    >
      {label}
    </button>
  );
}

export default function Flags() {
  useMeta(
    "Green flags and red flags",
    "Name the green flags you bring and the ones you look for. It sharpens who you get matched with, and the result is a card worth sharing.",
  );

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const isDemo = !isAuthenticated;

  const { data: serverData } = useGetFlagSelection({
    query: {
      queryKey: getGetFlagSelectionQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const putFlags = usePutFlagSelection();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  const [bring, setBring] = useState<string[]>([]);
  const [seek, setSeek] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local selection once the server answers, so edits are responsive
  // and we only write on save.
  useEffect(() => {
    if (isDemo) {
      setBring(DEMO_BRING);
      setSeek(DEMO_SEEK);
      return;
    }
    if (serverData && !hydrated) {
      setBring(serverData.bringFlags ?? []);
      setSeek(serverData.seekFlags ?? []);
      setHydrated(true);
    }
  }, [isDemo, serverData, hydrated]);

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    id: string,
  ) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
      return;
    }
    if (list.length >= MAX_PER_LIST) return;
    setList([...list, id]);
  };

  const distinctCount = useMemo(
    () => new Set([...bring, ...seek]).size,
    [bring, seek],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetFlagSelectionQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const save = () => {
    if (isDemo || putFlags.isPending) return;
    climb.snapshot();
    putFlags.mutate(
      { data: { bringFlags: bring, seekFlags: seek } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Your flags are saved." });
        },
      },
    );
  };

  async function handleDownload() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b0a17",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "matchlab-flags.png";
      a.click();
    } catch {
      toast({ title: "Couldn't build the image. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!cardRef.current) return;
    setBusy(true);
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    let file: File | null = null;
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b0a17",
      });
      const blob = await (await fetch(dataUrl)).blob();
      file = new File([blob], "matchlab-flags.png", { type: "image/png" });
    } catch {
      file = null;
    }
    try {
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My flags on MatchLab",
          text: "The green flags I bring and what I look for.",
        });
        return;
      }
      await handleDownload();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        await handleDownload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Flag className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Know your standards
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Green flags and red flags
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Name the green flags you bring and the ones you look for, plus the
              red flags you watch out for. Naming them is its own read on your
              standards, it sharpens who I pair you with, and the
              result is a card worth sharing.
            </p>
          </motion.div>

          {isDemo && (
            <motion.div
              {...fadeUp(0.03)}
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              data-testid="banner-flags-sample"
            >
              <p className="text-sm text-muted-foreground">
                This is a sample selection. Sign in to pick your own and count
                them toward matching.
              </p>
              <Button
                onClick={() => login()}
                size="sm"
                className="rounded-full"
                data-testid="button-flags-signin"
              >
                Sign in to pick your flags
              </Button>
            </motion.div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-start">
            <div className="space-y-6">
              {/* Flags I bring */}
              <motion.div
                {...fadeUp(0.05)}
                className="glass border border-white/10 rounded-2xl p-6"
              >
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Green flags I bring
                </h2>
                <p className="text-xs text-muted-foreground/60 mb-4">
                  What you reliably offer a partner. Pick up to {MAX_PER_LIST}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {GREEN_FLAGS.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.label}
                      tone="green"
                      selected={bring.includes(f.id)}
                      onClick={() => toggle(bring, setBring, f.id)}
                      testId={`bring-flag-${f.id}`}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Flags I look for */}
              <motion.div
                {...fadeUp(0.08)}
                className="glass border border-white/10 rounded-2xl p-6"
              >
                <h2 className="text-base font-semibold text-foreground mb-1">
                  What I look for and look out for
                </h2>
                <p className="text-xs text-muted-foreground/60 mb-4">
                  The green flags you want in a partner and the red flags you
                  avoid. Pick up to {MAX_PER_LIST}.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {GREEN_FLAGS.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.label}
                      tone="green"
                      selected={seek.includes(f.id)}
                      onClick={() => toggle(seek, setSeek, f.id)}
                      testId={`seek-flag-${f.id}`}
                    />
                  ))}
                </div>
                <div className="border-t border-white/8 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">
                    Red flags you avoid
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RED_FLAGS.map((f) => (
                      <Chip
                        key={f.id}
                        label={f.label}
                        tone="red"
                        selected={seek.includes(f.id)}
                        onClick={() => toggle(seek, setSeek, f.id)}
                        testId={`seek-flag-${f.id}`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              {!isDemo && (
                <motion.div {...fadeUp(0.1)} className="flex items-center gap-3">
                  <Button
                    onClick={save}
                    disabled={putFlags.isPending}
                    className="rounded-full"
                    data-testid="button-save-flags"
                  >
                    <Check className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Save my flags
                  </Button>
                  <p className="text-xs text-muted-foreground/50">
                    {distinctCount} distinct flag{distinctCount === 1 ? "" : "s"}{" "}
                    named
                  </p>
                </motion.div>
              )}

              {isAuthenticated && climb.before !== null && (
                <motion.div {...fadeUp(0.11)}>
                  <ReadinessClimbReveal
                    from={climb.before}
                    to={climb.current}
                    className="glass border border-white/8 rounded-2xl p-5"
                  />
                </motion.div>
              )}
            </div>

            {/* Shareable card */}
            <motion.div {...fadeUp(0.12)} className="mx-auto">
              <div
                ref={cardRef}
                className="relative w-[320px] min-h-[440px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white"
              >
                <div
                  className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl"
                  style={{ background: "hsl(326 100% 62% / 0.35)" }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(130% 100% at 50% 115%, rgba(11,10,23,0.6) 0%, rgba(11,10,23,0) 55%)",
                  }}
                />
                <div className="relative min-h-[440px] flex flex-col p-7">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid place-items-center w-7 h-7 rounded-lg"
                      style={{ background: "hsl(326 100% 62%)" }}
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="font-serif text-lg font-bold tracking-tight">
                      MatchLab
                    </span>
                  </div>

                  <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-white/55">
                    Green flags I bring
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bring.length > 0 ? (
                      bring.slice(0, 6).map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-medium"
                        >
                          {flagLabel(id)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/55">
                        Pick the flags you bring.
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-white/55">
                    What I look for
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {seek.length > 0 ? (
                      seek.slice(0, 6).map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-medium"
                        >
                          {flagLabel(id)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/55">
                        Pick what you look for.
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      Know what you bring
                    </p>
                    <p className="text-sm font-semibold text-white/90">
                      matchlab.club
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  onClick={handleShare}
                  disabled={busy}
                  variant="secondary"
                  size="sm"
                  className="rounded-full flex-1"
                  data-testid="button-share-flags"
                >
                  <Share2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Share
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={busy}
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  data-testid="button-download-flags"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Trust note */}
          <motion.div
            {...fadeUp(0.45)}
            className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Only the flags you pick are stored.
              </strong>{" "}
              I keep which flags you selected and how many distinct ones you
              named, never any free text. Your picks count toward matching
              readiness and you can wipe everything from your account at any time.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
