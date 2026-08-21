import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Clock, Award, Compass, Search, Target, Zap, HeartHandshake, Eye, BookOpen, UserCircle, Rocket, Gift, Map, Anchor, Shield, MessagesSquare } from "lucide-react";
import { QUIZZES, readQuizResults } from "@/lib/quizzes";
import { useEffect, useMemo, useState } from "react";
import type { SavedQuizResult } from "@/lib/quizzes";
import { ShareButton } from "@/components/echo/ShareButton";
import { useAuth } from "@workspace/replit-auth-web";
import { useListImports } from "@workspace/api-client-react";
import { quizResultsFromImports } from "@/lib/quizResultHistory";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const COMPANION_TOOLS = [
  {
    title: "Connection Style Lens",
    pitch: "Six questions that reveal the pattern beneath your dating, how you attach, what activates your risk loop.",
    href: "/connection-style",
    icon: Target,
    duration: "5 min",
  },
  {
    title: "Dating Archetype",
    pitch: "Connector, pursuer, adventurer, anchor. The deeper read on the shape of how you show up.",
    href: "/archetype",
    icon: UserCircle,
    duration: "4 min",
  },
];

const QUIZ_ICONS: Record<string, any> = {
  "love-pace": HeartHandshake,
  "conflict-instinct": Zap,
  "what-lights-you-up": Rocket,
  "love-language": Gift,
  "future-vision": Map,
  "attachment-style": Anchor,
  "boundary-blueprint": Shield,
  "post-date-instinct": Eye,
  "message-stamina": MessagesSquare,
};

const FEATURED_QUIZ_SLUG = "attachment-style";

export default function Quizzes() {
  useMeta(
    "Quiz Lab",
    "Short, honest quizzes that read your dating pattern in 60–90 seconds. No signup needed. Each one feeds your dating second-brain.",
    absoluteUrl(DEFAULT_OG_IMAGE),
    { canonicalUrl: absoluteUrl("/quizzes") },
  );

  const { user } = useAuth();
  const shareRef = user?.id ? `user-${user.id}` : "quiz-catalog";
  const [browserSaved, setBrowserSaved] = useState<SavedQuizResult[]>([]);
  const importsQuery = useListImports();

  useEffect(() => {
    setBrowserSaved(readQuizResults());
  }, []);

  const serverSaved = useMemo(
    () => quizResultsFromImports(importsQuery.data?.imports ?? []),
    [importsQuery.data?.imports],
  );
  const saved = importsQuery.isSuccess ? serverSaved : browserSaved;

  const orderedQuizzes = [...QUIZZES].sort((a, b) =>
    a.slug === FEATURED_QUIZ_SLUG ? -1 : b.slug === FEATURED_QUIZ_SLUG ? 1 : 0,
  );

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-12 md:py-20 px-4 relative overflow-hidden">
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-32 -left-32 opacity-40 pointer-events-none" />
        <div className="orb orb-gold absolute w-[400px] h-[400px] bottom-10 -right-20 opacity-30 pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp()} className="mb-16 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-elevated border border-[hsl(248_62%_52%/0.25)] text-xs font-semibold tracking-wide uppercase text-[hsl(248_62%_62%)] mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              No signup needed
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-6 leading-[1.1]">
              The Quiz Lab.
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              Short, revealing assessments that name the pattern beneath your dating life. 
              They quietly map to your <Link href="/wellness" className="text-[hsl(248_62%_62%)] font-medium hover:underline">wellness profile</Link> so 
              your second-brain gets smarter the more you play.
            </p>
          </motion.div>

          {/* Earned badges row */}
          {saved.length > 0 && (
            <motion.div {...fadeUp(0.1)} className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-[hsl(43_65%_62%)]" />
                <p className="text-sm font-bold uppercase tracking-widest text-foreground">Your Results</p>
              </div>
              {importsQuery.isError && (
                <p className="text-xs text-muted-foreground mb-4">
                  Account history is unavailable right now, so these are the results saved on this browser.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {saved.map(r => (
                  <Link
                    key={r.slug}
                    href={`/quizzes/${r.slug}`}
                    className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl glass border border-foreground/10 text-sm hover:border-[hsl(248_62%_52%/0.4)] hover:shadow-md transition-all"
                  >
                    <span className="font-bold text-foreground group-hover:text-[hsl(248_62%_52%)] transition-colors">{r.archetypeName}</span>
                    <span className="text-muted-foreground text-xs">· {new Date(r.takenAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quiz grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-20">
            {orderedQuizzes.map((q, i) => {
              const result = saved.find(s => s.slug === q.slug);
              const Icon = QUIZ_ICONS[q.slug] || Compass;
              const isFeatured = q.slug === FEATURED_QUIZ_SLUG;
              
              return (
                <motion.div
                  {...fadeUp(0.15 + (i * 0.1))}
                  key={q.slug}
                  className={`group relative glass-strong border rounded-[2rem] p-8 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${isFeatured ? "md:col-span-2 border-[hsl(248_62%_52%/0.45)] shadow-lg" : "border-foreground/10 hover:border-[hsl(248_62%_52%/0.5)]"}`}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 pointer-events-none">
                    <Icon className="w-32 h-32 text-foreground" />
                  </div>
                  
                  <Link href={`/quizzes/${q.slug}`} className="block relative z-10">
                    {isFeatured && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.3)] text-[11px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-4">
                        <Sparkles className="w-3 h-3" />
                        Start here
                      </div>
                    )}
                    <div className="flex items-start gap-5 mb-5">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white shadow-lg shadow-[hsl(248_62%_52%/0.25)]">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-bold text-foreground text-xl md:text-2xl mb-2 group-hover:text-[hsl(248_62%_52%)] transition-colors">{q.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed font-medium">{q.pitch}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-foreground/5">
                      <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />~{Math.round(q.durationSec / 60) || 1} min</span>
                        <span>·</span>
                        <span>{q.questions.length} questions</span>
                      </div>
                      <span className="text-sm font-bold text-[hsl(248_62%_62%)] inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        {result ? "Retake" : "Start"} <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                  <div className="mt-4 pt-4 border-t border-foreground/5 flex justify-end relative z-10">
                    <ShareButton
                      surface="quiz-result"
                      variant="pill"
                      title={`Try this quiz: ${q.title}`}
                      text={`${q.title} on MatchLab Club. ${q.pitch} Takes about ${Math.round(q.durationSec / 60) || 1} minutes.`}
                      path={`/quizzes/${q.slug}`}
                      ref={shareRef}
                      label="Send to a friend"
                      copiedLabel="Link copied"
                      testId={`share-quiz-${q.slug}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Deeper companion tools */}
          <motion.div {...fadeUp(0.4)} className="mb-20">
            <div className="flex items-center gap-3 mb-6 justify-center text-center">
              <Eye className="w-6 h-6 text-[hsl(248_62%_62%)]" />
              <h2 className="text-2xl font-serif font-bold text-foreground">Go deeper</h2>
            </div>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto text-center">
              The Quiz Lab gives you fast reads. These are the longer assessments, powered by the same engine, unlocking more dimensions.
            </p>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {COMPANION_TOOLS.map(t => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group glass border border-foreground/8 rounded-2xl p-6 hover:border-[hsl(248_62%_52%/0.35)] transition-all hover:-translate-y-1 hover:shadow-lg flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)] flex items-center justify-center flex-shrink-0 group-hover:bg-[hsl(248_62%_52%/0.15)] transition-colors">
                      <Icon className="w-6 h-6 text-[hsl(248_62%_52%)]" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-foreground text-base group-hover:text-[hsl(248_62%_52%)] transition-colors">{t.title}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.duration}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.pitch}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Soft footer */}
          <motion.div {...fadeUp(0.5)} className="text-center px-6 py-10 rounded-[2rem] glass-strong border border-foreground/10 shadow-lg">
            <BookOpen className="w-8 h-8 mx-auto text-[hsl(248_62%_52%)] mb-4" />
            <p className="text-base font-medium text-foreground mb-2">Everything here is free.</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Sign in to save results across devices and let your answers compound into your full Connection Style readout.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signal-check"
                className="text-sm font-bold px-6 py-3 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                Try the 3-min Signal Check <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/start"
                className="text-sm font-bold px-6 py-3 rounded-full glass border border-foreground/15 text-foreground hover:bg-foreground/5 transition-colors"
              >
                Run a Full Audit
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
