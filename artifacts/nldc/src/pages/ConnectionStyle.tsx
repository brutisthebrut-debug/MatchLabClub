import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Loader2, Sparkles, RefreshCw, Info } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const QUESTIONS = [
  {
    q: "When a new connection goes quiet for a few days, you tend to...",
    opts: [
      { label: "Feel anxious and wonder what you did wrong", scores: { anxiousConfirmer: 2, lowTrustDater: 1 } },
      { label: "Notice it but give them space — you trust the process", scores: { secureBuilder: 2, steadySeeker: 1 } },
      { label: "Feel relieved — the quiet is a break from the intensity", scores: { avoidantEditor: 2, guardedRomantic: 1 } },
      { label: "Reach out once and then leave it — you don't chase", scores: { qualityFilter: 2, sparkChaser: 1 } },
    ],
  },
  {
    q: "When you start really liking someone, you tend to...",
    opts: [
      { label: "Go all-in fast — you feel it and you act on it", scores: { sparkChaser: 2, intensityResponder: 1 } },
      { label: "Feel the pull but move slowly — you're watching how they show up", scores: { slowBurn: 2, guardedRomantic: 1 } },
      { label: "Get slightly more cautious — something to protect now", scores: { guardedRomantic: 2, lowTrustDater: 1 } },
      { label: "Feel good and let it unfold naturally", scores: { secureBuilder: 2, steadySeeker: 1 } },
    ],
  },
  {
    q: "How do you usually handle conflict or tension in early dating?",
    opts: [
      { label: "Bring it up — you'd rather address it than let it sit", scores: { secureBuilder: 2, directSeeker: 1 } },
      { label: "Go quiet and process first, then talk", scores: { avoidantEditor: 1, slowBurn: 2 } },
      { label: "Feel anxious about it and want to resolve it quickly", scores: { anxiousConfirmer: 2, sparkChaser: 1 } },
      { label: "Step back entirely — tension feels like a signal to leave", scores: { avoidantEditor: 2, guardedRomantic: 1 } },
    ],
  },
  {
    q: "What does emotional closeness feel like to you?",
    opts: [
      { label: "Something I want and move toward", scores: { sparkChaser: 1, secureBuilder: 2, steadySeeker: 1 } },
      { label: "Something I want but have to earn — for them and for me", scores: { slowBurn: 2, guardedRomantic: 1 } },
      { label: "Something that can feel like a lot to manage", scores: { avoidantEditor: 2, intensityResponder: 1 } },
      { label: "Something I need confirmed often to feel safe", scores: { anxiousConfirmer: 2, lowTrustDater: 1 } },
    ],
  },
  {
    q: "When a connection is going really well, you...",
    opts: [
      { label: "Feel fully present and excited — you're in", scores: { sparkChaser: 1, intensityResponder: 2, secureBuilder: 1 } },
      { label: "Still pace yourself — good so far doesn't mean safe yet", scores: { guardedRomantic: 2, slowBurn: 1 } },
      { label: "Enjoy it but keep one foot out the door, just in case", scores: { avoidantEditor: 2, lowTrustDater: 1 } },
      { label: "Feel good but keep checking whether they still feel the same", scores: { anxiousConfirmer: 2, steadySeeker: 1 } },
    ],
  },
  {
    q: "What's your relationship to the 'talking stage'?",
    opts: [
      { label: "It's exhausting — I want to know quickly whether this is real", scores: { qualityFilter: 2, directSeeker: 1 } },
      { label: "I don't mind it — I use the time to see how they actually show up", scores: { slowBurn: 2, secureBuilder: 1 } },
      { label: "It's fine but I get anxious when it drags on without clarity", scores: { anxiousConfirmer: 2, steadySeeker: 1 } },
      { label: "I tend to overthink it — I'm reading every interaction for signals", scores: { lowTrustDater: 2, guardedRomantic: 1 } },
    ],
  },
];

type StyleKey = "sparkChaser" | "slowBurn" | "qualityFilter" | "steadySeeker" | "guardedRomantic" | "anxiousConfirmer" | "secureBuilder" | "intensityResponder" | "avoidantEditor" | "lowTrustDater" | "directSeeker";

const STYLES: Record<StyleKey, {
  name: string; emoji: string; color: string; bg: string; border: string;
  tagline: string; strengths: string[]; activationPattern: string; whatHelps: string; nextExperiment: string;
}> = {
  sparkChaser: {
    name: "Spark Chaser",
    emoji: "⚡",
    color: "hsl(43 65% 65%)",
    bg: "hsl(43 65% 65% / 0.08)",
    border: "hsl(43 65% 65% / 0.25)",
    tagline: "You feel things fast and you act on them. The electric pull is your primary signal — and your primary challenge.",
    strengths: ["Fully present when you're in", "Moves decisively — doesn't overthink entry", "Brings real energy into connection"],
    activationPattern: "Activated by intensity and chemistry. The initial spark triggers fast attachment. Tends to dim when the connection becomes predictable.",
    whatHelps: "Slowing down the first 30 days. Testing whether the spark deepens or loops. Getting clear on whether you're attracted to the person or to the feeling.",
    nextExperiment: "After the initial rush on your next connection, track how the chemistry evolves over 4–6 weeks before making any big decisions.",
  },
  slowBurn: {
    name: "Slow Burn",
    emoji: "🕯️",
    color: "hsl(268 52% 68%)",
    bg: "hsl(268 52% 68% / 0.08)",
    border: "hsl(268 52% 68% / 0.25)",
    tagline: "You open gradually, invest deeply, and get significantly better over time. The challenge is that early dating rewards speed.",
    strengths: ["Loyalty is genuine, not performed", "Relationships with you improve over time", "Depth is real — people who earn it stay"],
    activationPattern: "Activates fully once safety is established. Can read as unavailable or uninterested before the threshold is crossed.",
    whatHelps: "Signaling interest earlier — not fully opening up, just giving people enough to stay. One specific detail shared earlier changes the dynamic.",
    nextExperiment: "In your next connection, share one genuine thing about yourself earlier than feels comfortable. Just one. Notice what it changes.",
  },
  qualityFilter: {
    name: "Quality Filter",
    emoji: "🔎",
    color: "hsl(190 55% 60%)",
    bg: "hsl(190 55% 60% / 0.08)",
    border: "hsl(190 55% 60% / 0.25)",
    tagline: "You have high standards and you apply them early. This is a strength — the shadow is that the filter sometimes runs before someone has shown up fully.",
    strengths: ["Doesn't waste time on mismatched situations", "Advanced self-knowledge about what works", "Not easily fooled by performance"],
    activationPattern: "Assesses quickly, often before the person has had a full chance to show up. The standard is real; the timing can be early.",
    whatHelps: "One more interaction before the filter closes. Not to lower the bar — to make sure you're assessing the person, not the preview.",
    nextExperiment: "The next time you're about to pass, give it one more genuine conversation. Ask one real question and see what emerges.",
  },
  steadySeeker: {
    name: "Steady Seeker",
    emoji: "🧭",
    color: "hsl(142 55% 60%)",
    bg: "hsl(142 55% 60% / 0.08)",
    border: "hsl(142 55% 60% / 0.25)",
    tagline: "You want partnership — real, reliable, lasting. You show up consistently and communicate what you want. The challenge: availability can read as low-stakes.",
    strengths: ["Consistent — people know where they stand", "Clear about what you want without rigidity", "Genuine emotional availability"],
    activationPattern: "Moves steadily and honestly toward connection. May pursue more than pursue-back, which creates asymmetry over time.",
    whatHelps: "Occasional deliberate pauses to let the other person come toward you. Not as games — as information about their actual interest level.",
    nextExperiment: "In your next promising connection, create one natural pause of 48 hours and notice what they do in that space.",
  },
  guardedRomantic: {
    name: "Guarded Romantic",
    emoji: "🗝️",
    color: "hsl(285 45% 65%)",
    bg: "hsl(285 45% 65% / 0.08)",
    border: "hsl(285 45% 65% / 0.25)",
    tagline: "You want real connection more than almost anything. And you've learned to protect that want carefully. The push-pull pattern is the result.",
    strengths: ["Depth is real when trust is established", "Loyalty once earned is extraordinary", "Self-awareness about what you're doing"],
    activationPattern: "Moves toward connection, then protects as it becomes real. The pull-back is often unconscious — a protection mechanism rather than a decision.",
    whatHelps: "Making the protection conscious. Asking: what am I protecting against, specifically? Is that thing actually likely here?",
    nextExperiment: "The next time you feel yourself creating distance from something promising, name it out loud to yourself before acting on it.",
  },
  anxiousConfirmer: {
    name: "Anxious Confirmer",
    emoji: "💬",
    color: "hsl(348 55% 65%)",
    bg: "hsl(348 55% 65% / 0.08)",
    border: "hsl(348 55% 65% / 0.25)",
    tagline: "You care deeply and that care shows as a need for reassurance. Genuine warmth and investment — the challenge is that checking-in can feel like pressure.",
    strengths: ["Genuinely invested — doesn't coast", "Communicates openly", "Capacity for intimacy is high once safe"],
    activationPattern: "Uncertainty triggers checking-in, which can create pressure, which creates distance, which creates more uncertainty. The loop.",
    whatHelps: "Self-soothing before communicating. Asking whether the urge to reach out is about the other person or about managing anxiety.",
    nextExperiment: "The next time you feel the urge to check in, wait 24 hours. See whether the need passes or stays. Answer that before acting.",
  },
  secureBuilder: {
    name: "Secure Builder",
    emoji: "🏛️",
    color: "hsl(190 55% 60%)",
    bg: "hsl(190 55% 60% / 0.08)",
    border: "hsl(190 55% 60% / 0.25)",
    tagline: "You're relatively comfortable with intimacy — moving toward connection without rushing it or fleeing from it. This is uncommon and genuinely attractive.",
    strengths: ["Doesn't create unnecessary chaos", "Clear communication without rigidity", "Can hold uncertainty without catastrophizing"],
    activationPattern: "Steady, honest investment. The main risk: attracting people who want what you offer without reciprocating.",
    whatHelps: "Checking reciprocity regularly. Making sure the other person is building toward you, not just anchoring to your stability.",
    nextExperiment: "Periodically check whether the investment is directionally mutual — not perfectly balanced, but moving the same way.",
  },
  intensityResponder: {
    name: "Intensity Responder",
    emoji: "🔥",
    color: "hsl(43 65% 65%)",
    bg: "hsl(43 65% 65% / 0.08)",
    border: "hsl(43 65% 65% / 0.25)",
    tagline: "You come alive in high-emotion, high-stakes moments. You're not creating drama — you're genuinely more present when things feel real.",
    strengths: ["Fully present when things matter", "Brings undeniable intensity", "Never boring to be with"],
    activationPattern: "Thrives in the beginning and in crisis. Can feel underpowered in the ordinary middle of a good relationship — which sometimes creates artificial intensity.",
    whatHelps: "Finding aliveness in depth and consistency, not just stakes. Practicing presence in quiet moments.",
    nextExperiment: "Find one small, ordinary moment in a connection and practice being fully there — not escalating it, just meeting it.",
  },
  avoidantEditor: {
    name: "Avoidant Editor",
    emoji: "✏️",
    color: "hsl(228 18% 65%)",
    bg: "hsl(228 18% 65% / 0.08)",
    border: "hsl(228 18% 65% / 0.25)",
    tagline: "You withdraw when relationships start requiring more emotional output than feels comfortable. Not coldness — a highly developed self-protective system.",
    strengths: ["Independence is real and attractive to the right people", "Doesn't create emotional pressure early", "When you invest, it feels chosen"],
    activationPattern: "Closeness triggers discomfort → pulling back or going quiet → person escalates → more pull-back → connection becomes draining.",
    whatHelps: "Catching the discomfort before it becomes distance. Naming the internal feeling rather than acting on it automatically.",
    nextExperiment: "Identify one recent moment where you went quiet or pulled back. Name the internal feeling that triggered it — not the external event.",
  },
  lowTrustDater: {
    name: "Low-Trust Dater",
    emoji: "🔒",
    color: "hsl(285 45% 65%)",
    bg: "hsl(285 45% 65% / 0.08)",
    border: "hsl(285 45% 65% / 0.25)",
    tagline: "You've been burned enough that trust doesn't come easily. Your skepticism is adaptation, not flaw — and it makes it hard for trustworthy people to reach you.",
    strengths: ["Trust means something when you give it", "Reads situations carefully", "Not easily manipulated by charm"],
    activationPattern: "Promising person → skepticism → (conscious or unconscious) testing → person fails test without knowing it's happening → exit.",
    whatHelps: "Building a conscious path for trust. Naming what someone would need to do to earn it, then watching for whether they're actually doing it.",
    nextExperiment: "Name one specific quality that would build genuine trust with you. Watch for it actively rather than watching for failure.",
  },
  directSeeker: {
    name: "Quality Filter",
    emoji: "🔎",
    color: "hsl(190 55% 60%)",
    bg: "hsl(190 55% 60% / 0.08)",
    border: "hsl(190 55% 60% / 0.25)",
    tagline: "You have high standards and you apply them early.",
    strengths: ["Doesn't waste time on mismatched situations", "Clear about what works"],
    activationPattern: "Assesses quickly.",
    whatHelps: "One more interaction before the filter closes.",
    nextExperiment: "Give it one more genuine conversation before passing.",
  },
};

type Scores = Partial<Record<StyleKey, number>>;

function computeStyle(answers: number[]): StyleKey {
  const scores: Scores = {};
  answers.forEach((ai, qi) => {
    if (ai < 0) return;
    const opt = QUESTIONS[qi].opts[ai];
    Object.entries(opt.scores).forEach(([k, v]) => {
      scores[k as StyleKey] = (scores[k as StyleKey] ?? 0) + v;
    });
  });
  let best: StyleKey = "secureBuilder";
  let bestScore = -1;
  (Object.entries(scores) as [StyleKey, number][]).forEach(([k, v]) => {
    if (v > bestScore) { bestScore = v; best = k; }
  });
  return best;
}

interface StyleOverride {
  tagline?: string;
  strengths?: string[];
  activationPattern?: string;
  whatHelps?: string;
  nextExperiment?: string;
}

export default function ConnectionStyle() {
  useMeta("Connection Style Lens", "Six questions that reveal your connection pattern — how you attach, what activates your risk loop, and one experiment worth trying.");
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1));
  const [result, setResult] = useState<StyleKey | null>(null);
  const [override, setOverride] = useState<StyleOverride>({});
  const [usedFallback, setUsedFallback] = useState(false);
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const answered = answers.filter(a => a >= 0).length;

  function handleAnswer(qi: number, oi: number) {
    setAnswers(prev => { const n = [...prev]; n[qi] = oi; return n; });
  }

  function tryParseOverride(raw: string): StyleOverride | null {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      const asStr = (v: unknown, min: number) => (typeof v === "string" && v.trim().length >= min ? v.trim() : undefined);
      const strengthsRaw = parsed.strengths;
      const strengths = Array.isArray(strengthsRaw)
        ? strengthsRaw.filter((x): x is string => typeof x === "string" && x.trim().length >= 8).map(s => s.trim()).slice(0, 4)
        : undefined;
      const out: StyleOverride = {
        tagline: asStr(parsed.tagline, 30),
        strengths: strengths && strengths.length >= 2 ? strengths : undefined,
        activationPattern: asStr(parsed.activationPattern, 30),
        whatHelps: asStr(parsed.whatHelps, 30),
        nextExperiment: asStr(parsed.nextExperiment, 30),
      };
      const hasSomething = !!(out.tagline || out.strengths || out.activationPattern || out.whatHelps || out.nextExperiment);
      return hasSomething ? out : null;
    } catch {
      return null;
    }
  }

  async function handleSubmit() {
    const styleKey = computeStyle(answers);
    setResult(styleKey);
    setOverride({});
    setUsedFallback(false);
    const base = STYLES[styleKey];
    const answerSummary = QUESTIONS.map((q, qi) => {
      const ai = answers[qi];
      return ai >= 0 ? `${q.q} → ${q.opts[ai].label}` : null;
    }).filter(Boolean).join("\n");
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Connection Style Lens",
          prompt: [
            `The user's connection style was identified as "${base.name}".`,
            "Personalize the readout based on their answers. Return ONLY a single JSON object:",
            '{ "tagline": string, "strengths": string[], "activationPattern": string, "whatHelps": string, "nextExperiment": string }',
            "tagline: 1-2 sentence summary of this pattern.",
            "strengths: 2-4 short bullet points (each one short clause).",
            "activationPattern: 2 sentences describing how the pattern activates.",
            "whatHelps: 2 sentences of concrete guidance.",
            "nextExperiment: 1-2 sentences of a small, doable experiment.",
            "",
            "Their answers:",
            answerSummary,
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].join("\n"),
          context: { toolName: "Connection Style Lens", formValues: { styleKey, answers } },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        return;
      }
      const parsed = tryParseOverride(ai.output);
      if (parsed) {
        setOverride(parsed);
      } else {
        setUsedFallback(true);
      }
    } catch {
      setUsedFallback(true);
    }
  }

  async function handleRetry() {
    if (!result) return;
    const styleKey = result;
    const base = STYLES[styleKey];
    const answerSummary = QUESTIONS.map((q, qi) => {
      const ai = answers[qi];
      return ai >= 0 ? `${q.q} → ${q.opts[ai].label}` : null;
    }).filter(Boolean).join("\n");
    setUsedFallback(false);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Connection Style Lens",
          prompt: [
            `The user's connection style was identified as "${base.name}".`,
            "Personalize the readout based on their answers. Return ONLY a single JSON object:",
            '{ "tagline": string, "strengths": string[], "activationPattern": string, "whatHelps": string, "nextExperiment": string }',
            "tagline: 1-2 sentence summary of this pattern.",
            "strengths: 2-4 short bullet points (each one short clause).",
            "activationPattern: 2 sentences describing how the pattern activates.",
            "whatHelps: 2 sentences of concrete guidance.",
            "nextExperiment: 1-2 sentences of a small, doable experiment.",
            "",
            "Their answers:",
            answerSummary,
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].join("\n"),
          context: { toolName: "Connection Style Lens", formValues: { styleKey, answers } },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        return;
      }
      const parsed = tryParseOverride(ai.output);
      if (parsed) {
        setOverride(parsed);
      } else {
        setUsedFallback(true);
      }
    } catch {
      setUsedFallback(true);
    }
  }

  const baseStyle = result ? STYLES[result] : null;
  const style = baseStyle ? {
    ...baseStyle,
    tagline: override.tagline ?? baseStyle.tagline,
    strengths: override.strengths ?? baseStyle.strengths,
    activationPattern: override.activationPattern ?? baseStyle.activationPattern,
    whatHelps: override.whatHelps ?? baseStyle.whatHelps,
    nextExperiment: override.nextExperiment ?? baseStyle.nextExperiment,
  } : null;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 -left-10 opacity-30 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Self-Insight</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Connection Style Lens</h1>
            <FallbackRateBadge toolName="Connection Style Lens" className="mt-1" />

            <p className="text-muted-foreground mt-2">Six questions that reveal the pattern beneath your dating behavior — how you connect, what your risk loop looks like, and what actually helps.</p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Sparkles className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Connection Style Lens"
              title="See the pattern beneath your dating"
              description="Answer six quick questions and we'll name the connection style you're moving from, the risk loop that keeps showing up, and one experiment that could shift it."
              testId="connection-style-empty-state"
            />
          )}

          {/* Disclaimer */}
          <motion.div {...fadeUp(0.04)} className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.06)]">
            <Info className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground/70">This is not a diagnosis.</span> It is a pattern lens based on what you share here. Connection styles are fluid, not fixed — and you may recognize patterns from multiple styles. Use this as a starting point for self-reflection, not a label.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="quiz" {...fadeUp(0.06)} className="space-y-4">
                {QUESTIONS.map((q, qi) => (
                  <div key={qi} className="glass border border-white/8 rounded-2xl p-6">
                    <p className="font-semibold text-foreground text-sm mb-4">
                      <span className="text-muted-foreground/40 mr-2">{qi + 1}.</span>{q.q}
                    </p>
                    <div className="space-y-2">
                      {q.opts.map((opt, oi) => (
                        <button key={oi} onClick={() => handleAnswer(qi, oi)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${answers[qi] === oi ? "bg-[hsl(268_52%_68%/0.15)] border-[hsl(268_52%_68%/0.4)] text-[hsl(268_60%_82%)]" : "border-white/8 text-muted-foreground hover:border-white/15 hover:text-foreground"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">{answered} of {QUESTIONS.length} answered</p>
                  <Button onClick={handleSubmit} disabled={answered < QUESTIONS.length || loading}
                    className="rounded-full px-8 h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-40">
                    {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading your pattern…</> : <><Sparkles className="mr-2 h-4 w-4" />See My Style</>}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
                {usedFallback && (
                  <FallbackNotice
                    onRetry={handleRetry}
                    loading={loading}
                    label="style read"
                    testId="button-retry-connection-style"
                  />
                )}
                {/* Header */}
                <div className="rounded-3xl p-8 border text-center" style={{ background: style!.bg, borderColor: style!.border }}>
                  <div className="text-5xl mb-4">{style!.emoji}</div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">{style!.name}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{style!.tagline}</p>
                </div>

                {/* Strengths */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-3">Strengths of this pattern</p>
                  <ul className="space-y-2">
                    {style!.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: style!.color }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Activation Pattern */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-2">How this pattern activates</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{style!.activationPattern}</p>
                </div>

                {/* What Helps */}
                <div className="rounded-2xl p-5 border" style={{ background: style!.bg, borderColor: style!.border }}>
                  <p className="font-semibold text-foreground text-sm mb-2">What tends to help</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{style!.whatHelps}</p>
                </div>

                {/* Next Experiment */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="font-semibold text-foreground text-sm mb-2">Next experiment</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{style!.nextExperiment}</p>
                </div>

                {/* Reminder */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.06)]">
                  <Info className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">This is a pattern lens, not a fixed identity. You may recognize yourself in more than one style. Use it as a starting point for self-reflection, not a label to carry.</p>
                </div>

                <div className="flex justify-center">
                  <button onClick={() => { setResult(null); setAnswers(Array(QUESTIONS.length).fill(-1)); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Retake
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
