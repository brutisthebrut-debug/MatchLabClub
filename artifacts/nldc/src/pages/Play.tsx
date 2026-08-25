import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Award, Clock, Compass, Gamepad2, Loader2, LockKeyhole, MessageCircleHeart, Orbit, Sparkles } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShareButton } from "@/components/echo/ShareButton";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { QUIZZES, readQuizResults, type SavedQuizResult } from "@/lib/quizzes";
import { getDurableQuizResults, type DurableQuizResult } from "@/lib/playResults";
import { shouldFocusQuizCatalog } from "@/lib/playRoutes";

const GAMES = [
  { title: "This or That", description: "Choose quickly and notice the pattern behind your first instinct.", href: "/this-or-that", icon: Sparkles },
  { title: "Would You Rather", description: "Compare tradeoffs when both choices have weight.", href: "/games/would-you-rather", icon: Compass },
  { title: "Daily Spark", description: "Try one small prompt that makes room for curiosity today.", href: "/games/daily-spark", icon: Orbit },
  { title: "Scenarios", description: "Explore how you might respond when a connection becomes more real.", href: "/games/scenarios", icon: MessageCircleHeart },
  { title: "Predict Yourself", description: "Make a prediction, then return to what actually happened.", href: "/games/predict", icon: Award },
  { title: "Time Capsule", description: "Leave a thought for your future self and return to it later.", href: "/games/time-capsule", icon: LockKeyhole },
] as const;

export default function Play() {
  useMeta("Play | MatchLab Club", "Quizzes and small experiences that help you notice preferences, instincts, and surprises.", absoluteUrl(DEFAULT_OG_IMAGE), { canonicalUrl: absoluteUrl("/play") });
  const { isAuthenticated, user } = useAuth();
  const [durableResults, setDurableResults] = useState<DurableQuizResult[]>([]);
  const [localResults, setLocalResults] = useState<SavedQuizResult[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);

  // Account history is authoritative after sign-in; device storage is only an
  // anonymous continuity fallback and never substitutes for a failed API read.
  useEffect(() => {
    setLocalResults(readQuizResults());
    if (typeof window !== "undefined" && shouldFocusQuizCatalog("/play", window.location.search)) {
      window.requestAnimationFrame(() => document.getElementById("quizzes")?.scrollIntoView({ block: "start" }));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setDurableResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void getDurableQuizResults().then(setDurableResults).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const results = useMemo(() => isAuthenticated ? durableResults : localResults, [durableResults, isAuthenticated, localResults]);
  const shareRef = user?.id ? `user-${user.id}` : "play-catalog";

  return (
    <AppLayout>
      <main className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[hsl(248_62%_52%)]">Play</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold tracking-tight sm:text-5xl">Learn through curiosity.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Quizzes and small, low-pressure experiences can surface a useful question. You decide what becomes part of your MatchLab.</p>

        <section className="mt-9 rounded-3xl border border-[hsl(248_62%_52%/0.18)] bg-[hsl(248_62%_52%/0.06)] p-5" aria-label="Saved Play results">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Your saved quiz results</p><p className="mt-1 text-sm text-muted-foreground">{isAuthenticated ? "Loaded from your account across devices." : "Saved on this device until you sign in."}</p></div>{isAuthenticated && <Link href="/imports" className="text-sm font-bold text-[hsl(248_62%_52%)] hover:underline">Review learning permissions <ArrowRight className="ml-1 inline h-4 w-4" /></Link>}</div>
          {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading saved results</p> : error ? <p className="mt-4 text-sm text-destructive">{error}</p> : results.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{results.map((result) => {
            const confirmed = "learningConfirmed" in result && result.learningConfirmed;
            return <Link key={`${result.slug}-${result.takenAt ?? (result as DurableQuizResult).uploadedAt}`} href={`/quizzes/${result.slug}`} className="rounded-xl border border-foreground/10 bg-background px-4 py-2 text-sm hover:border-[hsl(248_62%_52%/0.35)]"><span className="font-bold">{result.archetypeName}</span><span className="ml-2 text-xs text-muted-foreground">{confirmed ? "Confirmed learning" : isAuthenticated ? "Saved result" : "This device"}</span></Link>;
          })}</div> : <p className="mt-4 text-sm text-muted-foreground">No quiz results yet. Choose one below when you feel curious.</p>}
        </section>

        <section id="quizzes" className="scroll-mt-24 pt-12" aria-labelledby="quiz-heading">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Quiz catalog</p><h2 id="quiz-heading" className="mt-2 font-serif text-3xl font-bold">A short read, grounded in your answers.</h2></div><span className="hidden text-sm text-muted-foreground sm:block">Results save without storing raw answer indexes.</span></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">{QUIZZES.map((quiz) => {
            const saved = results.find((result) => result.slug === quiz.slug);
            return <article key={quiz.slug} className="rounded-3xl border border-foreground/10 bg-background/70 p-6 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(248_62%_52%/0.1)] text-[hsl(248_62%_52%)]"><Gamepad2 className="h-5 w-5" /></span><div><h3 className="font-serif text-xl font-bold">{quiz.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{quiz.pitch}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />~{Math.round(quiz.durationSec / 60) || 1} min · {quiz.questions.length} questions</span><Link href={`/quizzes/${quiz.slug}`} className="text-sm font-bold text-[hsl(248_62%_52%)] hover:underline">{saved ? "Retake" : "Start"} <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="mt-3 flex justify-end"><ShareButton surface="quiz-result" variant="pill" title={`Try this quiz: ${quiz.title}`} text={`${quiz.title} on MatchLab Club. ${quiz.pitch}`} path={`/quizzes/${quiz.slug}`} ref={shareRef} label="Send to a friend" copiedLabel="Link copied" /></div></article>;
          })}</div>
        </section>

        <section className="pt-12" aria-labelledby="games-heading"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Small experiences</p><h2 id="games-heading" className="mt-2 font-serif text-3xl font-bold">Notice what your first instinct says.</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{GAMES.map((game) => { const Icon = game.icon; return <Link key={game.href} href={game.href} className="group rounded-3xl border border-foreground/10 bg-background/70 p-5 shadow-sm hover:border-[hsl(248_62%_52%/0.35)]"><Icon className="h-5 w-5 text-[hsl(248_62%_52%)]" /><h3 className="mt-4 font-serif text-xl font-bold">{game.title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{game.description}</p><span className="mt-4 inline-flex items-center text-sm font-bold text-[hsl(248_62%_52%)]">Play <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></Link>; })}</div></section>
      </main>
    </AppLayout>
  );
}
