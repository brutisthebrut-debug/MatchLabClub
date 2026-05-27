import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useEnhanceAi } from "@workspace/api-client-react";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";
import { Star, Copy, Check, Loader2, Sparkles, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const PLATFORMS = ["Hinge", "Bumble", "Tinder", "Feeld", "Grindr", "HER", "Lex", "Sniffies", "The League", "Thursday", "Other"];
const TONES     = ["Warm & genuine", "Witty & playful", "Confident & direct", "Thoughtful & reflective", "Easy-going"];
const GOALS_P   = ["More matches", "Better conversations", "Finding something serious", "Meeting higher-quality people", "Standing out on a crowded platform"];

interface Issue  { issue: string; severity: "high" | "medium"; fix: string; }
interface Rewrite { label: string; text: string; }
interface ProfileResult { issues: Issue[]; rewrites: Rewrite[]; overallNote: string; }

function buildFallback(bio: string, platform: string, tone: string): ProfileResult {
  const words    = bio.trim().split(/\s+/).filter(Boolean).length;
  const hasJob   = /\b(work|job|engineer|doctor|teacher|designer|lawyer|nurse|architect|manager|consultant)\b/i.test(bio);
  const hasHoby  = /\b(love|enjoy|passionate|hiking|travel|cook|read|music|gym|yoga|run|climb|surf|wine|coffee|foodie)\b/i.test(bio);
  const hasGenrc = /\b(love to laugh|easygoing|down to earth|laid back|good vibes|adventure|netflix|sarcasm|my dog)\b/i.test(bio);
  const isShort  = words < 30;

  const issues: Issue[] = [];

  if (isShort) issues.push({
    issue: "Too short to give a real impression",
    severity: "high",
    fix: "Add 2–3 specific details: what lights you up, something you're proud of, and one thing you're genuinely curious about right now.",
  });
  if (hasGenrc) issues.push({
    issue: "Generic phrases that everyone uses",
    severity: "high",
    fix: `Replace "${platform === "Hinge" ? "love to laugh" : "easygoing"}" with a specific memory or example. Instead of saying you love travel, mention where you went last and what surprised you.`,
  });
  if (!hasHoby) issues.push({
    issue: "Interests aren't visible",
    severity: "medium",
    fix: "Add one specific interest with a detail. Not 'I like hiking' — try 'I'm two-thirds through every 14er in Colorado and the last third is winning.'",
  });
  if (!hasJob && words > 20) issues.push({
    issue: "No signal on what you do or care about",
    severity: "medium",
    fix: "One line on what you do — or what drives you — helps people self-select. It doesn't have to be your job title.",
  });

  if (issues.length === 0) issues.push({
    issue: "Room to add more specific texture",
    severity: "medium",
    fix: "Your profile reads well. Add one unexpected detail — something that only you would say. That's what people remember.",
  });

  const toneTag = tone.includes("Witty") ? "playful" : tone.includes("Confident") ? "direct" : "warm";

  const rewrites: Rewrite[] = [
    {
      label: `${toneTag.charAt(0).toUpperCase() + toneTag.slice(1)} rewrite`,
      text: `${bio.length > 20 ? bio.slice(0, 60) + "…" : "Your profile text here"} [Enhanced version: More specific, ${toneTag}, with a clear sense of who you are and what you're about. Replaces generic phrases with real details.]`,
    },
    {
      label: "Conversation-starter version",
      text: "Ends with a question or hook that makes it easy for someone to respond — not a boring 'ask me anything' but something specific that shows personality.",
    },
    {
      label: `${platform || "Platform"}-optimised version`,
      text: `Formatted for ${platform || "your platform"}'s style — ${platform === "Hinge" ? "prompt-style answers that feel personal" : platform === "Bumble" ? "opener-friendly ending so they have something to respond to" : "punchy and readable in under 10 seconds"}.`,
    },
  ];

  return { issues, rewrites, overallNote: `Your profile's main opportunity is specificity. Generic phrases are invisible; specific details are memorable. One real, unexpected thing about you is worth more than three generic ones.` };
}

function tryParseAi(raw: string | undefined, fallback: ProfileResult): ProfileResult {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as { issues?: unknown[]; rewrites?: unknown[]; overallNote?: string };
    if (!Array.isArray(p.issues) || !Array.isArray(p.rewrites)) return fallback;
    return {
      issues:      (p.issues as { issue?: string; severity?: string; fix?: string }[]).filter(i => i.issue).map(i => ({ issue: i.issue ?? "", severity: (i.severity as "high" | "medium") ?? "medium", fix: i.fix ?? "" })),
      rewrites:    (p.rewrites as { label?: string; text?: string }[]).filter(r => r.text).map(r => ({ label: r.label ?? "Rewrite", text: r.text ?? "" })),
      overallNote: typeof p.overallNote === "string" ? p.overallNote : fallback.overallNote,
    };
  } catch { return fallback; }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast({ title: "Copied!" }); setTimeout(() => setCopied(false), 2000); }}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${copied ? "tag-strength border-0 bg-transparent" : ""}`}>
      {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />}
      <span className={copied ? "" : "text-muted-foreground"}>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function ImproveMyProfile() {
  useMeta("Improve My Profile", "Paste your profile, pick your platform and tone, get a prioritized rewrite plan and copy-ready versions.");
  const [bio,      setBio]      = useState("");
  const [platform, setPlatform] = useState("");
  const [tone,     setTone]     = useState("");
  const [goal,     setGoal]     = useState("");
  const [result,   setResult]   = useState<ProfileResult | null>(null);
  const [step,     setStep]     = useState(0);
  const enhance = useEnhanceAi();

  function handleGenerate() {
    const fb = buildFallback(bio, platform, tone);
    setResult(fb);
    setStep(1);
    const prompt = [
      `Profile text:\n${bio}`,
      platform && `Platform: ${platform}`,
      tone     && `Preferred tone: ${tone}`,
      goal     && `Goal: ${goal}`,
    ].filter(Boolean).join("\n\n") +
    `\n\nReturn JSON: { "issues": [{ "issue": string, "severity": "high"|"medium", "fix": string }] (2-4 items), "rewrites": [{ "label": string, "text": string }] (3 items with complete rewrite text), "overallNote": string }. Make rewrites fully copy-ready, not placeholders.`;
    enhance.mutate({ data: { toolName: "Improve My Profile", prompt, expectJson: true } }, {
      onSuccess: data => { const raw = (data as { output?: string } | undefined)?.output; setResult(tryParseAi(raw, fb)); },
    });
  }

  function reset() { setResult(null); setBio(""); setPlatform(""); setTone(""); setGoal(""); setStep(0); enhance.reset(); }
  const show = result ?? buildFallback("", "", "");

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-gold fixed w-[360px] h-[360px] -top-10 -right-10 opacity-25 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp(0)} className="mb-6">
            <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
            </Link>
          </motion.div>

          <motion.div {...fadeUp(0.03)} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-[hsl(43_65%_65%)]" />
              <p className="text-sm font-medium text-[hsl(43_65%_75%)]">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Improve My Profile</h1>
            <FallbackRateBadge toolName="Improve My Profile" className="mt-1" />

            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">Paste your profile, pick your platform and tone — get a priority fix list and 3 copy-ready rewrites.</p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-6">
            {[0, 1].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(43_65%_65%)]" : "w-6 bg-white/10"}`} />
            ))}
            <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="form" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your current bio or prompts</Label>
                  <Textarea value={bio} onChange={e => setBio(e.target.value)}
                    placeholder={"Paste your current profile bio, prompts, or anything you've written about yourself.\n\nDon't overthink it — even a rough draft works."}
                    className="min-h-[140px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
                  <p className="text-[11px] text-muted-foreground/40">{bio.trim().split(/\s+/).filter(Boolean).length} words</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Platform</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button key={p} onClick={() => setPlatform(prev => prev === p ? "" : p)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${platform === p ? "bg-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_80%)] border-[hsl(43_65%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Tone you want to project</Label>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map(t => (
                      <button key={t} onClick={() => setTone(prev => prev === t ? "" : t)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${tone === t ? "bg-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_80%)] border-[hsl(43_65%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your goal <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {GOALS_P.map(g => (
                      <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_80%)] border-[hsl(43_65%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={!bio.trim()}
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(43_65%_60%)] to-[hsl(248_62%_55%)] border-0 glow-pulse disabled:opacity-50">
                  <Sparkles className="mr-2 h-4 w-4" /> Analyse My Profile
                </Button>
              </motion.div>
            ) : (
              <motion.div key="results" {...fadeUp(0.05)} className="space-y-4">
                {enhance.isPending && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(43_65%_65%/0.08)] border border-[hsl(43_65%_65%/0.2)] text-xs text-[hsl(43_65%_75%)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is refining your analysis…
                  </div>
                )}

                {/* Priority issues */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Priority fixes</p>
                  <div className="space-y-3">
                    {show.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${issue.severity === "high" ? "text-[hsl(348_55%_65%)]" : "text-[hsl(43_65%_65%)]"}`} />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{issue.issue}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">{issue.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rewrites */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Copy-ready rewrites</p>
                  <div className="space-y-4">
                    {show.rewrites.map((r, i) => (
                      <div key={i} className="border-t border-white/5 first:border-t-0 pt-4 first:pt-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(43_65%_65%)]">{r.label}</span>
                          <CopyBtn text={r.text} />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall note */}
                <div className="rounded-2xl border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.06)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(43_65%_65%)] mb-1.5">Wingman Note</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.overallNote}</p>
                </div>

                <div className="flex justify-center">
                  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Start over
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
