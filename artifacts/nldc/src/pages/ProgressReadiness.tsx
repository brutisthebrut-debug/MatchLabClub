import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, CheckCircle2, AlertTriangle, Clock, TrendingUp, Target, Info } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type Goal = "partnership" | "casual" | "figuring-out" | "reentry";

interface ReadinessProfile {
  goal: Goal;
  label: string;
  desc: string;
  supportive: string[];
  cautions: string[];
  pacing: string;
  fitNotes: string;
  readinessSigns: string[];
}

const GOALS: { id: Goal; label: string; short: string }[] = [
  { id: "partnership", label: "Finding a long-term partnership",    short: "Partnership" },
  { id: "casual",      label: "Exploring casually / open to things", short: "Casual / Open" },
  { id: "figuring-out",label: "Still figuring out what I want",     short: "Figuring it out" },
  { id: "reentry",     label: "Re-entering dating after a break",   short: "Re-entry" },
];

const PROFILES: Record<Goal, ReadinessProfile> = {
  partnership: {
    goal: "partnership", label: "Long-Term Partnership",
    desc: "You're looking for something real and sustained. The readiness work here is about filtering well early, communicating honestly about what you want, and building something that can hold weight.",
    supportive: [
      "Clear about what you want without being rigid about how it shows up",
      "Comfortable with slow starts — depth takes time",
      "Willing to express interest without performing certainty",
      "Secure enough to not need constant reassurance early on",
      "Can distinguish between genuine connection and the high of new attention",
    ],
    cautions: [
      "Settling for availability instead of fit because you want this to work",
      "Rushing intimacy to lock something in before it naturally arrives",
      "Projecting a relationship onto someone who hasn't shown partnership qualities yet",
      "Withdrawing from someone good because it doesn't feel intense early",
    ],
    pacing: "Slower is almost always better when partnership is the goal. The first few weeks are for information-gathering, not building a story. Let the evidence accumulate before the attachment deepens.",
    fitNotes: "Someone who is also looking for partnership isn't necessarily a good fit just because they want the same thing. Look for ease, respect, and genuine curiosity — not just intent alignment.",
    readinessSigns: [
      "You can enjoy early-stage connection without needing it to be more than it is yet",
      "You don't disappear from a good thing because it's unfamiliar",
      "You can have a direct conversation about what you want without it feeling like an ultimatum",
      "You're filtering for quality rather than matching to fill a gap",
    ],
  },
  casual: {
    goal: "casual", label: "Casual / Open",
    desc: "Casual dating done well requires more self-awareness, not less. The readiness work here is around honesty — with yourself about what you actually want and with others about what this is.",
    supportive: [
      "Genuinely comfortable with things not leading anywhere — not performing comfort",
      "Can be honest about the arrangement without apologizing for it",
      "Doesn't get attached faster than acknowledged and then resent the situation",
      "Treats casual partners with the same basic consideration as more serious ones",
    ],
    cautions: [
      "Using 'casual' as a hedge when you actually want more — and then getting hurt by the terms you agreed to",
      "Avoiding direct conversations about the arrangement and hoping the ambiguity resolves itself",
      "Choosing casual because you don't feel ready for more, but not examining why",
    ],
    pacing: "Clarify earlier than feels necessary. The 'what is this' conversation feels awkward but saves a lot of pain. Most complications in casual situations come from delayed honesty, not from the arrangement itself.",
    fitNotes: "Someone whose version of casual matches yours. People use the word to mean very different things — one honest early conversation prevents most of the complications.",
    readinessSigns: [
      "You know specifically what you want from this and can articulate it",
      "You can hold your own feelings without expecting the arrangement to hold them for you",
      "You're choosing this, not defaulting to it",
    ],
  },
  "figuring-out": {
    goal: "figuring-out", label: "Figuring It Out",
    desc: "Not knowing what you want is a valid and honest place to be. The readiness work here is about learning from what you encounter rather than trying to decide in advance.",
    supportive: [
      "Approaching dating as information-gathering rather than audition",
      "Comfortable saying 'I'm not sure yet' without it feeling like failure",
      "Staying curious about what each interaction teaches you about yourself",
      "Not forcing a conclusion faster than the evidence supports",
    ],
    cautions: [
      "Using 'figuring it out' to avoid having any hard conversations",
      "Staying in ambiguity longer than is fair to someone who has been clear about what they want",
      "Treating 'not knowing' as a permanent identity rather than a temporary state",
    ],
    pacing: "Give yourself more time at the start of anything, and check in with yourself regularly. Not every connection needs to lead somewhere — but you should know what you're learning from each one.",
    fitNotes: "Someone patient and clear. You don't need a partner who is also figuring things out — sometimes someone who knows what they want can help you understand what you want too. The key is that they're not trying to decide for you.",
    readinessSigns: [
      "You're dating to understand yourself better, not just to fill time or avoid feeling alone",
      "You can be honest about your uncertainty without using it to avoid accountability",
      "When something feels clearly wrong, you act on that even without a full picture",
    ],
  },
  reentry: {
    goal: "reentry", label: "Re-Entry After a Break",
    desc: "Returning to dating after time away comes with specific challenges: feeling rusty, comparing to what came before, and needing to re-calibrate what you want now versus what you wanted then.",
    supportive: [
      "Treating this as a fresh context rather than a continuation of your last chapter",
      "Patient with yourself about the awkwardness — it goes away faster than it feels like it will",
      "Clear about what you've learned and what you want to do differently this time",
      "Not rushing back in to prove something to yourself",
    ],
    cautions: [
      "Comparing everyone to an ex — either positively or negatively",
      "Returning before you're actually ready because being alone feels like falling behind",
      "Using the break as evidence that something is wrong with you",
      "Over-explaining your break to early dates when you're not yet required to",
    ],
    pacing: "Slower than you think you need. The first few months back often involve recalibration — what you thought you wanted before may not be what you want now. Give yourself permission to find out before committing to a direction.",
    fitNotes: "Someone who gives you space to show up without pressure. Re-entry works best with people who are curious rather than evaluative early on.",
    readinessSigns: [
      "You can be present in a conversation without constant internal commentary about whether you're 'back'",
      "You're not still processing your last relationship in a way that would make you unavailable to something new",
      "You're here because you want to be, not because you feel like you should be",
    ],
  },
};

export default function ProgressReadiness() {
  useMeta("Readiness Guide · NLDC", "Goal-based readiness guide with supportive traits, caution dynamics, pacing, and fit notes.");
  const [selected, setSelected] = useState<Goal | null>(null);
  const profile = selected ? PROFILES[selected] : null;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-rose fixed w-[300px] h-[300px] top-20 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-[hsl(348_55%_65%)]" />
              <p className="text-sm font-medium text-[hsl(348_55%_75%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Readiness Guide</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Choose your current goal and get a practical readiness read — supportive traits, caution dynamics, pacing guidance, and signs you're in a good place to move forward.</p>
          </motion.div>

          {/* Goal selector */}
          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-2xl p-5 mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">What are you looking for right now?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g.id} onClick={() => setSelected(selected === g.id ? null : g.id)}
                  className={`px-4 py-3 rounded-xl text-left text-sm transition-all border ${selected === g.id ? "border-[hsl(348_55%_65%/0.5)] bg-[hsl(348_55%_65%/0.1)] text-foreground" : "border-white/8 text-muted-foreground hover:border-white/16 hover:text-foreground"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {profile && (
              <motion.div key={profile.goal} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">

                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-foreground mb-2">{profile.label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{profile.desc}</p>
                </div>

                {/* Supportive traits */}
                <div className="glass border border-[hsl(142_55%_60%/0.2)] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(142_55%_60%/0.15)] bg-[hsl(142_55%_60%/0.06)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" />
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(142_55%_70%)]">Supportive Traits</p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {profile.supportive.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] flex-shrink-0 mt-1.5" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Caution dynamics */}
                <div className="glass border border-[hsl(43_65%_65%/0.2)] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(43_65%_65%/0.15)] bg-[hsl(43_65%_65%/0.06)]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[hsl(43_65%_65%)]" />
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_75%)]">Caution Dynamics</p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {profile.cautions.map((c, i) => (
                      <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_65%_65%)] flex-shrink-0 mt-1.5" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{c}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pacing + Fit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="glass border border-[hsl(268_52%_68%/0.2)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-[hsl(268_52%_68%)]" />
                      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(268_52%_78%)]">Pacing</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.pacing}</p>
                  </div>
                  <div className="glass border border-[hsl(190_55%_60%/0.2)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-3.5 h-3.5 text-[hsl(190_55%_60%)]" />
                      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(190_55%_70%)]">Fit Notes</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.fitNotes}</p>
                  </div>
                </div>

                {/* Readiness Signs */}
                <div className="glass border border-[hsl(285_45%_65%/0.2)] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(285_45%_65%/0.15)] bg-[hsl(285_45%_65%/0.06)]">
                    <TrendingUp className="w-3.5 h-3.5 text-[hsl(285_45%_65%)]" />
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(285_45%_75%)]">Signs You're Ready</p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {profile.readinessSigns.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(285_45%_65%)] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-white/6 bg-white/2">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed">This is practical coaching guidance — not clinical assessment. These aren't criteria you need to meet before starting. They're patterns worth being aware of as you go.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!selected && (
            <motion.div {...fadeUp(0.1)} className="text-center py-16 text-muted-foreground/40 text-sm">
              Select a goal above to see your readiness guide.
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
