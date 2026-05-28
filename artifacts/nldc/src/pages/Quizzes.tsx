import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Clock, Award, Compass } from "lucide-react";
import { QUIZZES, readQuizResults } from "@/lib/quizzes";
import { useEffect, useState } from "react";
import type { SavedQuizResult } from "@/lib/quizzes";
import { ShareButton } from "@/components/echo/ShareButton";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const COMPANION_TOOLS = [
  {
    title: "Connection Style Lens",
    pitch: "Six questions that reveal the pattern beneath your dating — how you attach, what activates your risk loop, one experiment worth trying.",
    href: "/connection-style",
    emoji: "🧭",
    duration: "5 min",
  },
  {
    title: "Dating Archetype",
    pitch: "Connector, pursuer, adventurer, anchor — the deeper read on the shape of how you show up.",
    href: "/archetype",
    emoji: "🎭",
    duration: "4 min",
  },
];

export default function Quizzes() {
  useMeta(
    "Quiz Lab — MatchLab Club",
    "Short, honest quizzes that read your dating pattern in 60–90 seconds. No signup needed. Each one feeds your dating second-brain.",
  );

  const { user } = useAuth();
  const shareRef = user?.id ? `user-${user.id}` : "quiz-catalog";
  const [saved, setSaved] = useState<SavedQuizResult[]>([]);
  useEffect(() => { setSaved(readQuizResults()); }, []);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[420px] h-[420px] -top-20 -left-20 opacity-30 pointer-events-none" />
        <div className="orb orb-gold fixed w-[320px] h-[320px] bottom-20 -right-20 opacity-30 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">

          {/* Header */}
          <motion.div {...fadeUp()} className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(248_62%_52%/0.25)] text-xs font-medium text-[hsl(248_62%_62%)] mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              No signup needed · Free
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              The Quiz Lab.
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Short, honest quizzes that name the pattern beneath your dating —
              and quietly map to your <Link href="/wellness" className="text-[hsl(248_62%_62%)] underline-offset-2 hover:underline">wellness profile</Link> so
              your second-brain gets smarter the more you play.
            </p>
          </motion.div>

          {/* Earned badges row */}
          {saved.length > 0 && (
            <motion.div {...fadeUp(0.05)} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-[hsl(43_65%_62%)]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your badges</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {saved.map(r => (
                  <Link
                    key={r.slug}
                    href={`/quizzes/${r.slug}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-foreground/10 text-xs hover:border-[hsl(248_62%_52%/0.4)] transition-colors"
                    data-testid={`badge-saved-${r.slug}`}
                  >
                    <span className="font-semibold text-foreground">{r.archetypeName}</span>
                    <span className="text-muted-foreground">· {new Date(r.takenAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quiz grid */}
          <motion.div {...fadeUp(0.08)} className="grid sm:grid-cols-2 gap-4 mb-12">
            {QUIZZES.map((q) => {
              const result = saved.find(s => s.slug === q.slug);
              return (
                <div
                  key={q.slug}
                  className="group glass border border-foreground/8 rounded-2xl p-6 hover:border-[hsl(248_62%_52%/0.4)] transition-all hover:-translate-y-0.5"
                  data-testid={`card-quiz-${q.slug}`}
                >
                  <Link href={`/quizzes/${q.slug}`} className="block">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="text-4xl flex-shrink-0">{q.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-lg mb-1">{q.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{q.pitch}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-foreground/5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />~{Math.round(q.durationSec / 60) || 1} min</span>
                        <span>·</span>
                        <span>{q.questions.length} questions</span>
                      </div>
                      <span className="text-xs font-semibold text-[hsl(248_62%_62%)] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        {result ? "Retake" : "Start"} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {q.feeds.map(f => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground/80 font-mono">{f}</span>
                      ))}
                    </div>
                  </Link>
                  <div className="mt-3 pt-3 border-t border-foreground/5 flex justify-end">
                    <ShareButton
                      surface="quiz-result"
                      variant="pill"
                      title={`Try this quiz: ${q.title}`}
                      text={`${q.emoji} ${q.title} on MatchLab Club. ${q.pitch} Takes about ${Math.round(q.durationSec / 60) || 1} minutes.`}
                      path={`/quizzes/${q.slug}`}
                      ref={shareRef}
                      label="Send to a friend"
                      copiedLabel="Link copied"
                      testId={`share-quiz-${q.slug}`}
                    />
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Deeper companion tools */}
          <motion.div {...fadeUp(0.12)} className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="w-4 h-4 text-[hsl(248_62%_62%)]" />
              <h2 className="text-lg font-bold text-foreground">Go deeper</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
              The Quiz Lab gives you fast badges. These are the longer reads — same engine, same AI layer, more dimensions.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {COMPANION_TOOLS.map(t => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="glass border border-foreground/8 rounded-xl p-5 hover:border-[hsl(248_62%_52%/0.35)] transition-all hover:-translate-y-0.5 flex items-start gap-3"
                  data-testid={`card-companion-${t.href.slice(1)}`}
                >
                  <span className="text-2xl flex-shrink-0">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm">{t.title}</h3>
                      <span className="text-[10px] text-muted-foreground">{t.duration}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.pitch}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Soft footer */}
          <motion.div {...fadeUp(0.15)} className="text-center px-6 py-8 rounded-2xl glass border border-foreground/8">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Everything here is free. Sign in to save badges across devices and let the answers compound into your full Connection Style readout.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signal-check"
                className="text-xs font-semibold px-4 py-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                Try the 3-min Signal Check <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/start"
                className="text-xs font-semibold px-4 py-2 rounded-full border border-foreground/12 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                Or the full Profile Audit
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
