import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Eye, AlertCircle, RefreshCw, Copy, Check, Info } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface ReaderResult {
  likelySignals: string[];
  fitClues: string[];
  missingInfo: string[];
  questionsToAsk: string[];
  cautionNotes: string[];
  notToOverread: string;
  suggestedOpener: string;
}

function analyzeProfile(text: string, context: string): ReaderResult {
  const lower = text.toLowerCase();
  const words = text.trim().split(/\s+/).length;
  const isLong = words > 100;
  const isShort = words < 25;
  const hasHumor = /haha|funny|laugh|sarcas|wit|banter|irony|deadpan/.test(lower);
  const hasValues = /honest|kind|loyal|integrity|genuine|authentic|real|family|faith|meaning/.test(lower);
  const hasAdventure = /travel|hike|adventur|explore|outdoors|spontan|world/.test(lower);
  const hasIntellect = /read|book|think|curious|learn|science|art|film|music|philosophy/.test(lower);
  const hasCareer = /work|career|build|create|lead|entrepreneur|professional|business/.test(lower);
  const hasSocial = /friend|party|bar|social|love hanging|people person|extrovert/.test(lower);
  const hasHomebody = /cozy|home|introvert|quiet|stay in|cook|dog|cat/.test(lower);
  const hasGuard = /trust|slow|private|careful|past|protective|wall/.test(lower);
  const hasClichés = /love to laugh|looking for my|adventure|foodie|netflix|gym|beach|travel/.test(lower);
  const hasQuestions = text.includes("?");

  const signals: string[] = [];
  if (hasHumor) signals.push("Uses humor — likely comfortable with banter and wants someone who can keep up. Good sign if you're also playful.");
  if (hasValues) signals.push("Leads with or mentions values (honesty, kindness, loyalty) — suggests they're looking for substance over surface, and that character matters to them.");
  if (hasAdventure) signals.push("Adventure-oriented language — signals they want a life that feels active and full. Worth checking whether that's a real identity or a profile pose.");
  if (hasIntellect) signals.push("References to books, curiosity, or learning — signals they want to be genuinely stimulated, not just entertained.");
  if (hasCareer) signals.push("Career-forward language — either proud of what they've built or using it as positioning. Worth distinguishing which.");
  if (hasSocial) signals.push("Socially oriented — they probably recharge externally and will want a partner who shows up for people, not just for them.");
  if (hasHomebody) signals.push("Cozy/home-oriented — they value comfort and probably want a relationship that feels like a soft landing, not a performance.");
  if (hasGuard) signals.push("Language of caution or past experience — there's something they're being careful about. Not a red flag, just a signal that trust will need to be earned.");
  if (isShort) signals.push("Very short profile — either intentional (filtered audience) or low-effort (less invested). Context matters here.");
  if (isLong) signals.push("Detailed, long profile — they've thought about this and want to give a full picture. Usually a sign they're serious about finding the right fit.");
  if (!signals.length) signals.push("The signals are subtle — this profile is giving you less to work with than usual. That's information in itself.");

  const fits: string[] = [];
  if (hasHumor && hasValues) fits.push("Wit + values is a strong combination — suggests someone who doesn't take themselves too seriously but does take connection seriously.");
  if (hasHomebody && hasIntellect) fits.push("Quiet and curious — usually indicates someone who wants deep conversations more than big plans. A good fit if you value the same.");
  if (hasAdventure && hasSocial) fits.push("Active and social — will likely want a partner who's game for things. This can feel energizing or exhausting depending on your own rhythm.");
  if (hasCareer && !hasSocial) fits.push("Work-focused without strong social language — may value independence and personal space in a relationship. Could be great or could be a flag depending on what you want.");
  if (hasGuard) fits.push("Protective language suggests they'll respond well to patience and consistency — and may disengage from anything that feels too fast or pressuring.");
  if (hasClichés) fits.push("Several phrases are common across profiles (foodie, adventure, love to laugh) — which doesn't mean they're not genuine, just that you shouldn't weight those lines heavily. The specifics are what matter.");
  if (fits.length === 0) fits.push("Not enough specific information to identify clear fit markers — the conversation will tell you much more than this profile.");

  const missing: string[] = [];
  if (!hasValues) missing.push("No clear sense of what they actually value in a person — worth surfacing in conversation.");
  if (!hasHumor && !hasHomebody && !hasAdventure) missing.push("No sense of their day-to-day texture — what their ordinary life looks like.");
  if (isShort) missing.push("What they're actually looking for — short profiles rarely say.");
  missing.push("How they communicate when things get complicated — profiles only show the curated version.");
  missing.push("What kind of relationship they actually want, not just what they say they want.");

  const questions: string[] = [
    hasAdventure ? "What's the last trip that actually surprised you?" : "What does a genuinely good day look like for you?",
    hasIntellect ? "What's something you've changed your mind about recently?" : "What's something you're into that most people wouldn't expect?",
    hasValues ? "What does loyalty actually look like to you, day to day?" : "What matters most to you in how someone shows up in a relationship?",
    "What does your ideal Saturday look like — not a highlight, just an actual Saturday?",
  ];

  const cautions: string[] = [];
  if (hasClichés && isShort) cautions.push("Very short profile with common phrases — set a low bar for first-impression investment until you see how they communicate.");
  if (hasGuard && hasCareer && !hasValues) cautions.push("Career-first with guarded language and no mention of values — not a disqualifier, but check whether there's emotional availability before investing.");
  if (!hasQuestions && isLong) cautions.push("A long profile with no curiosity about you (no questions, no invitation) can indicate they're more interested in being chosen than in choosing.");
  if (cautions.length === 0) cautions.push("Nothing jumps out as a clear concern from the text alone — the conversation is where the real information lives.");

  const openerIdx = hasHumor ? 0 : hasIntellect ? 1 : hasAdventure ? 2 : hasValues ? 3 : 4;
  const openers = [
    "Your [specific thing from their profile] made me actually laugh. Tell me more about that.",
    "The [specific book / curiosity mention] — that's an interesting choice. What pulled you toward it?",
    "The [specific trip or place] — is that somewhere you've been or somewhere you want to go?",
    "The way you put [specific phrase about values] is something I actually think about too. What does that look like for you in practice?",
    "I read your profile and it actually gave me a question — [something specific]. That's rarer than you'd think.",
  ];

  return {
    likelySignals: signals.slice(0, 5),
    fitClues: fits.slice(0, 4),
    missingInfo: missing.slice(0, 4),
    questionsToAsk: questions.slice(0, 3),
    cautionNotes: cautions,
    notToOverread: "A profile is a curated highlight reel, not a person. The signals here are useful for forming hypotheses — not conclusions. People often write profiles that are 30% accurate. The conversation is where you'll actually find out whether there's something real.",
    suggestedOpener: openers[openerIdx],
  };
}

const DEMO: ReaderResult = {
  likelySignals: [
    "Uses humor — likely comfortable with banter and wants someone who can keep up.",
    "Leads with values — suggests they're looking for substance over surface.",
    "Detailed, long profile — they've thought about this and want to give a full picture.",
  ],
  fitClues: [
    "Wit + values is a strong combination — suggests someone who doesn't take themselves too seriously but does take connection seriously.",
    "Several common phrases appear — don't weight those heavily. The specifics are what matter.",
  ],
  missingInfo: [
    "What kind of relationship they actually want, not just what they say they want.",
    "How they communicate when things get complicated.",
    "What their ordinary day-to-day life looks like.",
  ],
  questionsToAsk: [
    "What's something you've changed your mind about recently?",
    "What does your ideal Saturday look like — not a highlight, just an actual Saturday?",
    "What does loyalty actually look like to you, day to day?",
  ],
  cautionNotes: ["Nothing jumps out as a clear concern from the text alone — the conversation is where the real information lives."],
  notToOverread: "A profile is a curated highlight reel, not a person. The signals here are useful for forming hypotheses — not conclusions. People often write profiles that are 30% accurate. The conversation is where you'll actually find out whether there's something real.",
  suggestedOpener: "The way you described [specific detail] is something I actually think about too. What does that look like for you in practice?",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ProfileReader() {
  useMeta("Profile Reader", "Paste someone's public profile text and get signals, fit clues, questions to ask, and a suggested opener — without overreading.");
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ReaderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => { setResult(analyzeProfile(text, context)); setLoading(false); }, 1000);
  }

  const isBrandNewUser = isAuthenticated && !result;
  const show = result ?? DEMO;
  const isDemo = !result && !isAuthenticated;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] top-0 -left-20 opacity-25 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Profile Tools</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Profile Reader</h1>
            <p className="text-muted-foreground mt-2">Paste someone's public profile text. Get likely signals, fit clues, questions worth asking, and a suggested opener.<br />
              <span className="text-xs text-muted-foreground/60">Only public information. This tool suggests hypotheses, never definitive conclusions about another person.</span></p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div {...fadeUp(0.03)} className="mb-6" data-testid="reader-empty-state">
              <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Welcome to Profile Reader</p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-2">Read between the lines</h2>
                <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                  Paste any public profile and we'll pull out likely signals, cautions worth noting, and a couple of opening lines that actually fit.
                </p>
              </div>
            </motion.div>
          )}

          <div className="grid md:grid-cols-5 gap-5 mb-6">
            <motion.div {...fadeUp(0.05)} className="md:col-span-3 glass border border-white/8 rounded-3xl p-7 space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Their profile text or note</Label>
                <Textarea placeholder="Paste their bio, prompts, or the message they sent you…"
                  value={text} onChange={e => setText(e.target.value)}
                  className="min-h-[160px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Any context? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
                <Textarea placeholder="e.g. We matched on Hinge, they're 34, seem career-focused, asked me a question in their opener…"
                  value={context} onChange={e => setContext(e.target.value)}
                  className="min-h-[64px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
              </div>
              <Button onClick={handleAnalyze} disabled={loading || !text.trim()}
                className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
                {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading…</> : <><Sparkles className="mr-2 h-4 w-4" />Read the Profile</>}
              </Button>
            </motion.div>
            <motion.div {...fadeUp(0.08)} className="md:col-span-2 rounded-2xl border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.05)] p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[hsl(43_65%_65%)]" />
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_65%)]">Important reminder</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">This tool reads text signals — not people. Everything here is a hypothesis worth testing, not a conclusion.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Profiles are curated. The person is always more complex than what they wrote. Use this to form better questions, not verdicts.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Avoid making strong assumptions about someone's character, intentions, or availability from profile text alone.</p>
            </motion.div>
          </div>

          {isBrandNewUser && (
            <motion.div
              {...fadeUp(0.1)}
              className="mb-6"
              data-testid="profile-reader-empty-state"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
                style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.12), hsl(190 55% 60% / 0.08))" }}>
                <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(268_52%_68%/0.15)] border border-[hsl(268_52%_68%/0.25)] mx-auto mb-4 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-[hsl(268_52%_78%)]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-2">Welcome to Profile Reader</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Read your first profile</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                    Paste someone's bio above and we'll surface likely signals, fit clues, questions worth asking, and a suggested opener — without overreading.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {!isBrandNewUser && (
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example output — paste a profile above to get yours
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(268_52%_68%)]" />Likely signals
                    </p>
                    <ul className="space-y-2.5">
                      {show.likelySignals.map((s, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{s}</li>)}
                    </ul>
                  </div>
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(190_55%_60%)]" />Fit clues
                    </p>
                    <ul className="space-y-2.5">
                      {show.fitClues.map((s, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{s}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(43_65%_65%)]" />What's missing
                    </p>
                    <ul className="space-y-2.5">
                      {show.missingInfo.map((s, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{s}</li>)}
                    </ul>
                  </div>
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)]" />Questions to ask
                    </p>
                    <ul className="space-y-2.5">
                      {show.questionsToAsk.map((q, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed italic">"{q}"</li>)}
                    </ul>
                  </div>
                </div>
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(348_55%_65%)]" />Caution notes
                  </p>
                  <ul className="space-y-2">
                    {show.cautionNotes.map((c, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{c}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl p-4 border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(43_65%_65%)] mb-2">Don't overread this</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{show.notToOverread}</p>
                </div>
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-foreground text-sm">Suggested opener</p>
                    <CopyBtn text={show.suggestedOpener} />
                  </div>
                  <div className="bg-[hsl(268_52%_68%/0.08)] border border-[hsl(268_52%_68%/0.2)] rounded-xl px-4 py-3">
                    <p className="text-sm text-foreground/80 italic">"{show.suggestedOpener}"</p>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-2">Fill in the [brackets] with something specific from their actual profile.</p>
                </div>
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setText(""); setContext(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Read another
                  </button>
                </div>
              )}
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
