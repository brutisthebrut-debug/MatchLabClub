import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { Download, Share2, Copy, ArrowLeft, Check, Sparkles } from "lucide-react";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const LANE_LABELS: Record<string, string> = {
  compass: "Compass reads",
  wellness: "Wellness map",
  hingeImport: "Hinge import",
  calendar: "Calendar rhythm",
  audits: "Profile audits",
  coaching: "Message coaching",
  instagram: "Instagram tone",
  lifePulse: "Life pulse",
  journal: "Journal",
  postDate: "Post-date notes",
  wins: "Dating wins",
};

function stageFor(score: number): { name: string; line: string } {
  if (score >= 75) return { name: "Dialed in", line: "The machine knows me. Bring on the introductions." };
  if (score >= 50) return { name: "Match ready", line: "Did the work. Ready for people I'd never find on my own." };
  if (score >= 25) return { name: "Building real signal", line: "Feeding the machine. Getting clearer every week." };
  return { name: "Laying the groundwork", line: "Just started teaching the machine who I am." };
}

export default function ShareCard() {
  useMeta(
    "Your readiness card",
    "Share where you are on the path to being genuinely match ready.",
  );

  const { isAuthenticated, login } = useAuth();
  const state = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const score = state.data?.readiness.score ?? 0;
  const breakdown = useMemo(
    () => state.data?.readiness.breakdown ?? {},
    [state.data],
  );

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://matchlab.club";
    return window.location.origin + (import.meta.env.BASE_URL || "/");
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
      a.download = "matchlab-readiness.png";
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
    a.download = "matchlab-readiness.png";
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
        ? new File([blob], "matchlab-readiness.png", { type: "image/png" })
        : null;
    } catch {
      file = null;
    }
    try {
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My readiness on MatchLab",
          text: `${stage.name}. ${score}% ready. ${inviteUrl}`,
        });
        return;
      }
      if (nav.share) {
        await nav.share({
          title: "My readiness on MatchLab",
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

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-serif text-3xl font-bold">Your readiness card</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to build a card from your real readiness, then share it and
            bring people onto the path with you.
          </p>
          <Button onClick={() => login()} className="mt-6 rounded-full">
            Sign in to build your card
          </Button>
        </div>
      </AppLayout>
    );
  }

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
            Show the work
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            This card shows your readiness stage and the lanes you have fed the
            machine. It never shows what you wrote, who you talked to, or any raw
            data. Post it, send it, and bring people onto the path with you.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <motion.div {...fadeUp(0.05)} className="mx-auto">
            <div
              ref={cardRef}
              className="relative w-[340px] h-[460px] overflow-hidden rounded-[28px] text-white"
              style={{
                background:
                  "radial-gradient(120% 120% at 0% 0%, hsl(252 70% 22%) 0%, hsl(258 65% 12%) 45%, #0b0a17 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl"
                style={{ background: "hsl(326 100% 62% / 0.45)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full blur-3xl"
                style={{ background: "hsl(252 90% 65% / 0.4)" }}
              />
              <div className="relative h-full flex flex-col p-7">
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

                <p className="mt-5 text-sm text-white/75 leading-snug">
                  {stage.line}
                </p>

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
                      Lanes fill in as I feed the machine.
                    </p>
                  )}
                </div>

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
                Just your stage, your score, and the lanes you have invested in.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
