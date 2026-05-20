import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, ScanFace, AlertCircle, RefreshCw } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface MirrorResult {
  values: string;
  protectiveHabits: string;
  signalsShown: string;
  understatedQualities: string;
  overcompensation: string;
  likelyAudienceResponse: string;
  missingInformation: string;
  emotionalImpression: string;
  nextExperiment: string;
}

function analyzeMirror(bio: string, want: string): MirrorResult {
  const lower = bio.toLowerCase();
  const words = bio.trim().split(/\s+/).length;
  const isLong = words > 80;
  const isShort = words < 25;
  const isEmotional = /feel|heart|love|connect|care|real|deep|genuine|honest|open/.test(lower);
  const isHumorous = /laugh|fun|humor|funny|joke|wit|sarcas|banter|playful/.test(lower);
  const isAchievement = /work|career|success|ambitious|goal|build|create|lead|drive/.test(lower);
  const isAdventure = /travel|adventure|explore|hike|discover|world|new|spontan/.test(lower);
  const isGuarded = /trust|careful|slow|hurt|past|wall|private|protect|guard/.test(lower);
  const isListy = (bio.match(/,/g) || []).length > 5;

  const pi = isEmotional && !isGuarded ? 0 : isHumorous ? 1 : isAchievement ? 2 : isAdventure ? 3 : 4;

  const values: string[] = [
    "Genuine connection and emotional honesty — you're optimizing for depth, even if you don't always name it that way. The things you mention that feel most alive to you point toward intimacy, real conversation, and being known.",
    "Lightness, laughter, and ease — you value relationships that don't feel heavy, where humor is a form of closeness. You want to enjoy the person you're with, and you communicate this clearly through what you emphasize.",
    "Growth, capability, and someone who takes their life seriously — you respect ambition and direction, in yourself and in others. What you're looking for is someone who is building something, not just marking time.",
    "Experience, aliveness, and shared discovery — you're optimizing for a life that feels full. Someone who is genuinely curious, game for things, and present in the moment matters more to you than someone predictable.",
    "Authenticity and substance — you'd rather say nothing than perform something. You're looking for someone who shows up as themselves, and you hold yourself to the same standard.",
  ];

  const protectiveHabits: string[] = [
    "Sharing warmth while withholding specifics. You give people enough to feel seen without giving them enough to hold onto — which keeps you protected but sometimes leaves them without a clear picture of who you actually are.",
    "Using humor to manage emotional temperature. When things get real, lightness arrives. This works beautifully in early connection and can become a barrier to depth if it becomes a default.",
    "Leading with competence and accomplishment. When uncertain, you emphasize what you do well — which is safe ground. The risk is that people can feel like they've met your résumé before they've met you.",
    "Enthusiasm as armor. High energy is genuine — and it also keeps people from noticing the places you're not sure. It's hard to ask real questions of someone who's already bringing everything.",
    "Understatement as protection. You share less than you feel, which reads as cool or low-maintenance — and means people rarely have access to what's actually going on. Privacy is real; it's worth checking whether yours has become habitual.",
  ];

  const signalsShown: string[] = [
    "Sincerity, warmth, and a genuine desire to connect. You're broadcasting that you're a real person who means what they say — which is rare and legible to the right people. You're also signaling a degree of readiness that some may find refreshing and others find pressurizing.",
    "Ease, fun, and social fluency. You signal that you're not a project, that dating you would feel good, and that you don't take yourself too seriously. This is broadly attractive — the question is whether it's the whole picture.",
    "Direction, capability, and high standards. You signal that you have your life together and expect the same. People with similar energy find this magnetic; people who feel less 'together' may self-select out before giving you a real shot.",
    "Curiosity, openness, and enthusiasm for life. You signal that time with you will be interesting, that you'll show up, and that you're genuinely engaged. This reads as attractive and a little energizing — which is mostly great.",
    "Groundedness and self-awareness. You signal that you're not performing — which is its own kind of attractive. People who are also done with performing will recognize you. People who need more texture or energy may not see enough to grab onto.",
  ];

  const understatedQualities: string[] = [
    "Your capacity for steadiness — the fact that you show up consistently, that you remember things, that you follow through. This doesn't make it into the early picture but tends to be what people value most over time.",
    "The depth beneath the levity. Your humor is real, but so is the part of you that thinks carefully, feels things fully, and cares about getting things right. That part doesn't always get seen early.",
    "Your loyalty and the quality of your longer relationships. The version of you that shows up in a relationship that's going well is probably significantly warmer and more expansive than what the dating context shows.",
    "Your capacity for stillness and presence. The adventurous version is legible; the version of you that is deeply present with one person, paying full attention, tends to be understated in how you present early.",
    "Your humor and warmth. Your restraint is real, but so is the fact that when you relax, you're probably significantly warmer, funnier, and more playful than your early presentation suggests.",
  ];

  const overcompensation: string[] = [
    "Toward low-maintenance. You're signaling 'I don't need much / I'm easy / I won't be a burden' — which often comes from past dynamics where your needs felt like too much. The result is that people don't know what you actually want, which makes it harder to give it to you.",
    "Toward likability. You're making it very easy to enjoy your company — which is genuine — but also a signal that you may be more concerned with being well-received than you'd like to be. The authenticity is real; the question is whether you're leaving room for people to like you with the difficulty included.",
    "Toward capability. You're leading with evidence of competence, which is partly accurate and partly protective. The overcorrection: it can make you harder to feel close to, because people need to see where you're uncertain or struggling to feel like the relationship is real.",
    "Toward enthusiasm. You're bringing more energy than you necessarily feel all the time — and it can create a dynamic where people expect that energy consistently and are confused when you want to be quiet or still.",
    "Toward independence. You're signaling that you're self-sufficient and don't need much, which may be true and may also be a trained posture from experiences where needing things didn't go well. The effect: the right people may not realize you want them.",
  ];

  const audienceResponses: string[] = [
    "People who value emotional availability will feel immediately drawn to you. People who are earlier in their own journey toward openness may feel slightly outmatched or unsure how to meet you. Avoidant types may be attracted to the warmth while struggling to reciprocate it.",
    "People who want ease and fun will respond immediately and warmly. People who want depth early may not know whether it's there. The very selective / serious types may pass before they've had a chance to see what's underneath.",
    "High-achieving, direction-oriented people will find your signal legible and attractive. People who are less driven may feel subtly evaluated. The warmest readers will look past the surface; more guarded readers may feel they need to prove something before they reach out.",
    "People who are also game for life — curious, willing, enthusiastic — will respond to you very well. People who are more homebodied or certain-state may feel vaguely behind or overwhelmed. You self-select for a specific kind of energy match.",
    "People who are also done performing will feel recognized and safe. People who need more to grab onto early may keep scrolling. Your signal is legible to a smaller, well-matched audience — which is actually fine if that's the goal.",
  ];

  const missing: string[] = [
    "Something specific and sensory — a detail that makes you three-dimensional instead of two. A habit, a preference, a thing you're embarrassed to love, a stance on something small. Specificity is what turns someone from attractive-in-concept to someone they can picture.",
    "Something about what you're actually like in a relationship that's going well. The dating profile shows who you are before someone knows you; the hidden win is showing who you become when trust is there.",
    "Warmth and texture — some signal that there's more behind the direction and drive. What matters to you beyond your work? What do you love that surprises people? What makes you easy to be around?",
    "Something about who you are when you're not exploring — what you're like in the quiet moments, the ordinary Tuesdays, the times when nothing is happening. Life with someone is mostly made of those.",
    "A small, human imperfection — something that reveals you're a real person with actual quirks, not just a well-edited version of yourself. Controlled presentations are legible as controlled; the unguarded detail is what makes people want to know you.",
  ];

  const emotionalImpressions: string[] = [
    "Warm and available — people feel seen when they're with you or reading your words, which is genuinely rare. The emotional impression is that you're safe, that you care, that this would feel good. The risk is that it can attract people who want to receive care without providing it in return.",
    "Light and enjoyable — people feel better after talking to you, which is a gift. The emotional impression is ease, not weight. The note: sometimes people don't take ease seriously enough, assuming it's the precursor to depth rather than depth itself in a different form.",
    "Capable and slightly distant — people respect you and may feel a little uncertain about whether they can reach you. The emotional impression is one of quality — you read as high-value — with a small undercurrent of formality that the relationship would dissolve over time.",
    "Alive and engaging — people feel more energized in your presence. The emotional impression is invitation — being with you feels like participating in something. The note: when your energy drops, people sometimes feel the contrast more than they would with someone more even.",
    "Grounded and honest — people feel like what they see is what they get, which is calming. The emotional impression is reliability and self-awareness. The note: some people need more warmth in the signal to feel safe reaching toward you.",
  ];

  const experiments: string[] = [
    "Share one specific, slightly vulnerable detail in your next interaction — not a big disclosure, just something true and real that you wouldn't normally lead with. Notice how it lands. The goal is to see whether more of you creates more of what you want, not less.",
    "In your next promising interaction, let the other person carry the humor once. Stay present and respond genuinely instead of immediately meeting their energy with your own. Notice whether depth appears in the space.",
    "In your next first conversation, share something you're uncertain about or working on — not a weakness, just an honest admission that you're still figuring something out. See whether it closes distance.",
    "Choose one upcoming interaction where you let the pace slow down deliberately. No agenda, no planned escalation. See what appears when the forward momentum is off.",
    "Add one detail to how you present yourself that is not edited, not polished, and not designed to make a particular impression. Just true. See whether the response changes.",
  ];

  return {
    values: values[pi],
    protectiveHabits: protectiveHabits[pi],
    signalsShown: signalsShown[pi],
    understatedQualities: understatedQualities[pi],
    overcompensation: overcompensation[isLong ? 0 : isListy ? 2 : isShort ? 4 : pi],
    likelyAudienceResponse: audienceResponses[pi],
    missingInformation: missing[isListy ? 2 : isShort ? 4 : isLong ? 0 : pi],
    emotionalImpression: emotionalImpressions[pi],
    nextExperiment: experiments[pi],
  };
}

const DEMO: MirrorResult = {
  values: "Genuine connection and emotional honesty — you're optimizing for depth, even if you don't always name it that way. The things that feel most alive to you point toward intimacy, real conversation, and being known.",
  protectiveHabits: "Sharing warmth while withholding specifics. You give people enough to feel seen without giving them enough to hold onto — which keeps you protected but sometimes leaves them without a clear picture of who you actually are.",
  signalsShown: "Sincerity, warmth, and a genuine desire to connect. You're broadcasting that you're a real person who means what they say — which is rare and legible to the right people.",
  understatedQualities: "Your capacity for steadiness — the fact that you show up consistently, remember things, follow through. This doesn't make it into the early picture but tends to be what people value most over time.",
  overcompensation: "Toward low-maintenance. You're signaling 'I don't need much / I'm easy' — which often comes from past dynamics where your needs felt like too much. The result: people don't know what you actually want.",
  likelyAudienceResponse: "People who value emotional availability will feel immediately drawn to you. Avoidant types may be attracted to the warmth while struggling to reciprocate it.",
  missingInformation: "Something specific and sensory — a detail that makes you three-dimensional. A habit, a preference, a thing you're embarrassed to love. Specificity is what turns someone from attractive-in-concept to someone people can picture.",
  emotionalImpression: "Warm and available — people feel seen when reading your words, which is genuinely rare. The risk is that it can attract people who want to receive care without providing it in return.",
  nextExperiment: "Share one specific, slightly vulnerable detail in your next interaction — not a big disclosure, just something true and real you wouldn't normally lead with. Notice how it lands.",
};

const SECTIONS = [
  { key: "values",               title: "What You're Actually Optimizing For", color: "hsl(268 52% 68%)" },
  { key: "protectiveHabits",     title: "Protective Habits",                   color: "hsl(43 65% 65%)" },
  { key: "signalsShown",         title: "Signals You're Broadcasting",          color: "hsl(190 55% 60%)" },
  { key: "understatedQualities", title: "Understated Qualities",                color: "hsl(142 55% 60%)" },
  { key: "overcompensation",     title: "Where You May Be Overcompensating",   color: "hsl(348 55% 65%)" },
  { key: "likelyAudienceResponse", title: "How Different People Tend to Read You", color: "hsl(285 45% 65%)" },
  { key: "missingInformation",   title: "What's Not Coming Through",            color: "hsl(43 65% 65%)" },
  { key: "emotionalImpression",  title: "Your Emotional Impression",            color: "hsl(268 52% 68%)" },
  { key: "nextExperiment",       title: "Next Experiment",                      color: "hsl(142 55% 60%)" },
];

export default function MirrorProfile() {
  useMeta("Mirror Profile", "See yourself the way others might — values, signals, gaps, and the one experiment that could shift everything.");
  const [bio, setBio] = useState("");
  const [want, setWant] = useState("");
  const [result, setResult] = useState<MirrorResult | null>(null);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;

  const MIRROR_KEYS: (keyof MirrorResult)[] = [
    "values", "protectiveHabits", "signalsShown", "understatedQualities",
    "overcompensation", "likelyAudienceResponse", "missingInformation",
    "emotionalImpression", "nextExperiment",
  ];

  function tryParseMirror(raw: string): MirrorResult | null {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      const out: Partial<MirrorResult> = {};
      for (const k of MIRROR_KEYS) {
        const v = parsed[k];
        if (typeof v !== "string" || v.trim().length < 20) return null;
        out[k] = v.trim();
      }
      return out as MirrorResult;
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!bio.trim()) return;
    const deterministic = analyzeMirror(bio, want);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Mirror Profile",
          prompt: [
            "Reflect back what this dating profile bio shows. Return ONLY a single JSON object with these exact string keys (each 2-4 sentences, specific, warm, never generic):",
            "values, protectiveHabits, signalsShown, understatedQualities, overcompensation, likelyAudienceResponse, missingInformation, emotionalImpression, nextExperiment.",
            "",
            `Bio:\n${bio}`,
            want ? `What they want it to communicate: ${want}` : "",
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].filter(Boolean).join("\n"),
          context: { toolName: "Mirror Profile", formValues: { bio, want } },
        },
      });
      if (ai.isFallback || !ai.output.trim()) {
        setResult(deterministic);
        return;
      }
      const parsed = tryParseMirror(ai.output);
      setResult(parsed ?? deterministic);
    } catch {
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO;
  const isDemo = !result;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] top-20 right-0 opacity-25 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ScanFace className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Self-Insight</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Mirror Profile</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Paste your bio or a short self-description. We'll reflect back what it shows — values, patterns, gaps, and the version of you that isn't fully visible yet.<br /><span className="text-xs text-muted-foreground/60">Based only on what you share. Practical coaching guidance — not clinical advice.</span></p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your bio or self-description</Label>
              <Textarea
                placeholder="Paste your current dating profile bio, prompts, or just a few paragraphs about who you are and what you're looking for…"
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="min-h-[140px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you most want this bio to communicate? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <Textarea
                placeholder="e.g. That I'm serious but not intense. That I have my life together but I'm not boring."
                value={want}
                onChange={e => setWant(e.target.value)}
                className="min-h-[64px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !bio.trim()}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading your profile…</> : <><Sparkles className="mr-2 h-4 w-4" />Show Me My Mirror</>}
            </Button>
          </motion.div>

          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example output — paste your bio above to get yours
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {SECTIONS.map((s, i) => (
                  <motion.div key={s.key} {...fadeUp(0.04 * i)} className="glass border border-white/8 rounded-2xl p-6">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <p className="font-semibold text-foreground text-sm">{s.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-4">{show[s.key as keyof MirrorResult]}</p>
                  </motion.div>
                ))}
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setBio(""); setWant(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Start over
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
