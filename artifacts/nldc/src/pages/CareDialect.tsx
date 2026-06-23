import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { ToolHandoff } from "@/components/ToolHandoff";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { WelcomePanel } from "@/components/WelcomePanel";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Info,
  Check,
  Share2,
  ArrowRight,
  Lock,
  MessageCircle,
  HandHelping,
  Gift,
  Hourglass,
  Heart,
  Anchor,
  type LucideIcon,
} from "lucide-react";
import {
  useGetCareDialect,
  useSaveCareDialect,
  getGetCareDialectQueryKey,
  getGetMatchingStateQueryKey,
  type CareDialectProfile,
  type SaveCareDialectInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const DIALECT_KEYS = [
  "spokenWarmth",
  "helpingHands",
  "thoughtfulTokens",
  "undividedTime",
  "closeContact",
  "steadyPresence",
] as const;
type DialectKey = (typeof DIALECT_KEYS)[number];

const DIALECTS: Record<
  DialectKey,
  { name: string; blurb: string; icon: LucideIcon; color: string }
> = {
  spokenWarmth: {
    name: "Spoken Warmth",
    blurb:
      "Words that land. Being told what you mean to someone, hearing the appreciation out loud.",
    icon: MessageCircle,
    color: "326 80% 62%",
  },
  helpingHands: {
    name: "Helping Hands",
    blurb:
      "Care shown through doing. Someone lightening your load before you have to ask.",
    icon: HandHelping,
    color: "141 60% 45%",
  },
  thoughtfulTokens: {
    name: "Thoughtful Tokens",
    blurb:
      "Small things that prove you were on someone's mind when they were not with you.",
    icon: Gift,
    color: "43 70% 55%",
  },
  undividedTime: {
    name: "Undivided Time",
    blurb: "Full presence. Real attention with nothing else competing for it.",
    icon: Hourglass,
    color: "248 62% 62%",
  },
  closeContact: {
    name: "Close Contact",
    blurb: "Warmth you can feel. Closeness, a hand, being near.",
    icon: Heart,
    color: "12 75% 60%",
  },
  steadyPresence: {
    name: "Steady Presence",
    blurb:
      "Showing up the same way tomorrow. Consistency you can lean on over time.",
    icon: Anchor,
    color: "190 55% 60%",
  },
};

type QuizQuestion = { q: string; opts: { label: string; key: DialectKey }[] };

// Each option maps to exactly one dialect. The server tallies the chosen keys
// into a distribution and a top per axis, it never sees the question text.
const GIVE_QUESTIONS: QuizQuestion[] = [
  {
    q: "Someone you care about had a rough day. Your instinct is to...",
    opts: [
      { label: "Tell them, in plain words, what they mean to you", key: "spokenWarmth" },
      { label: "Handle something on their list so they can breathe", key: "helpingHands" },
      { label: "Clear your evening to be fully with them", key: "undividedTime" },
      { label: "Pick up a small thing that made you think of them", key: "thoughtfulTokens" },
      { label: "Pull them in close, no words needed", key: "closeContact" },
      { label: "Keep your normal rhythm so they have something steady", key: "steadyPresence" },
    ],
  },
  {
    q: "You want a new partner to feel cared for. You are most likely to...",
    opts: [
      { label: "Say what you admire about them, often", key: "spokenWarmth" },
      { label: "Notice what they need and just do it", key: "helpingHands" },
      { label: "Protect real, unhurried time together", key: "undividedTime" },
      { label: "Remember the small details and act on them", key: "thoughtfulTokens" },
      { label: "Keep affection warm and physical", key: "closeContact" },
      { label: "Be consistent so they always know where you stand", key: "steadyPresence" },
    ],
  },
  {
    q: "Your care shows up most clearly when you...",
    opts: [
      { label: "Name your feelings out loud", key: "spokenWarmth" },
      { label: "Take care of the practical stuff", key: "helpingHands" },
      { label: "Give your full, undistracted attention", key: "undividedTime" },
      { label: "Surprise them with something thoughtful", key: "thoughtfulTokens" },
      { label: "Reach for closeness and touch", key: "closeContact" },
      { label: "Show up the same way, day after day", key: "steadyPresence" },
    ],
  },
  {
    q: "A friend says you are a great partner because you...",
    opts: [
      { label: "Always say the thing out loud", key: "spokenWarmth" },
      { label: "Never let them carry it alone", key: "helpingHands" },
      { label: "Make them feel like the only person in the room", key: "undividedTime" },
      { label: "Remember what matters to them", key: "thoughtfulTokens" },
      { label: "Are warm and physically present", key: "closeContact" },
      { label: "Are reliable, with no guessing games", key: "steadyPresence" },
    ],
  },
];

const RECEIVE_QUESTIONS: QuizQuestion[] = [
  {
    q: "You feel most loved this week when a partner...",
    opts: [
      { label: "Tells you exactly what you mean to them", key: "spokenWarmth" },
      { label: "Quietly takes something off your plate", key: "helpingHands" },
      { label: "Clears their evening to just be with you", key: "undividedTime" },
      { label: "Brings you a small thing that fits you", key: "thoughtfulTokens" },
      { label: "Reaches for your hand without thinking", key: "closeContact" },
      { label: "Shows up the same way they promised to", key: "steadyPresence" },
    ],
  },
  {
    q: "The compliment that actually lands for you is...",
    opts: [
      { label: "I love the way your mind works", key: "spokenWarmth" },
      { label: "I do not know how I would manage without you", key: "helpingHands" },
      { label: "I love having your full attention", key: "undividedTime" },
      { label: "You give the most thoughtful gifts", key: "thoughtfulTokens" },
      { label: "I feel safest when you are close", key: "closeContact" },
      { label: "I always know where I stand with you", key: "steadyPresence" },
    ],
  },
  {
    q: "After a hard stretch, what resets you is...",
    opts: [
      { label: "A long, honest conversation", key: "spokenWarmth" },
      { label: "Someone handling dinner so you can rest", key: "helpingHands" },
      { label: "A whole evening with no agenda but each other", key: "undividedTime" },
      { label: "A small gesture that says they noticed", key: "thoughtfulTokens" },
      { label: "Being held, no words needed", key: "closeContact" },
      { label: "Knowing they will be there tomorrow too", key: "steadyPresence" },
    ],
  },
  {
    q: "What stings most when it is missing?",
    opts: [
      { label: "They stop saying how they feel", key: "spokenWarmth" },
      { label: "I am always the one carrying the load", key: "helpingHands" },
      { label: "They are around but never really present", key: "undividedTime" },
      { label: "The little thoughtful touches fade", key: "thoughtfulTokens" },
      { label: "The easy closeness disappears", key: "closeContact" },
      { label: "I never know where I stand", key: "steadyPresence" },
    ],
  },
];

const ALIGNMENT_META: Record<
  CareDialectProfile["comparison"]["alignment"],
  { label: string; color: string }
> = {
  aligned: { label: "In tune", color: "141 60% 45%" },
  partial: { label: "One surprise", color: "43 70% 55%" },
  surprising: { label: "A real gap", color: "326 80% 62%" },
  unknown: { label: "Not yet read", color: "228 18% 65%" },
};

type Stage = "self" | "quiz" | "result";

function isDialectKey(v: string | null | undefined): v is DialectKey {
  return !!v && (DIALECT_KEYS as readonly string[]).includes(v);
}

function DistributionBars({
  distribution,
  top,
}: {
  distribution: Record<string, number>;
  top: DialectKey | null;
}) {
  const ordered = [...DIALECT_KEYS].sort(
    (a, b) => (distribution[b] ?? 0) - (distribution[a] ?? 0),
  );
  return (
    <div className="space-y-2.5">
      {ordered.map((k) => {
        const pct = Math.round((distribution[k] ?? 0) * 100);
        const meta = DIALECTS[k];
        const Icon = meta.icon;
        const isTop = k === top;
        return (
          <div key={k} className="flex items-center gap-3" data-testid={`bar-${k}`}>
            <Icon
              className="w-4 h-4 flex-shrink-0"
              style={{ color: `hsl(${meta.color})` }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs ${isTop ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {meta.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `hsl(${meta.color})`,
                    opacity: isTop ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CareDialect() {
  useMeta(
    "Care Dialect",
    "Find how you give and receive care, see how your read on yourself compares to your answers, and feed it into who you get matched with.",
  );
  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { data: fetched, isLoading } = useGetCareDialect();
  const save = useSaveCareDialect();

  const [stage, setStage] = useState<Stage | null>(null);
  const [saved, setSaved] = useState<CareDialectProfile | null>(null);
  const [selfGive, setSelfGive] = useState<DialectKey | null>(null);
  const [selfReceive, setSelfReceive] = useState<DialectKey | null>(null);
  const [giveAnswers, setGiveAnswers] = useState<number[]>(
    Array(GIVE_QUESTIONS.length).fill(-1),
  );
  const [receiveAnswers, setReceiveAnswers] = useState<number[]>(
    Array(RECEIVE_QUESTIONS.length).fill(-1),
  );
  const [shared, setShared] = useState(false);

  const activeProfile = saved ?? fetched;
  const isDemo = !!activeProfile?.isDemo;
  const hasProfile = !!activeProfile?.hasProfile;

  // Decide the opening stage once data lands. Anon callers get the demo result;
  // signed-in callers land on their saved result or the start of the funnel. We
  // never override a user who is mid-funnel (stage already set).
  useEffect(() => {
    if (stage !== null || !activeProfile) return;
    if (isDemo) {
      setStage("result");
      return;
    }
    if (hasProfile) {
      setSelfGive(isDialectKey(activeProfile.selfGive) ? activeProfile.selfGive : null);
      setSelfReceive(
        isDialectKey(activeProfile.selfReceive) ? activeProfile.selfReceive : null,
      );
      setStage("result");
      return;
    }
    setStage("self");
  }, [stage, activeProfile, isDemo, hasProfile]);

  function startRetake() {
    setSaved(null);
    setShared(false);
    setGiveAnswers(Array(GIVE_QUESTIONS.length).fill(-1));
    setReceiveAnswers(Array(RECEIVE_QUESTIONS.length).fill(-1));
    setStage("self");
  }

  const giveAnswered = giveAnswers.filter((a) => a >= 0).length;
  const receiveAnswered = receiveAnswers.filter((a) => a >= 0).length;
  const quizComplete =
    giveAnswered === GIVE_QUESTIONS.length &&
    receiveAnswered === RECEIVE_QUESTIONS.length;

  async function handleSubmit() {
    if (!quizComplete) return;
    const payload: SaveCareDialectInput = {
      selfGive: selfGive ?? undefined,
      selfReceive: selfReceive ?? undefined,
      giveAnswers: giveAnswers.map((oi, qi) => GIVE_QUESTIONS[qi].opts[oi].key),
      receiveAnswers: receiveAnswers.map(
        (oi, qi) => RECEIVE_QUESTIONS[qi].opts[oi].key,
      ),
    };
    try {
      const result = await save.mutateAsync({ data: payload });
      setSaved(result);
      setStage("result");
      void queryClient.invalidateQueries({ queryKey: getGetCareDialectQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } catch {
      // Mutation errors surface through save.isError below; keep the funnel open.
    }
  }

  async function handleShare() {
    if (!activeProfile) return;
    const give = isDialectKey(activeProfile.testedGiveTop)
      ? DIALECTS[activeProfile.testedGiveTop].name
      : null;
    const receive = isDialectKey(activeProfile.testedReceiveTop)
      ? DIALECTS[activeProfile.testedReceiveTop].name
      : null;
    if (!give || !receive) return;
    const text = `My Care Dialect on MatchLab: I give care through ${give} and feel it most through ${receive}. Find yours.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Care Dialect", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch {
      // User dismissed the share sheet, nothing to do.
    }
  }

  const isBrandNewUser = isAuthenticated && !hasProfile && stage === "self";

  return (
    <AppLayout>
      <HubTabs hub="mirror" />
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 -left-10 opacity-30 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              <p className="text-sm font-medium text-[hsl(248_62%_62%)]">
                Care Dialect
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              How you give and receive care
            </h1>
            <p className="text-muted-foreground mt-2">
              Pick how you think you love, then answer a few scenarios to see how
              it actually shows up. Your Care Dialect feeds who you get matched
              with.
            </p>
          </motion.div>

          {isDemo && (
            <motion.div
              {...fadeUp(0.04)}
              className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-[hsl(248_62%_62%/0.25)] bg-[hsl(248_62%_62%/0.07)]"
              data-testid="care-dialect-demo-banner"
            >
              <Info className="w-4 h-4 text-[hsl(248_62%_62%)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground/70">
                  This is an example,
                </span>{" "}
                not a real person. Sign in to map your own Care Dialect and count
                it toward matching.
              </p>
            </motion.div>
          )}

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Sparkles className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Care Dialect"
              title="Name how you actually love"
              description="Guess your style, take the quiz, and see where your read on yourself matches what your answers reveal. It becomes part of how the machine matches you."
              testId="care-dialect-empty-state"
            />
          )}

          {isLoading || stage === null ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {stage === "self" && (
                <motion.div key="self" {...fadeUp(0.06)} className="space-y-6">
                  <SelfPickGrid
                    title="How do you think you give care?"
                    selected={selfGive}
                    onSelect={setSelfGive}
                    testPrefix="self-give"
                  />
                  <SelfPickGrid
                    title="And how do you most want to receive it?"
                    selected={selfReceive}
                    onSelect={setSelfReceive}
                    testPrefix="self-receive"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      Your guess is the half we compare against your answers.
                    </p>
                    <Button
                      onClick={() => setStage("quiz")}
                      disabled={!selfGive || !selfReceive}
                      data-testid="button-to-quiz"
                      className="rounded-full px-7 h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 disabled:opacity-40"
                    >
                      Take the quiz
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {stage === "quiz" && (
                <motion.div key="quiz" {...fadeUp(0.06)} className="space-y-8">
                  <QuizBlock
                    heading="How you give care"
                    questions={GIVE_QUESTIONS}
                    answers={giveAnswers}
                    onAnswer={(qi, oi) =>
                      setGiveAnswers((prev) => {
                        const n = [...prev];
                        n[qi] = oi;
                        return n;
                      })
                    }
                    testPrefix="give"
                  />
                  <QuizBlock
                    heading="How you receive care"
                    questions={RECEIVE_QUESTIONS}
                    answers={receiveAnswers}
                    onAnswer={(qi, oi) =>
                      setReceiveAnswers((prev) => {
                        const n = [...prev];
                        n[qi] = oi;
                        return n;
                      })
                    }
                    testPrefix="receive"
                  />
                  {save.isError && (
                    <p className="text-xs text-[hsl(326_80%_62%)] text-center">
                      Something went wrong saving that. Try once more.
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setStage("self")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to your guess
                    </button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!quizComplete || save.isPending}
                      data-testid="button-submit-care-dialect"
                      className="rounded-full px-8 h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-40"
                    >
                      {save.isPending ? (
                        <>
                          <Loader2 className="animate-spin mr-2 h-4 w-4" />
                          Reading your dialect…
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          See my Care Dialect
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {stage === "result" && activeProfile && (
                <ResultView
                  key="result"
                  profile={activeProfile}
                  isDemo={isDemo}
                  shared={shared}
                  onShare={handleShare}
                  onRetake={startRetake}
                  onSignIn={login}
                />
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function SelfPickGrid({
  title,
  selected,
  onSelect,
  testPrefix,
}: {
  title: string;
  selected: DialectKey | null;
  onSelect: (k: DialectKey) => void;
  testPrefix: string;
}) {
  return (
    <div className="glass border border-white/8 rounded-2xl p-6">
      <p className="font-semibold text-foreground text-sm mb-4">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DIALECT_KEYS.map((k) => {
          const meta = DIALECTS[k];
          const Icon = meta.icon;
          const active = selected === k;
          return (
            <button
              key={k}
              onClick={() => onSelect(k)}
              data-testid={`${testPrefix}-${k}`}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-all ${
                active
                  ? "bg-[hsl(248_62%_52%/0.12)] border-[hsl(248_62%_52%/0.4)]"
                  : "border-white/8 hover:border-white/15"
              }`}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: `hsl(${meta.color})` }}
              />
              <span>
                <span
                  className={`block text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {meta.name}
                </span>
                <span className="block text-xs text-muted-foreground/70 mt-0.5 leading-snug">
                  {meta.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuizBlock({
  heading,
  questions,
  answers,
  onAnswer,
  testPrefix,
}: {
  heading: string;
  questions: QuizQuestion[];
  answers: number[];
  onAnswer: (qi: number, oi: number) => void;
  testPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[hsl(248_62%_62%)]">{heading}</p>
      {questions.map((q, qi) => (
        <div key={qi} className="glass border border-white/8 rounded-2xl p-6">
          <p className="font-semibold text-foreground text-sm mb-4">
            <span className="text-muted-foreground/40 mr-2">{qi + 1}.</span>
            {q.q}
          </p>
          <div className="space-y-2">
            {q.opts.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => onAnswer(qi, oi)}
                data-testid={`${testPrefix}-q${qi}-opt${oi}`}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  answers[qi] === oi
                    ? "bg-[hsl(248_62%_52%/0.15)] border-[hsl(248_62%_52%/0.4)] text-[hsl(248_62%_65%)]"
                    : "border-white/8 text-muted-foreground hover:border-white/15 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AxisCard({
  label,
  top,
  distribution,
}: {
  label: string;
  top: DialectKey | null;
  distribution: Record<string, number>;
}) {
  const meta = top ? DIALECTS[top] : null;
  const Icon = meta?.icon;
  return (
    <div className="glass border border-white/8 rounded-2xl p-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
        {label}
      </p>
      <div className="flex items-center gap-3 mb-5">
        {Icon && meta && (
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `hsl(${meta.color} / 0.12)` }}
          >
            <Icon className="w-5 h-5" style={{ color: `hsl(${meta.color})` }} />
          </span>
        )}
        <div>
          <p className="text-lg font-bold text-foreground">
            {meta ? meta.name : "Not yet tested"}
          </p>
          {meta && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              {meta.blurb}
            </p>
          )}
        </div>
      </div>
      <DistributionBars distribution={distribution} top={top} />
    </div>
  );
}

function ResultView({
  profile,
  isDemo,
  shared,
  onShare,
  onRetake,
  onSignIn,
}: {
  profile: CareDialectProfile;
  isDemo: boolean;
  shared: boolean;
  onShare: () => void;
  onRetake: () => void;
  onSignIn: () => void;
}) {
  const giveTop = isDialectKey(profile.testedGiveTop)
    ? profile.testedGiveTop
    : null;
  const receiveTop = isDialectKey(profile.testedReceiveTop)
    ? profile.testedReceiveTop
    : null;
  const alignment = ALIGNMENT_META[profile.comparison.alignment];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
      data-testid="care-dialect-result"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AxisCard
          label="How you give care"
          top={giveTop}
          distribution={profile.testedGiveDistribution}
        />
        <AxisCard
          label="How you receive care"
          top={receiveTop}
          distribution={profile.testedReceiveDistribution}
        />
      </div>

      {/* Self vs tested comparison */}
      <div
        className="rounded-2xl p-6 border"
        style={{
          background: `hsl(${alignment.color} / 0.07)`,
          borderColor: `hsl(${alignment.color} / 0.25)`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: `hsl(${alignment.color} / 0.15)`,
              color: `hsl(${alignment.color})`,
            }}
          >
            {alignment.label}
          </span>
          <p className="text-sm font-semibold text-foreground">
            Your guess vs your answers
          </p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {profile.comparison.insight}
        </p>
        {profile.narrative && (
          <div className="mt-4 pt-4 border-t border-white/8">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(248_62%_62%)]" />
              <p className="text-xs font-semibold text-[hsl(248_62%_62%)]">
                Deeper read
              </p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {profile.narrative}
            </p>
          </div>
        )}
      </div>

      {/* How this feeds matching, reveal-safe */}
      <div className="glass border border-white/8 rounded-2xl p-6">
        <p className="font-semibold text-foreground text-sm mb-2">
          How this shapes your matches
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your Care Dialect now feeds matching. We look for people whose way of
          giving care fits how you want to receive it, and the other way around.
          You never see anyone's private dialect, we only use the fit to surface
          better matches near you.
        </p>
      </div>

      {isDemo ? (
        <button
          onClick={onSignIn}
          data-testid="button-signin-care-dialect"
          className="w-full rounded-2xl p-5 border border-[hsl(248_62%_62%/0.3)] bg-[hsl(248_62%_62%/0.08)] flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:bg-[hsl(248_62%_62%/0.12)] transition-colors"
        >
          <Lock className="w-4 h-4" />
          Sign in to map your own Care Dialect
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button
              onClick={onShare}
              variant="outline"
              data-testid="button-share-care-dialect"
              className="flex-1 rounded-full h-11 font-semibold border-white/12"
            >
              {shared ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share my dialect
                </>
              )}
            </Button>
          </div>

          <ToolHandoff
            testId="care-dialect-handoff"
            fedLine="Your Care Dialect is saved and counts toward matching. Keep building the picture the machine has of you."
            steps={[
              {
                label: "Check your readiness",
                href: "/me",
                desc: "Watch your Match Readiness climb.",
              },
              {
                label: "Get a compatibility read",
                href: "/compatibility-compass",
                desc: "See how your style reads for fit.",
              },
              {
                label: "Map your wellness",
                href: "/wellness",
                desc: "Turn more of yourself into saved signal.",
              },
            ]}
          />

          <div className="flex justify-center">
            <button
              onClick={onRetake}
              data-testid="button-retake-care-dialect"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retake
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
