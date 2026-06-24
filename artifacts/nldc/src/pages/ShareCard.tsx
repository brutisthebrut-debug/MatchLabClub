import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import {
  Download,
  Share2,
  Copy,
  ArrowLeft,
  Check,
  Sparkles,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useGetMirrorPortrait,
  getGetMirrorPortraitQueryKey,
  useGetMyJourneySummary,
  getGetMyJourneySummaryQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DEMO_MOMENTUM, DEMO_PORTRAIT } from "@/lib/mirrorDemo";

// A signed-out visitor still gets a real, branded card so the surface never
// looks empty or gated; it is clearly labelled as a sample and the lanes mirror
// a believable mid-climb account. Real accounts always render their own counts.
const DEMO_BREAKDOWN: Record<string, number> = {
  audits: 72,
  wellness: 64,
  coaching: 41,
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const LANE_LABELS: Record<string, string> = {
  compass: "Compass reads",
  wellness: "Wellness map",
  hingeImport: "Dating app import",
  calendar: "Calendar rhythm",
  audits: "Profile audits",
  coaching: "Message coaching",
  instagram: "Instagram tone",
  lifePulse: "Life pulse",
  journal: "Journal",
  postDate: "Post-date notes",
  wins: "Dating wins",
  quizzes: "Quiz instincts",
};

function stageFor(score: number): { name: string; line: string } {
  if (score >= 75) return { name: "Dialed in", line: "Echo knows me. Bring on the introductions." };
  if (score >= 50) return { name: "Match ready", line: "Did the work. Ready for people I'd never find on my own." };
  if (score >= 25) return { name: "Building real signal", line: "Feeding Echo. Getting clearer every week." };
  return { name: "Laying the groundwork", line: "Just started teaching Echo who I am." };
}

type SnippetOption = { key: string; label: string; text: string };

export default function ShareCard() {
  useMeta(
    "Share your climb",
    "Share the ground you covered this week on the path to being genuinely match ready.",
  );

  const { isAuthenticated, login } = useAuth();
  const state = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  // The portrait is the source of the optional Mirror snippet. It 401s for anon
  // and may still be loading; either way the card falls back to score + lanes.
  const portraitQuery = useGetMirrorPortrait({
    query: {
      queryKey: getGetMirrorPortraitQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  // The weekly climb (signals fed, readiness gained, tools completed this week)
  // is the heart of the card: it is the same UserJourneySummary the Mirror
  // momentum recap reads, only derived counts, never raw content. The endpoint
  // 401s for anon, so signed-out visitors fall back to the labelled sample.
  const journeyQuery = useGetMyJourneySummary({
    query: {
      queryKey: getGetMyJourneySummaryQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  // Signed-out visitors get a clearly-labelled sample card instead of a gate, so
  // the surface is never empty and they can see exactly what they would share.
  const isDemo = !isAuthenticated;
  const portrait = isDemo ? DEMO_PORTRAIT : (portraitQuery.data ?? null);
  const climb = isDemo ? DEMO_MOMENTUM : (journeyQuery.data ?? null);
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // What the user has chosen to show. Score and stage are the always-on anchor;
  // lanes and the Mirror snippet are opt-in so the user controls exactly what
  // leaves their account. The live card below is the confirmation.
  const [showLanes, setShowLanes] = useState(true);
  const [snippetKey, setSnippetKey] = useState<string>("headline");

  const score = isDemo
    ? DEMO_PORTRAIT.readinessScore
    : (state.data?.readiness.score ?? 0);
  const breakdown = useMemo(
    () =>
      isDemo ? DEMO_BREAKDOWN : (state.data?.readiness.breakdown ?? {}),
    [isDemo, state.data],
  );

  const inviteUrl = useMemo(() => {
    const base =
      typeof window === "undefined"
        ? "https://matchlab.club"
        : window.location.origin + (import.meta.env.BASE_URL || "/");
    try {
      const u = new URL(base);
      u.searchParams.set("utm_source", "share");
      u.searchParams.set("utm_medium", "card");
      u.searchParams.set("utm_campaign", "readiness");
      return u.toString();
    } catch {
      return base;
    }
  }, []);

  const topLanes = useMemo(() => {
    return Object.entries(breakdown)
      .map(([key, value]) => ({
        key,
        label: LANE_LABELS[key] ?? key,
        value: typeof value === "number" ? Math.round(value) : 0,
      }))
      .filter((l) => l.value > 0 && LANE_LABELS[l.key])
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [breakdown]);

  // Every snippet option is a derived, aggregate read (a headline or a coverage
  // insight). None of them echo anything the user wrote, pasted, or uploaded.
  const snippetOptions = useMemo<SnippetOption[]>(() => {
    if (!portrait) return [];
    const opts: SnippetOption[] = [
      { key: "headline", label: "Overview", text: portrait.headline },
    ];
    for (const k of portrait.known) {
      if (k.insight) {
        opts.push({ key: `known:${k.key}`, label: k.label, text: k.insight });
      }
    }
    return opts;
  }, [portrait]);

  const selectedSnippet = useMemo<SnippetOption | null>(() => {
    if (snippetKey === "none") return null;
    if (snippetOptions.length === 0) return null;
    return (
      snippetOptions.find((o) => o.key === snippetKey) ?? snippetOptions[0]
    );
  }, [snippetKey, snippetOptions]);

  const stage = stageFor(score);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 240,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        /* QR is decorative; failure is non-blocking */
      });
    return () => {
      alive = false;
    };
  }, [inviteUrl]);

  async function render(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#0b0a17",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "matchlab-climb.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Couldn't build the image. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function saveBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matchlab-climb.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    setBusy(true);
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    // Build the image first, but never let a render failure block the share.
    let file: File | null = null;
    try {
      const blob = await render();
      file = blob
        ? new File([blob], "matchlab-climb.png", { type: "image/png" })
        : null;
    } catch {
      file = null;
    }
    try {
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My climb on MatchLab",
          text: `${stage.name}. ${score}% ready. ${inviteUrl}`,
        });
        return;
      }
      if (nav.share) {
        await nav.share({
          title: "My climb on MatchLab",
          text: `${stage.name}. ${score}% ready.`,
          url: inviteUrl,
        });
        return;
      }
      // No native share: fall back to saving the image, or copying the link.
      if (file) {
        saveBlob(file);
      } else {
        await handleCopy();
      }
    } catch (err) {
      // Dismissing the native share sheet throws AbortError; that is not a
      // failure. Anything else is real, so fall back to the invite link.
      if ((err as Error)?.name !== "AbortError") {
        await handleCopy();
        toast({ title: "Couldn't open share. Your invite link is copied." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Couldn't copy. Long-press the link instead." });
    }
  }

  const circumference = 2 * Math.PI * 52;
  const dash = (score / 100) * circumference;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <motion.div {...fadeUp(0)} className="mb-6">
          <Button asChild variant="ghost" size="sm" className="rounded-full -ml-2">
            <Link href="/matching">
              <ArrowLeft className="mr-1 w-4 h-4" aria-hidden="true" />
              Back to matching
            </Link>
          </Button>
          <h1 className="mt-3 font-serif text-3xl md:text-4xl font-bold">
            Share your climb
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            This card shows the ground you covered this week and your readiness
            stage. It never shows what you wrote, who you talked to, or any raw
            data. You choose what else appears, then post it, send it, and bring
            people onto the path with you.
          </p>
        </motion.div>

        {isDemo && (
          <motion.div
            {...fadeUp(0.03)}
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/8 bg-muted/40 p-4"
            data-testid="banner-share-sample"
          >
            <p className="text-sm text-muted-foreground">
              This is a sample card. Sign in to build one from your own climb.
            </p>
            <Button
              onClick={() => login()}
              size="sm"
              className="rounded-full"
              data-testid="button-share-signin"
            >
              Sign in to build your card
            </Button>
          </motion.div>
        )}

        <div className="grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <motion.div {...fadeUp(0.05)} className="mx-auto">
            <div
              ref={cardRef}
              className="relative w-[340px] min-h-[460px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white"
            >
              <div
                className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl"
                style={{ background: "hsl(326 100% 62% / 0.35)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full blur-3xl"
                style={{ background: "hsl(252 90% 55% / 0.45)" }}
              />
              {/* Dark vignette toward the lower edge keeps the footer copy and QR
                  legible over the bright rose end of the brand gradient. */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(130% 100% at 50% 115%, rgba(11,10,23,0.6) 0%, rgba(11,10,23,0) 55%)",
                }}
              />
              <div className="relative min-h-[460px] flex flex-col p-7">
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

                <div className="mt-8 flex items-center gap-5">
                  <div className="relative shrink-0">
                    <svg width="124" height="124" viewBox="0 0 124 124">
                      <circle
                        cx="62"
                        cy="62"
                        r="52"
                        fill="none"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="10"
                      />
                      <circle
                        cx="62"
                        cy="62"
                        r="52"
                        fill="none"
                        stroke="hsl(326 100% 68%)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circumference}`}
                        transform="rotate(-90 62 62)"
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="font-serif text-3xl font-bold">
                        {score}
                        <span className="text-base opacity-70">%</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                      Match readiness
                    </p>
                    <p className="mt-1 font-serif text-2xl font-bold leading-tight">
                      {stage.name}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                    My climb this week
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      {
                        key: "signals",
                        icon: Sparkles,
                        value: climb?.signalsFedThisWeek ?? 0,
                        label: "signals fed",
                      },
                      {
                        key: "readiness",
                        icon: TrendingUp,
                        value: `+${climb?.readinessGainedThisWeek ?? 0}`,
                        label: "readiness gained",
                      },
                      {
                        key: "tools",
                        icon: CheckCircle2,
                        value: climb?.toolsCompletedThisWeek ?? 0,
                        label: "tools done",
                      },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.key}
                          className="rounded-xl bg-white/15 p-2.5 text-center"
                        >
                          <Icon
                            className="mx-auto h-3.5 w-3.5"
                            style={{ color: "hsl(326 100% 82%)" }}
                            aria-hidden="true"
                          />
                          <div className="mt-1 font-serif text-xl font-bold leading-none text-white">
                            {stat.value}
                          </div>
                          <div className="mt-1 text-[10px] leading-tight text-white/80">
                            {stat.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedSnippet ? (
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                      What my Mirror sees
                    </p>
                    <p className="mt-1 text-sm text-white/85 leading-snug">
                      {selectedSnippet.text}
                    </p>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-white/75 leading-snug">
                    {stage.line}
                  </p>
                )}

                {showLanes && (
                  <div className="mt-5 space-y-2">
                    {topLanes.length > 0 ? (
                      topLanes.map((lane) => (
                        <div key={lane.key} className="flex items-center gap-3">
                          <span className="text-xs text-white/65 w-28 shrink-0">
                            {lane.label}
                          </span>
                          <span className="relative h-1.5 flex-1 rounded-full bg-white/12 overflow-hidden">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${lane.value}%`,
                                background: "hsl(326 100% 68%)",
                              }}
                            />
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-white/55">
                        Lanes fill in as I feed Echo.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-auto flex items-end justify-between pt-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      Become someone worth matching with
                    </p>
                    <p className="text-sm font-semibold text-white/90">
                      matchlab.club
                    </p>
                  </div>
                  {qr ? (
                    <img
                      src={qr}
                      alt="Scan to start your own readiness path"
                      className="w-14 h-14"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="space-y-4 max-w-md">
            <div className="rounded-2xl border border-foreground/8 p-5">
              <h2 className="font-semibold">What to show</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Build the card you want to share. The live card on the left is
                exactly what goes out. Your climb this week and your readiness
                stage are always included; the rest is up to you.
              </p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <Label htmlFor="toggle-lanes" className="text-sm font-medium">
                  Top lanes you have fed
                </Label>
                <Switch
                  id="toggle-lanes"
                  checked={showLanes}
                  onCheckedChange={setShowLanes}
                  data-testid="switch-show-lanes"
                />
              </div>

              {snippetOptions.length > 0 ? (
                <div className="mt-5">
                  <p className="text-sm font-medium">A line from your Mirror</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A derived read of where you are. Never anything you wrote or
                    uploaded.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSnippetKey("none")}
                      data-testid="snippet-option-none"
                      aria-pressed={selectedSnippet === null}
                      className={
                        selectedSnippet === null
                          ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                          : "rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/30"
                      }
                    >
                      None
                    </button>
                    {snippetOptions.map((opt) => {
                      const active = selectedSnippet?.key === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSnippetKey(opt.key)}
                          data-testid={`snippet-option-${opt.key}`}
                          aria-pressed={active}
                          className={
                            active
                              ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                              : "rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/30"
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-xs text-muted-foreground">
                  Feed your Mirror a signal or two and you can add a line from it
                  here.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-foreground/8 p-5">
              <h2 className="font-semibold">Send it out</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every share is an invitation. People who scan or tap land on the
                same starting line you did.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={handleShare}
                  disabled={busy}
                  className="rounded-full"
                  data-testid="button-share-card"
                >
                  <Share2 className="mr-1 w-4 h-4" aria-hidden="true" />
                  Share
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={busy}
                  variant="outline"
                  className="rounded-full"
                  data-testid="button-download-card"
                >
                  <Download className="mr-1 w-4 h-4" aria-hidden="true" />
                  Download image
                </Button>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="rounded-full"
                  data-testid="button-copy-invite"
                >
                  {copied ? (
                    <Check className="mr-1 w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Copy className="mr-1 w-4 h-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy invite link"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/8 p-5">
              <h2 className="font-semibold">What it never shows</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Anything you wrote, pasted, or uploaded.</li>
                <li>Who you are talking to or matched with.</li>
                <li>Your name, location, or any raw signal data.</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Just your stage, your score, the lanes you choose, and a derived
                line from your Mirror if you add one.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
