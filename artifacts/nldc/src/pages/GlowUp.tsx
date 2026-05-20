import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Wand2, Copy, Check, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { ConfidenceLabel, getConfidenceLevel } from "@/components/ToneBar";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface GlowVersion {
  style: string;
  platform?: string;
  label: string;
  bio: string;
  tip: string;
  color: string;
}

function generateGlowUp(original: string, goal: string): GlowVersion[] {
  const lower = original.toLowerCase();
  const firstName = "";
  const hasHumor = /laugh|fun|humor|funny|sarcas|banter|wit|joke/.test(lower);
  const hasAdventure = /travel|hike|outdoors|adventur|explore/.test(lower);
  const hasCareer = /work|career|build|creat|lead|entrepreneur|professional/.test(lower);
  const hasIntellect = /read|book|curious|learn|think|science|art|film|music/.test(lower);
  const hasHomebody = /cozy|home|cook|dog|cat|introvert|stay in|quiet/.test(lower);
  const hasValues = /honest|kind|loyal|genuine|authentic|real|meaning/.test(lower);
  const isTooShort = original.trim().split(/\s+/).length < 30;

  const core = hasHumor ? "makes people laugh on first dates" : hasCareer ? "builds things and shows up" : hasHomebody ? "makes the ordinary feel like enough" : "pays attention in ways most people don't";
  const detail = hasAdventure ? "spontaneously rerouted a road trip and ended up somewhere better" : hasIntellect ? "can talk about almost anything for too long" : hasHomebody ? "can recommend a cozy spot in any neighborhood" : "remembers the thing you mentioned twice in passing";
  const closing = goal?.toLowerCase().includes("serious") || goal?.toLowerCase().includes("relationship") ? "If you're also tired of dating as a performance, I'd really like to meet you." : goal?.toLowerCase().includes("casual") ? "No pressure, no script — just see where it goes." : "Let's find out.";

  return [
    {
      style: "serious",
      label: "Serious / Long-Term",
      bio: `I'm someone who ${core}. Not in a way that's trying to impress you — in a way that's just how I am. I ${detail}. I'm here because I want something real, which means I'm looking for someone who's also done pretending that doesn't matter. ${closing}`,
      tip: "Leads with character, not a list of attributes. States intention without desperation.",
      color: "hsl(268 52% 68%)",
    },
    {
      style: "playful",
      label: "Playful / Light",
      bio: `Hot take: the best first dates feel like the second one. I'm ${core.replace("makes", "the kind of person who makes").replace("builds", "building").replace("makes the", "making the").replace("pays", "paying")}. I'll probably make you laugh at something unexpected, order something off-menu, and remember what you said three conversations later. Looking for someone who's actually trying — not just swiping. Is that you?`,
      tip: "Light tone signals ease without lowering seriousness. The question at the end invites.",
      color: "hsl(43 65% 65%)",
    },
    {
      style: "direct",
      label: "Direct / Confident",
      bio: `I know what I bring. I ${core}. I take connection seriously — which means I'm not here to collect matches or waste your time. I'm looking for someone who has their life together, knows what they want, and can hold a real conversation. If that's you, say something specific. Generic openers get generic responses.`,
      tip: "Confidence without arrogance. States expectations directly — this self-selects the right matches.",
      color: "hsl(190 55% 60%)",
    },
    {
      style: "queer",
      label: "Queer-Friendly",
      bio: `I'm ${core.replace("makes", "the one who makes").replace("builds", "someone who builds").replace("makes the", "making the").replace("pays", "paying")} — and I'm done with profiles that read like LinkedIn bios or therapy intake forms. I'm looking for someone real, wherever you are on whatever spectrum. I bring genuine presence, a low tolerance for small talk, and the ability to ${detail}. Let's skip the awkward part and get to the good part.`,
      tip: "Inclusive without over-signaling. Personality-forward. Invites engagement.",
      color: "hsl(285 45% 65%)",
    },
    {
      style: "lessgeneric",
      label: "Less Generic",
      bio: `I'll give you one true thing: I'm the person who ${detail}. I ${core} — but I only mention that because it's actually true, not because it sounds good. I'm not sure how to write a bio that sounds like a person and not a brand. This is my best attempt. If it worked, send me your current unpopular opinion. If it didn't, no hard feelings.`,
      tip: "Meta-honesty creates instant differentiation. The specific detail does all the heavy lifting.",
      color: "hsl(142 55% 60%)",
    },
    {
      style: "hinge",
      platform: "Hinge",
      label: "Hinge-Style",
      bio: `The way to win me over is: ${hasHumor ? "make me laugh at something I wasn't expecting to find funny" : hasIntellect ? "recommend something that changes how I think about something" : "show up exactly as advertised. Consistency is underrated."}

I'm looking for: Someone who takes the relationship seriously but doesn't take themselves seriously. Those are different things.

Typical Sunday: ${hasHomebody ? "Slow morning, good coffee, cooking something with too many steps, and genuinely enjoying all of it." : hasAdventure ? "Probably outside, probably went further than planned, definitely didn't regret it." : "A mix of productive and useless in a ratio that feels right that day."}`,
      tip: "Uses Hinge prompt format. Each answer ends with something to respond to.",
      color: "hsl(348 55% 65%)",
    },
    {
      style: "tinder",
      platform: "Tinder",
      label: "Tinder-Style",
      bio: `${core.charAt(0).toUpperCase() + core.slice(1)}. ${hasHumor ? "6'1\" is a lie. But everything else checks out." : hasCareer ? "My job is boring to explain. I am not." : "Somehow always has the aux. Always."} Looking for someone who's ${hasValues ? "actually genuine, not just profile-genuine" : goal?.toLowerCase().includes("serious") ? "done doing this casually" : "interesting enough to make me put the phone down"}. Swipe if you want, message if you mean it.`,
      tip: "Short, punchy, self-aware. Tinder rewards brevity and tone over length.",
      color: "hsl(348 55% 58%)",
    },
    {
      style: "grindr",
      platform: "Grindr",
      label: "Grindr-Style",
      bio: `${core.charAt(0).toUpperCase() + core.slice(1)}. ${hasHumor ? "Genuinely funny, not just 'lol.'" : hasCareer ? "Has a life outside this app." : "Actually reads bios."} Looking for: ${goal?.toLowerCase().includes("serious") ? "something that goes somewhere" : goal?.toLowerCase().includes("casual") ? "what we both want — no performance required" : "a real conversation first, anything else after"}. Ask me something real.`,
      tip: "Direct and efficient. Grindr rewards clarity about what you want.",
      color: "hsl(43 65% 60%)",
    },
    {
      style: "sniffies",
      platform: "Sniffies",
      label: "Sniffies-Style",
      bio: `${core.charAt(0).toUpperCase() + core.slice(1)}. Here for what this app is for — no judgment, no complications. ${hasHumor ? "Good vibes, good humor, clean." : "Clean, curious, low-drama."} Chat first, always. If you're respectful I'll match it.`,
      tip: "Brief, clear, non-judgmental. Sniffies users value honesty about intent.",
      color: "hsl(43 65% 65%)",
    },
    {
      style: "feeld",
      platform: "Feeld",
      label: "Feeld-Style",
      bio: `Curious, ${hasHumor ? "playful," : ""} and here with genuine interest in connection — whatever shape that takes. I ${core}. I value honesty about what we each want, low-pressure exploration, and people who show up as themselves. ${goal?.toLowerCase().includes("casual") ? "Not looking for anything heavy — just real." : "Open to where things go when people are honest from the start."} Tell me what brought you here.`,
      tip: "Feeld rewards openness, curiosity, and non-judgmental language over traditional dating copy.",
      color: "hsl(285 45% 68%)",
    },
  ];
}

const DEMO_BIO = `I'm a pretty laid-back person who loves to travel and try new restaurants. I work in tech and spend most weekends outdoors or exploring the city. Looking for someone genuine who knows what they want. I love to laugh and value honesty above everything else.`;

const DEMO_VERSIONS = generateGlowUp(DEMO_BIO, "");

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

function VersionCard({ v, original }: { v: GlowVersion; original: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass border border-white/8 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${v.color.replace(")", " / 0.15)")}` }}>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
          <span className="font-semibold text-foreground text-sm">{v.label}</span>
          {v.platform && <span className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground/60" style={{ borderColor: v.color.replace(")", " / 0.2)") }}>{v.platform}</span>}
        </div>
        <div className="flex items-center gap-3">
          <CopyBtn text={v.bio} />
          <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {/* Before */}
      {open && original && (
        <div className="px-5 py-4 bg-[hsl(232_28%_11%)] border-b border-white/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2">Before</p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed whitespace-pre-line">{original}</p>
        </div>
      )}
      {/* After */}
      <div className="px-5 py-4">
        {open && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2">After</p>}
        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{v.bio}</p>
        <p className="text-xs text-muted-foreground/50 mt-3 italic">{v.tip}</p>
      </div>
    </div>
  );
}

const GOALS = ["Long-term relationship", "Casual / open", "Figuring it out", "Friends first", "App-specific (I'll choose below)"];
const SHOW_STYLES = ["serious", "playful", "direct", "queer", "lessgeneric", "hinge", "tinder", "grindr", "sniffies", "feeld"];

export default function GlowUp() {
  useMeta("Profile Glow-Up Studio", "Paste your current bio and get 10 rewritten versions — serious, playful, direct, queer-friendly, less generic, and platform-specific for Hinge, Tinder, Grindr, Sniffies, and Feeld.");
  const [bio, setBio] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<GlowVersion[] | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const [filter, setFilter] = useState<string[]>([]);

  function tryParseGlowUp(raw: string, deterministic: GlowVersion[]): GlowVersion[] | null {
    try {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (!Array.isArray(parsed)) return null;
      const colorByStyle = new Map(deterministic.map(v => [v.style, { color: v.color, label: v.label, platform: v.platform }]));
      const out: GlowVersion[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const style = typeof o.style === "string" ? o.style.trim() : "";
        const bioText = typeof o.bio === "string" ? o.bio.trim() : "";
        const tip = typeof o.tip === "string" ? o.tip.trim() : "";
        const meta = colorByStyle.get(style);
        if (!meta || bioText.length < 60 || tip.length < 15) continue;
        const label = typeof o.label === "string" && o.label.trim().length >= 3 ? o.label.trim() : meta.label;
        const platform = typeof o.platform === "string" && o.platform.trim() ? o.platform.trim() : meta.platform;
        out.push({ style, label, platform, bio: bioText, tip, color: meta.color });
      }
      if (out.length < Math.ceil(deterministic.length / 2)) return null;
      const present = new Set(out.map(v => v.style));
      for (const v of deterministic) if (!present.has(v.style)) out.push(v);
      const order = new Map(deterministic.map((v, i) => [v.style, i]));
      out.sort((a, b) => (order.get(a.style) ?? 99) - (order.get(b.style) ?? 99));
      return out;
    } catch {
      return null;
    }
  }

  async function handleGenerate() {
    if (!bio.trim()) return;
    const deterministic = generateGlowUp(bio, goal);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Profile Glow-Up Studio",
          prompt: [
            "Rewrite this dating profile bio into 10 versions, one per style. Return ONLY a single JSON array:",
            '[{ "style": string, "label": string, "platform"?: string, "bio": string, "tip": string }, ...]',
            "Use these exact style keys (one entry each): serious, playful, direct, queer, lessgeneric, hinge, tinder, grindr, sniffies, feeld.",
            "bio: 2-5 sentences, in the voice of that style/platform.",
            "tip: 1 short sentence explaining why this version works.",
            "platform is required for hinge/tinder/grindr/sniffies/feeld.",
            "",
            `Original bio:\n${bio}`,
            goal ? `Goal: ${goal}` : "",
            "",
            "Return ONLY the JSON array. No prose, no markdown.",
          ].filter(Boolean).join("\n"),
          context: { toolName: "Profile Glow-Up Studio", formValues: { bio, goal } },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        setResult(deterministic);
        return;
      }
      const parsed = tryParseGlowUp(ai.output, deterministic);
      setUsedFallback(parsed == null);
      setResult(parsed ?? deterministic);
    } catch {
      setUsedFallback(true);
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO_VERSIONS;
  const isDemo = !result;
  const displayed = filter.length > 0 ? show.filter(v => filter.includes(v.style)) : show;

  const FILTER_OPTS = [
    { key: "serious", label: "Serious" }, { key: "playful", label: "Playful" }, { key: "direct", label: "Direct" },
    { key: "queer", label: "Queer-Friendly" }, { key: "lessgeneric", label: "Less Generic" },
    { key: "hinge", label: "Hinge" }, { key: "tinder", label: "Tinder" }, { key: "grindr", label: "Grindr" },
    { key: "sniffies", label: "Sniffies" }, { key: "feeld", label: "Feeld" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-10 right-0 opacity-25 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Profile Tools</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Profile Glow-Up Studio</h1>
            <FallbackRateBadge toolName="Profile Glow-Up Studio" className="mt-1" />

            <p className="text-muted-foreground mt-2">Paste your current bio and get 10 versions — different styles, different platforms, all built from what actually works.</p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your current bio</Label>
              <Textarea placeholder="Paste your current dating profile bio here — even if you hate it. Especially if you hate it."
                value={bio} onChange={e => setBio(e.target.value)}
                className="min-h-[140px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What are you looking for? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading || !bio.trim()}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Writing 10 versions…</> : <><Wand2 className="mr-2 h-4 w-4" />Glow Up My Profile</>}
            </Button>
          </motion.div>

          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example rewrites — paste your bio above to get yours
                  </p>
                </div>
              )}
              {!isDemo && usedFallback && (
                <FallbackNotice
                  onRetry={handleGenerate}
                  loading={loading}
                  label="rewrite set"
                  testId="button-retry-glowup"
                />
              )}

              {result && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground/60">Your rewrites</p>
                  <ConfidenceLabel level={getConfidenceLevel(bio.length, goal ? 1 : 0)} />
                </div>
              )}
              {/* Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {FILTER_OPTS.map(f => (
                  <button key={f.key} onClick={() => setFilter(prev => prev.includes(f.key) ? prev.filter(x => x !== f.key) : [...prev, f.key])}
                    className={`px-2.5 py-1 rounded-full border text-xs transition-all ${filter.includes(f.key) ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                    {f.label}
                  </button>
                ))}
                {filter.length > 0 && (
                  <button onClick={() => setFilter([])} className="text-xs text-muted-foreground/50 hover:text-muted-foreground px-2">clear</button>
                )}
              </div>

              <div className="space-y-3">
                {displayed.map((v, i) => <VersionCard key={v.style} v={v} original={result ? bio : DEMO_BIO} />)}
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setBio(""); setGoal(""); setFilter([]); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Glow up a different bio
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
