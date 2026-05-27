import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Sparkles, Copy, Check, RefreshCw, Share2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const QUESTIONS = [
  {
    q: "When you first meet someone you're attracted to, you tend to...",
    opts: [
      { label: "Feel excited and lean in quickly", scores: { sparkChaser: 2, intensityResponder: 1 } },
      { label: "Feel interested but take time to open up", scores: { slowBurn: 2, guardedRomantic: 1 } },
      { label: "Watch and assess before deciding", scores: { qualityFilter: 2, steadySeeker: 1 } },
      { label: "Feel nervous and hyper-aware of how you're coming across", scores: { anxiousConfirmer: 2, lowTrustDater: 1 } },
    ],
  },
  {
    q: "When someone you like pulls back or goes quiet, you usually...",
    opts: [
      { label: "Feel anxious and reach out to check in", scores: { anxiousConfirmer: 2, intensityResponder: 1 } },
      { label: "Give them space and wait", scores: { steadySeeker: 1, secureBuilder: 2 } },
      { label: "Move on — you don't chase", scores: { qualityFilter: 2, avoidantEditor: 1 } },
      { label: "Wonder what you did wrong and replay the interactions", scores: { anxiousConfirmer: 1, lowTrustDater: 2 } },
    ],
  },
  {
    q: "What you value most in early dating is...",
    opts: [
      { label: "The electric spark — you'll know it when you feel it", scores: { sparkChaser: 2, intensityResponder: 1 } },
      { label: "Slow discovery — getting to know someone real", scores: { slowBurn: 2, secureBuilder: 1 } },
      { label: "Clarity — you want to know where it's going", scores: { qualityFilter: 1, steadySeeker: 2 } },
      { label: "Ease — it should feel comfortable, not effortful", scores: { avoidantEditor: 1, secureBuilder: 1, guardedRomantic: 1 } },
    ],
  },
  {
    q: "Your biggest challenge in dating tends to be...",
    opts: [
      { label: "You fall fast and it doesn't usually work out the way you hoped", scores: { sparkChaser: 2, intensityResponder: 1 } },
      { label: "People think you're not interested when you actually are", scores: { slowBurn: 2, avoidantEditor: 1 } },
      { label: "Finding someone who actually meets your standards", scores: { qualityFilter: 2, guardedRomantic: 1 } },
      { label: "Feeling safe enough to be fully yourself", scores: { anxiousConfirmer: 1, lowTrustDater: 2, guardedRomantic: 1 } },
    ],
  },
  {
    q: "After a great first date, you're most likely to...",
    opts: [
      { label: "Text them that night or early the next morning", scores: { sparkChaser: 1, anxiousConfirmer: 2 } },
      { label: "Wait a few days — you're processing whether it was real", scores: { slowBurn: 2, avoidantEditor: 1 } },
      { label: "Already be thinking about long-term fit", scores: { qualityFilter: 2, steadySeeker: 1 } },
      { label: "Feel good but replay it to check how you came across", scores: { anxiousConfirmer: 1, lowTrustDater: 2 } },
    ],
  },
  {
    q: "In a relationship that's going well, your tendency is to...",
    opts: [
      { label: "Dive deep — you're all in once you decide", scores: { intensityResponder: 2, sparkChaser: 1 } },
      { label: "Invest slowly as trust builds — loyalty comes after time", scores: { slowBurn: 2, secureBuilder: 1 } },
      { label: "Maintain some independence as a natural default", scores: { avoidantEditor: 2, qualityFilter: 1 } },
      { label: "Make sure they're still happy and still want to be there", scores: { anxiousConfirmer: 2, lowTrustDater: 1 } },
    ],
  },
];

type ArchetypeKey =
  | "sparkChaser" | "slowBurn" | "qualityFilter" | "steadySeeker"
  | "guardedRomantic" | "anxiousConfirmer" | "secureBuilder"
  | "intensityResponder" | "avoidantEditor" | "lowTrustDater";

const ARCHETYPES: Record<ArchetypeKey, {
  name: string; emoji: string; color: string; bg: string; border: string;
  meaning: string; strengths: string[]; riskLoop: string;
  nextExperiment: string; shareableSummary: string;
}> = {
  sparkChaser: {
    name: "The Spark Chaser",
    emoji: "⚡",
    color: "hsl(43 65% 65%)",
    bg: "hsl(43 65% 65% / 0.08)",
    border: "hsl(43 65% 65% / 0.25)",
    meaning: "You're drawn to intensity and chemistry above all else — the feeling of electricity between two people is your primary signal that something is real. You recognize potential quickly and move toward it fast. The challenge is that the spark and the person are not always the same thing.",
    strengths: ["You feel things fully — intensity is genuine, not performed", "You recognize chemistry fast and act on it decisively", "You bring real energy into early connection", "You don't coast — you're present and invested when you're in"],
    riskLoop: "The loop: strong chemistry → fast attachment → the person starts becoming real (flawed, inconsistent, or just different from the idea) → the spark dims → you pull back or the connection collapses. The exit point: before acting on the spark, give it 3-4 interactions to test whether it's chemistry or just novelty.",
    nextExperiment: "The next time you feel undeniable pull, stay curious about the person for 30 days before making any big decisions. Track whether the spark deepens into something real or just loops on itself. Chemistry is real data — it's also a very specific kind of data.",
    shareableSummary: "I'm a Spark Chaser — I feel things fast and move toward connection decisively. My growth edge: letting the spark season before betting everything on it. ✨",
  },
  slowBurn: {
    name: "The Slow Burn",
    emoji: "🕯️",
    color: "hsl(248 62% 52%)",
    bg: "hsl(248 62% 52% / 0.08)",
    border: "hsl(248 62% 52% / 0.25)",
    meaning: "You are someone who opens gradually, whose depth appears over time, and whose loyalty — once given — is extraordinary. The challenge is that early dating rewards speed and visibility, and you tend to show up fully only after the early window has closed.",
    strengths: ["Deeply loyal once trust is established", "Relationships with you tend to get better over time", "You don't perform — what people see is real", "Your depth is genuine, not rehearsed"],
    riskLoop: "The loop: slow reveal → person interprets caution as disinterest or unavailability → they pull back or move on → you assume it wasn't right → actually it just needed more time than the format allows. The exit point: one small earlier signal of genuine interest changes the dynamic significantly.",
    nextExperiment: "In your next promising connection, share one true, specific thing about yourself earlier than feels comfortable — not a disclosure, just a real detail. The goal is to give the other person something to hold onto while you're still arriving.",
    shareableSummary: "I'm a Slow Burn — I open gradually, love deeply, and get better over time. My growth edge: letting people see the warmth before they've decided. 🕯️",
  },
  qualityFilter: {
    name: "The Quality Filter",
    emoji: "🔎",
    color: "hsl(190 55% 60%)",
    bg: "hsl(190 55% 60% / 0.08)",
    border: "hsl(190 55% 60% / 0.25)",
    meaning: "You have high standards, you know what you want, and you don't settle easily. This is a strength — most people are far too undiscriminating in early dating. The shadow side: the filter sometimes runs before someone has had a full chance to show up.",
    strengths: ["You don't waste time on mismatched situations", "Your self-knowledge is advanced — you know what works for you", "You attract people who can meet your level", "You're not easily fooled by performance"],
    riskLoop: "The loop: high standards → assessed quickly → not quite right → passed on → repeat. The problem is not the standards — it's that some of the best fits reveal themselves slowly. The filter, applied at full strength too early, eliminates real possibilities.",
    nextExperiment: "The next person you're about to pass on — give it one more interaction. Not to lower your standards, but to check whether you've been assessing the performance rather than the person. Ask one real question and see what appears.",
    shareableSummary: "I'm a Quality Filter — I know what I want and I don't compromise on what matters. My growth edge: making sure I see the person, not just the preview. 🔎",
  },
  steadySeeker: {
    name: "The Steady Seeker",
    emoji: "🧭",
    color: "hsl(142 55% 60%)",
    bg: "hsl(142 55% 60% / 0.08)",
    border: "hsl(142 55% 60% / 0.25)",
    meaning: "You want a partnership — real, reliable, lasting. You show up consistently, you communicate clearly, and you take the process seriously. The challenge is that in an environment that rewards game-playing and artificial scarcity, your directness can read as low-stakes rather than high-confidence.",
    strengths: ["You know what you want and pursue it honestly", "You're consistent — people know where they stand with you", "You don't create unnecessary drama or ambiguity", "Your emotional availability is a genuine asset"],
    riskLoop: "The loop: genuine availability → person doesn't feel the need to invest quickly → they slow-play → you wonder if you're too available → start managing your availability artificially → dynamic becomes less honest → connection suffers. The exit: availability is only a problem when matched with someone who doesn't want what you're offering.",
    nextExperiment: "Find one area where you're pursuing rather than letting things come to you, and create a pause of 48-72 hours. Not as a game — as information. Notice what they do in the space. The data tells you something.",
    shareableSummary: "I'm a Steady Seeker — I want something real and I show up for it honestly. My growth edge: making sure the right person can feel the value, not just the safety. 🧭",
  },
  guardedRomantic: {
    name: "The Guarded Romantic",
    emoji: "🗝️",
    color: "hsl(326 100% 65%)",
    bg: "hsl(326 100% 65% / 0.08)",
    border: "hsl(326 100% 65% / 0.25)",
    meaning: "You want real connection — deeply. And you've learned, through experience, to protect the part of you that wants it. The result is a push-pull pattern: you move toward connection and then, as it gets real, something protective activates. You're not cold — you're careful.",
    strengths: ["The depth you're protecting is real and worth knowing", "Your loyalty, when earned, is extraordinary", "You read situations well — your self-protection instinct has valuable signal", "You bring real intensity once the walls come down"],
    riskLoop: "The loop: something real starts forming → it starts to feel like it might actually matter → protection activates → you create distance → they misread it as disinterest → they pull back → you interpret their pull-back as confirmation you were right to protect → connection ends. The exit: catch the protection instinct before it shapes behavior.",
    nextExperiment: "The next time you feel yourself creating distance from something promising, name it to yourself first: I'm protecting. Then ask: what specifically am I protecting against? Is that thing actually likely here? Make the choice consciously instead of automatically.",
    shareableSummary: "I'm a Guarded Romantic — I want depth more than almost anything, and I've learned to protect that want carefully. My growth edge: making the protection conscious. 🗝️",
  },
  anxiousConfirmer: {
    name: "The Anxious Confirmer",
    emoji: "💬",
    color: "hsl(348 55% 65%)",
    bg: "hsl(348 55% 65% / 0.08)",
    border: "hsl(348 55% 65% / 0.25)",
    meaning: "You care deeply — perhaps more than most — and that care expresses itself as a high need for reassurance that the connection is still real. You're genuinely interested, genuinely warm, and genuinely invested. The challenge is that the checking-in can feel like pressure to someone who hasn't yet matched your level.",
    strengths: ["You're genuinely invested — you don't coast", "Your caring shows and is recognized as real", "You communicate — you don't leave people wondering where they stand", "Your capacity for intimacy is high once you feel safe"],
    riskLoop: "The loop: feel uncertain → check in or reach out → person feels slightly crowded → pulls back slightly → you feel the pull-back → anxiety increases → you check in again → dynamic becomes managed rather than natural. The exit: learn to self-soothe first, communicate second.",
    nextExperiment: "The next time you feel the urge to check in, wait 24 hours and see whether the need passes or stays. If it stays, the question becomes: is this information about them or about what I need right now? Answer that first.",
    shareableSummary: "I'm an Anxious Confirmer — I feel things deeply and my caring shows. My growth edge: learning to trust the connection in the quiet. 💬",
  },
  secureBuilder: {
    name: "The Secure Builder",
    emoji: "🏛️",
    color: "hsl(190 55% 60%)",
    bg: "hsl(190 55% 60% / 0.08)",
    border: "hsl(190 55% 60% / 0.25)",
    meaning: "You have a relatively healthy relationship with intimacy — you're comfortable moving toward connection without either rushing it or running from it. You have reasonably good self-knowledge, communicate clearly, and don't create unnecessary drama. This is genuinely uncommon and genuinely attractive.",
    strengths: ["You don't create chaos — relationships with you tend to feel calm and real", "You're clear about what you want without being rigid about it", "You can handle uncertainty without catastrophizing", "The right people feel safe with you quickly"],
    riskLoop: "Your risk is subtler: stability can attract people who want what you have without offering the same in return. The loop: your groundedness → they feel safe → they take more than they bring → you over-adjust → start giving in ways that cost you. The question to hold: are they building toward you, or anchoring to you?",
    nextExperiment: "In your next promising connection, periodically check the reciprocity: are they investing at a level that matches yours? Not perfectly — early asymmetry is normal — but directionally? The build should feel mutual.",
    shareableSummary: "I'm a Secure Builder — I show up steadily, communicate clearly, and build toward real things. My growth edge: making sure the person I'm building with is building too. 🏛️",
  },
  intensityResponder: {
    name: "The Intensity Responder",
    emoji: "🔥",
    color: "hsl(43 65% 65%)",
    bg: "hsl(43 65% 65% / 0.08)",
    border: "hsl(43 65% 65% / 0.25)",
    meaning: "You come alive in high-emotion, high-stakes situations — the beginning of something, a crisis, a dramatic moment. You're not manufacturing drama; you're genuinely more alive when the stakes feel real. The challenge is that sustainable relationships are mostly made of ordinary moments, and ordinary can feel like disappearing.",
    strengths: ["You're fully present when things feel alive and real", "You bring intensity that some people find irresistible", "You don't do halfway — when you're in, you're in", "You're rarely boring to be with"],
    riskLoop: "The loop: ordinary phase of relationship → you feel yourself dimming → unconsciously create intensity (conflict, tests, distance) → spark comes back → calm again → dim again → pattern escalates. The exit: learn to find aliveness in depth and consistency, not just stakes.",
    nextExperiment: "Find one small, ordinary moment in an existing or potential connection and practice being fully present for it — not escalating it, just meeting it. See whether quiet can feel like something.",
    shareableSummary: "I'm an Intensity Responder — I come alive in real, high-stakes connection. My growth edge: finding the aliveness in the ordinary. 🔥",
  },
  avoidantEditor: {
    name: "The Avoidant Editor",
    emoji: "✏️",
    color: "hsl(228 18% 65%)",
    bg: "hsl(228 18% 65% / 0.08)",
    border: "hsl(228 18% 65% / 0.25)",
    meaning: "You are private by nature, selective about where your energy goes, and tend to withdraw when relationships start requiring more emotional output than feels comfortable. This isn't coldness — it's a highly developed self-protective system that has served you well and also costs you connection.",
    strengths: ["Your independence is real and attractive to the right people", "You're not needy — you can function well in your own company", "You don't overshare or create emotional pressure early", "When you do invest, it feels chosen, not compulsive"],
    riskLoop: "The loop: closeness starts → internal discomfort with the demand of it → pulling back or going quiet → person feels the pull and gets confused or hurt → they escalate to get reassurance → you pull back further → connection becomes draining → you exit. The exit: catching the discomfort before it becomes distance.",
    nextExperiment: "Identify one specific moment in your recent history where you went quiet or pulled back. What triggered it? Not the external event — the internal feeling. Name it. That feeling is the information.",
    shareableSummary: "I'm an Avoidant Editor — I need space to be real, and connection works best when it doesn't feel like a demand. My growth edge: staying present when closeness starts feeling costly. ✏️",
  },
  lowTrustDater: {
    name: "The Low-Trust Dater",
    emoji: "🔒",
    color: "hsl(326 100% 65%)",
    bg: "hsl(326 100% 65% / 0.08)",
    border: "hsl(326 100% 65% / 0.25)",
    meaning: "You've been burned enough times that trust doesn't come easily — and you approach early dating with a significant amount of skepticism and self-monitoring. This isn't a flaw; it's adaptation. The challenge is that the protective system can make it genuinely hard for trustworthy people to reach you.",
    strengths: ["You don't give your trust cheaply — which means it means something when you do", "You read situations carefully and accurately", "You're not easily manipulated by charm or performance", "Your self-awareness is high — you've done the work"],
    riskLoop: "The loop: promising person appears → skepticism activates → you test (consciously or not) → person doesn't know what they're being tested for → they respond imperfectly → you take it as confirmation → exit. The problem: good people fail low-trust tests not because they're not trustworthy, but because they don't know the test is happening.",
    nextExperiment: "In your next promising connection, name one thing the person would need to do to build genuine trust with you — not a test, just a real quality. Then see whether they're actually exhibiting it, rather than watching for them to fail.",
    shareableSummary: "I'm a Low-Trust Dater — I'm careful with my trust because it means something. My growth edge: building a path for the right person to actually reach me. 🔒",
  },
};

type Scores = Partial<Record<ArchetypeKey, number>>;

function computeArchetype(answers: number[]): ArchetypeKey {
  const scores: Scores = {};
  answers.forEach((answerIdx, qIdx) => {
    if (answerIdx < 0) return;
    const opt = QUESTIONS[qIdx].opts[answerIdx];
    Object.entries(opt.scores).forEach(([k, v]) => {
      scores[k as ArchetypeKey] = (scores[k as ArchetypeKey] ?? 0) + v;
    });
  });
  let best: ArchetypeKey = "steadySeeker";
  let bestScore = -1;
  (Object.entries(scores) as [ArchetypeKey, number][]).forEach(([k, v]) => {
    if (v > bestScore) { bestScore = v; best = k; }
  });
  return best;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy summary"}
    </button>
  );
}

export default function Archetype() {
  useMeta("Dating Archetype", "A short quiz that reveals your dating style — how you connect, what your risk loop looks like, and the one experiment that could change your results.");
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1));
  const [result, setResult] = useState<ArchetypeKey | null>(null);
  const answered = answers.filter(a => a >= 0).length;
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;

  function handleAnswer(qi: number, oi: number) {
    setAnswers(prev => { const n = [...prev]; n[qi] = oi; return n; });
  }

  function handleSubmit() {
    setResult(computeArchetype(answers));
  }

  const archetype = result ? ARCHETYPES[result] : null;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 right-0 opacity-30 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Self-Insight</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Dating Archetype</h1>
            <p className="text-muted-foreground mt-2">Six questions. A shareable result that actually says something true about how you connect.</p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Sparkles className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Dating Archetype"
              title="Find out how you actually connect"
              description="Six quick questions and you'll get a shareable archetype that names your dating style, the risk loop underneath it, and the one experiment that could change your results."
              testId="archetype-empty-state"
            />
          )}

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="quiz" {...fadeUp(0.05)} className="space-y-5">
                {QUESTIONS.map((q, qi) => (
                  <div key={qi} className="glass border border-white/8 rounded-2xl p-6">
                    <p className="font-semibold text-foreground text-sm mb-4">
                      <span className="text-muted-foreground/50 mr-2">{qi + 1}.</span>{q.q}
                    </p>
                    <div className="space-y-2">
                      {q.opts.map((opt, oi) => (
                        <button key={oi} onClick={() => handleAnswer(qi, oi)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${answers[qi] === oi ? "bg-[hsl(248_62%_52%/0.15)] border-[hsl(248_62%_52%/0.4)] text-[hsl(248_62%_65%)]" : "border-white/8 text-muted-foreground hover:border-white/15 hover:text-foreground"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">{answered} of {QUESTIONS.length} answered</p>
                  <Button onClick={handleSubmit} disabled={answered < QUESTIONS.length}
                    className="rounded-full px-8 h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-40">
                    <Sparkles className="mr-2 h-4 w-4" />Reveal My Archetype
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="space-y-5">
                {/* Header Card */}
                <div className="rounded-3xl p-8 border text-center" style={{ background: archetype!.bg, borderColor: archetype!.border }}>
                  <div className="text-5xl mb-4">{archetype!.emoji}</div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">{archetype!.name}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{archetype!.meaning}</p>
                </div>

                {/* Strengths */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-3">Strengths</p>
                  <ul className="space-y-2">
                    {archetype!.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: archetype!.color }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risk Loop */}
                <div className="glass border border-white/8 rounded-2xl p-6" style={{ borderColor: "hsl(348 55% 65% / 0.2)" }}>
                  <p className="font-semibold text-foreground text-sm mb-2">Your Risk Loop</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{archetype!.riskLoop}</p>
                </div>

                {/* Next Experiment */}
                <div className="rounded-2xl p-6 border" style={{ background: `${archetype!.bg}`, borderColor: archetype!.border }}>
                  <p className="font-semibold text-foreground text-sm mb-2">Next Experiment</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{archetype!.nextExperiment}</p>
                </div>

                {/* Shareable Summary */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shareable Summary</p>
                    </div>
                    <CopyButton text={archetype!.shareableSummary} />
                  </div>
                  <p className="text-sm text-foreground/80 italic leading-relaxed">"{archetype!.shareableSummary}"</p>
                </div>

                <div className="flex justify-center pt-2">
                  <button onClick={() => { setResult(null); setAnswers(Array(QUESTIONS.length).fill(-1)); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Retake the quiz
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
