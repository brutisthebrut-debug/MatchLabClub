import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";
import {
  getGetMirrorPortraitQueryKey,
  getListWellnessAnswersQueryKey,
  useGetMirrorPortrait,
  useListImports,
  useListProfiles,
  useListWellnessAnswers,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  FileHeart,
  FolderClock,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link } from "wouter";

export default function MyMatchLab() {
  useMeta(
    "My MatchLab",
    "Your live member record: what you shared, what Echo is still learning, your saved profile versions, and the permissions behind them.",
  );

  const { isAuthenticated } = useAuth();
  const portraitQuery = useGetMirrorPortrait({
    query: {
      queryKey: getGetMirrorPortraitQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const wellnessQuery = useListWellnessAnswers(undefined, {
    query: {
      queryKey: getListWellnessAnswersQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const profilesQuery = useListProfiles({
    query: { enabled: isAuthenticated },
  });
  const importsQuery = useListImports({
    query: { enabled: isAuthenticated },
  });

  const portrait = portraitQuery.data;
  const wellnessAnswers = wellnessQuery.data?.answers ?? [];
  const profiles = profilesQuery.data ?? [];
  const imports = importsQuery.data?.imports ?? [];

  const coachingOnlyCount = wellnessAnswers.filter(
    (answer) => answer.consentLevel === "coaching",
  ).length;
  const matchingAllowedCount = wellnessAnswers.filter(
    (answer) =>
      answer.consentLevel === "matching" ||
      answer.consentLevel === "all",
  ).length;

  return (
    <AppLayout>
      <div className="relative isolate flex-1 overflow-hidden">
        <div className="pointer-events-none absolute -right-56 -top-52 h-[38rem] w-[38rem] rounded-full bg-[hsl(326_100%_59%/0.08)] blur-3xl" />
        <div className="pointer-events-none absolute -left-56 top-72 h-[34rem] w-[34rem] rounded-full bg-[hsl(248_62%_52%/0.1)] blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 sm:py-14">
          <header className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[hsl(248_62%_52%)]">
              My MatchLab
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              What you have chosen to build and keep.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              This is the member record, not another dashboard. It separates
              what you said directly, Echo's working reflections, saved profile
              versions, and the permissions that allow each use.
            </p>
          </header>

          <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
            <main className="space-y-5">
              <section className="rounded-[2rem] border border-foreground/10 bg-background/72 p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_52%)]">
                      <Brain className="h-4 w-4" />
                      Echo's working portrait
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold">
                      The picture taking shape
                    </h2>
                  </div>
                  <Link href="/echo">
                    <Button variant="outline">
                      Talk it through
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {portraitQuery.isLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your portrait
                  </div>
                ) : portraitQuery.isError ? (
                  <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
                    Your portrait could not load. No sample member data has been
                    substituted.
                  </div>
                ) : !portrait ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 p-5">
                    <p className="font-bold">There is not enough signal yet.</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Share something with Echo when you are ready. A working
                      reflection will appear here without becoming confirmed
                      learning automatically.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="rounded-3xl border border-[hsl(248_62%_52%/0.18)] bg-[hsl(248_62%_52%/0.06)] p-5 sm:p-6">
                      <span className="inline-flex rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-[hsl(248_62%_52%)]">
                        {portrait.stageLabel}
                      </span>
                      <p className="mt-4 font-serif text-2xl font-bold leading-snug sm:text-3xl">
                        {portrait.headline}
                      </p>
                      <p className="mt-3 leading-7 text-muted-foreground">
                        {portrait.stageBlurb}
                      </p>
                    </div>

                    {portrait.known.length > 0 && (
                      <div className="mt-6">
                        <h3 className="flex items-center gap-2 font-bold">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          Current working themes
                        </h3>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {portrait.known.map((item) => (
                            <article
                              key={item.key}
                              className="rounded-2xl border border-foreground/10 bg-background/58 p-4"
                            >
                              <p className="font-bold">{item.label}</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {item.insight}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    {portrait.blindSpots.length > 0 && (
                      <div className="mt-6">
                        <h3 className="flex items-center gap-2 font-bold">
                          <HelpCircle className="h-5 w-5 text-[hsl(326_100%_50%)]" />
                          Questions still open
                        </h3>
                        <div className="mt-3 space-y-3">
                          {portrait.blindSpots.map((item) => (
                            <Link
                              key={item.key}
                              href={item.href}
                              className="flex items-start justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/58 p-4 transition-colors hover:border-[hsl(248_62%_52%/0.3)]"
                            >
                              <span>
                                <span className="font-bold">{item.label}</span>
                                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                  {item.why}
                                </span>
                              </span>
                              <ArrowRight className="mt-1 h-4 w-4 shrink-0" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/7 p-4 text-sm leading-6 text-foreground/75">
                      A working theme is not confirmed learning. Echo should ask
                      you to confirm, correct, or dismiss it before it becomes
                      durable My MatchLab truth.
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[2rem] border border-foreground/10 bg-background/72 p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(326_100%_50%)]">
                      <Wand2 className="h-4 w-4" />
                      Profile Project
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold">
                      One profile capability, versioned
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Saved bios, prompts, and rewrites now live as reopenable
                      versions. Echo creates a new version instead of replacing
                      the source behind your back.
                    </p>
                  </div>
                  <Link href="/my-matchlab/profile">
                    <Button className="bg-foreground text-background hover:bg-foreground/90">
                      Open Profile Project
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-foreground/10 bg-background/58 p-4">
                    <FolderClock className="h-5 w-5 text-[hsl(248_62%_52%)]" />
                    <p className="mt-3 text-2xl font-bold">{profiles.length}</p>
                    <p className="text-sm text-muted-foreground">
                      saved profile versions
                    </p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-background/58 p-4">
                    <FileHeart className="h-5 w-5 text-[hsl(326_100%_50%)]" />
                    <p className="mt-3 text-2xl font-bold">
                      {wellnessAnswers.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      things shared directly
                    </p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-background/58 p-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <p className="mt-3 text-2xl font-bold">{imports.length}</p>
                    <p className="text-sm text-muted-foreground">
                      stored imported sources
                    </p>
                  </div>
                </div>
              </section>
            </main>

            <aside className="space-y-5">
              <section className="rounded-[2rem] border border-foreground/10 bg-background/75 p-5 shadow-sm">
                <h2 className="font-serif text-xl font-bold">
                  What you shared directly
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These are member-authored answers, kept separate from Echo's
                  interpretations.
                </p>
                <dl className="mt-5 space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-foreground/[0.035] px-4 py-3">
                    <dt className="text-sm text-muted-foreground">
                      Coaching only
                    </dt>
                    <dd className="font-bold">{coachingOnlyCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-foreground/[0.035] px-4 py-3">
                    <dt className="text-sm text-muted-foreground">
                      Matching allowed
                    </dt>
                    <dd className="font-bold">{matchingAllowedCount}</dd>
                  </div>
                </dl>
                <Link
                  href="/wellness"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(248_62%_52%)]"
                >
                  Review what you shared
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>

              <section className="rounded-[2rem] border border-foreground/10 bg-background/75 p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                  <ShieldCheck className="h-4 w-4" />
                  Sources and permissions
                </p>
                <h2 className="mt-2 font-serif text-xl font-bold">
                  Your data stays traceable
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Storage, Echo use, confirmed learning, and matching use remain
                  separate choices for every imported source.
                </p>
                <Link href="/trust-data">
                  <Button variant="outline" className="mt-5 w-full">
                    Open Trust & Data
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </section>

              <section className="rounded-[2rem] border border-foreground/10 bg-background/75 p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_52%)]">
                  <Sparkles className="h-4 w-4" />
                  Relationship language
                </p>
                <div className="mt-4 space-y-2">
                  <Link
                    href="/connection-style"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold hover:bg-foreground/5"
                  >
                    Connection Style
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/care-dialect"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold hover:bg-foreground/5"
                  >
                    Care Dialect
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/blueprint"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold hover:bg-foreground/5"
                  >
                    Personal Blueprint
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
