import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Star, Shield, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { ShareButton } from "@/components/echo/ShareButton";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this text:", text);
        }
      }}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex-shrink-0 min-h-[36px] px-2 -mx-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%/0.6)]"
    >
      {copied ? <Check className="w-3 h-3 text-[hsl(142_55%_60%)]" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SectionCard({ title, color, children, badge }: { title: string; color: string; children: React.ReactNode; badge?: string }) {
  return (
    <motion.div {...fadeUp(0.06)} className="glass border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <p className="font-semibold text-foreground text-sm">{title}</p>
        </div>
        {badge && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
            style={{ color, borderColor: withAlpha(color, 0.3), background: withAlpha(color, 0.1) }}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-white/3 transition-colors text-left">
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

const REWRITTEN_BIO = `I run marketing for a company that makes software for hospital staff — which sounds like a boring job until you realise it means my whole career is convincing overworked nurses that technology is actually their friend. I'm the person who always suggests the walk-and-talk instead of a bar for a first date. I read a lot, cook badly but enthusiastically, and have recently started learning Portuguese with no clear reason. Looking for someone who has at least one genuinely weird interest they'll talk about for too long.`;

const ACTION_PLAN = [
  { day: "Day 1", action: "Rewrite your bio's first line — replace your job title with the most specific thing about the work you actually do." },
  { day: "Day 2", action: "Audit your Hinge prompts. Swap any answer that could apply to 80% of people on the app for something only you could write." },
  { day: "Day 3", action: "Send 3 opening messages. Each one must reference something from their profile that isn't their photos." },
  { day: "Day 4", action: "Review any stalled conversations — either restart with a specific question, or send a clean close." },
  { day: "Day 5", action: "Add one photo of you doing something (not posing). The activity matters more than how you look in it." },
  { day: "Day 6", action: "Set a goal: which match are you going to suggest meeting this week? Draft the ask." },
  { day: "Day 7", action: "10-minute reflection — what got a reply this week? What didn't? What's the one thing you'd do differently?" },
];

export default function SampleReport() {
  useMeta(
    "Sample Dating Reset Report",
    "See what a full Dating Reset Report looks like — real structure, sample content, no fluff."
  );

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[450px] h-[450px] -top-20 -right-20 opacity-20 pointer-events-none" />
        <div className="orb orb-gold   fixed w-[300px] h-[300px] bottom-20 -left-10 opacity-15 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">

          {/* Sample disclaimer */}
          <motion.div {...fadeUp(0)} className="mb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.08)] text-xs text-[hsl(248_62%_62%)] font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(248_62%_52%)]" />
              Sample report — fictional profile, real structure
            </div>
          </motion.div>

          {/* Magazine masthead — Jordan's report, hero score side-by-side */}
          <motion.div {...fadeUp(0.04)} className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">Dating Reset Report — Issue 01</p>
            <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-end border-b border-white/10 pb-7">
              <div className="min-w-0">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-foreground leading-[1.02] sm:leading-[0.95] mb-3 break-words">
                  Jordan's <span className="sm:block">Dating Reset.</span>
                </h1>
                <p className="text-muted-foreground text-sm">31 · Hinge · Looking for a long-term relationship</p>
              </div>
              <div className="flex flex-col items-center sm:items-end">
                <div className="w-32 h-32 sm:w-36 sm:h-36 relative flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke="url(#hero-score-grad)" strokeWidth="2.5"
                      strokeDasharray={`${72} ${100 - 72}`} strokeLinecap="round" />
                    <defs>
                      <linearGradient id="hero-score-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="hsl(var(--brand-indigo))" />
                        <stop offset="100%" stopColor="hsl(var(--brand-green))" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl sm:text-5xl font-bold text-foreground leading-none">72</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">Signal Score</span>
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(43_65%_68%)] mt-2">Solid — with one big gap</p>
              </div>
            </div>
          </motion.div>

          {/* Magazine section nav — bigger pills, sticky-feel masthead */}
          <motion.div {...fadeUp(0.055)} className="mb-7 -mx-1 flex items-center gap-2 flex-wrap select-none">
            {[
              { label: "Starting point", color: "hsl(348 55% 68%)" },
              { label: "Mirror",         color: "hsl(190 55% 65%)" },
              { label: "Blueprint",      color: "hsl(var(--brand-indigo))" },
              { label: "Rewrite",        color: "hsl(142 55% 65%)" },
              { label: "Messages",       color: "hsl(43 65% 68%)" },
              { label: "Plan",           color: "hsl(190 55% 65%)" },
              { label: "Next steps",     color: "hsl(142 55% 65%)" },
            ].map((item) => (
              <span
                key={item.label}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border"
                style={{
                  color: item.color,
                  borderColor: withAlpha(item.color, 0.25),
                  background: withAlpha(item.color, 0.06),
                }}
              >
                {item.label}
              </span>
            ))}
          </motion.div>

          {/* What Jordan came in with */}
          <motion.div {...fadeUp(0.06)} className="glass border border-white/8 rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[hsl(348_55%_65%)]" />
              <p className="font-semibold text-foreground text-sm">What Jordan came in with</p>
              <span className="ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[hsl(348_55%_65%/0.3)] bg-[hsl(348_55%_65%/0.1)] text-[hsl(348_55%_65%)]">Before</span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Bio — as submitted</p>
                <p className="text-sm text-muted-foreground/70 leading-relaxed italic">
                  "Marketing manager. I like good food, music, and getting outdoors when I can. Looking for someone genuine who knows what they want."
                </p>
              </div>
              <div className="flex flex-wrap gap-5 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-1">Goal</p>
                  <p className="text-xs text-muted-foreground">Long-term relationship</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-1">Platform</p>
                  <p className="text-xs text-muted-foreground">Hinge</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-1">Biggest challenge</p>
                  <p className="text-xs text-muted-foreground">Not getting enough matches</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["⚠ Generic opener", "⚠ No personality hook", "⚠ Could be anyone", "⚠ No conversation starter"].map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-[hsl(348_55%_60%/0.1)] text-[hsl(348_55%_68%)] border border-[hsl(348_55%_60%/0.2)]">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Signal Score */}
          <motion.div {...fadeUp(0.08)} className="glass border border-white/8 rounded-2xl p-6 mb-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Profile Signal Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-foreground">72</span>
                  <span className="text-xl text-muted-foreground/40 mb-1.5">/100</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Strong raw material — authentic and complete. The gap is in how you're framing what you want to signal.
                </p>
              </div>
              <div className="w-24 h-24 relative flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke="url(#score-grad)" strokeWidth="2.5"
                    strokeDasharray={`${72} ${100 - 72}`} strokeLinecap="round" />
                  <defs>
                    <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--brand-indigo))" />
                      <stop offset="100%" stopColor="hsl(var(--brand-green))" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-foreground">72</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Authenticity", score: 78, color: "hsl(var(--brand-green))" },
                { label: "Specificity",  score: 62, color: "hsl(var(--brand-gold))" },
                { label: "Approachability", score: 65, color: "hsl(var(--brand-gold))" },
                { label: "Energy Match", score: 74, color: "hsl(var(--brand-green))" },
                { label: "Completeness", score: 81, color: "hsl(var(--brand-green))" },
              ].map(d => (
                <div key={d.label} className="glass rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{d.score}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-tight">{d.label}</p>
                  <div className="h-0.5 rounded-full mt-1.5 bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Mirror Profile */}
          <SectionCard title="Mirror Profile" color="hsl(190 55% 60%)" badge="Signal Gap">
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(348_55%_65%)] mb-2">What you project</p>
                <ul className="space-y-1.5">
                  {["Professional, self-sufficient", "Values-driven, has standards", "Independent, composed", "Someone who has their life together"].map(t => (
                    <li key={t} className="text-xs text-muted-foreground/60 flex items-start gap-1.5"><span className="text-muted-foreground/30 mt-0.5">·</span>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55% 60%)] mb-2">What you actually want</p>
                <ul className="space-y-1.5">
                  {["Warmth and shared humor", "Emotional depth, not just depth of résumé", "Someone who 'gets' you without explanation", "Ease — not performance"].map(t => (
                    <li key={t} className="text-xs text-muted-foreground/60 flex items-start gap-1.5"><span className="text-muted-foreground/30 mt-0.5">·</span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-[hsl(43_65%_65%/0.08)] border border-[hsl(43_65%_65%/0.2)] rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-[hsl(43_65%_75%)] mb-1">Signal gap</p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Your profile signals competence and independence well. It doesn't signal that you're open to connection or that you find people genuinely interesting. The fix is one or two specific details — not more credentials.
              </p>
            </div>
          </SectionCard>

          {/* Personal Blueprint */}
          <SectionCard title="Personal Blueprint" color="hsl(var(--brand-indigo))">
            <div className="space-y-3">
              {[
                { label: "First impression", text: "You come across as capable and composed. The gap is that 'composed' can easily read as 'not looking'. Nothing in your current profile invites someone in." },
                { label: "Repeating pattern", text: "You tend to lead with competence rather than curiosity. You tell people what you've done before you show them what you notice. Questions and warmth come later — but on apps, later doesn't happen." },
                { label: "Communication style", text: "Direct and economical — both strengths. Early conversations need more warmth than you naturally default to. You don't need to change your voice, just turn up the heat slightly at the start." },
                { label: "Growth edge", text: "Letting something real and slightly unpolished about you appear in the first paragraph. The hospital line in the rewrite does this — it's specific, it's warm, and it's the kind of thing only you would write." },
              ].map(s => (
                <div key={s.label} className="glass border border-white/5 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">{s.label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Profile Rewrite */}
          <SectionCard title="Profile Rewrite" color="hsl(var(--brand-green))" badge="Copy-ready">
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(348_55%_65%)] mb-2">Before</p>
                <p className="text-xs text-muted-foreground/50 leading-relaxed font-mono whitespace-pre-line">
                  Marketing manager. I like good food, music, and getting outdoors when I can. Looking for someone genuine who knows what they want.
                </p>
              </div>
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(142_55%_60%)]">After</p>
                  <CopyBtn text={REWRITTEN_BIO} />
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{REWRITTEN_BIO}</p>
              </div>
              <div className="bg-[hsl(248_62%_52%/0.08)] border border-[hsl(248_62%_52%/0.2)] rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  <strong className="text-muted-foreground">Why it works:</strong> The hospital line does three things — it's specific to you, it shows warmth (you care about people), and it's a conversation starter. The Portuguese line is small and honest. The last sentence filters for people who are actually a match.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Founder Review Note */}
          <motion.div {...fadeUp(0.1)} className="glass border border-[hsl(248_62%_52%/0.35)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-[hsl(248_62%_52%/0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] flex items-center justify-center text-white text-xs font-bold">F</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Founder Review Note</p>
                  <p className="text-xs text-muted-foreground/50">Personal note — included with Dating Reset</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "Jordan — your profile is doing most of the work well. The one change I'd make today is your first line. 'Marketing manager' is a job title, not an identity. Replace it with the most specific thing about the work you actually do. The hospital software line I added? That's a conversation starter. Your current line isn't. Everything else — the prompts, the message strategy, the photos — is fixable in sequence, but that first line is what someone reads in three seconds before deciding whether to swipe. Start there."
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5" fill="hsl(var(--brand-gold))" stroke="hsl(var(--brand-gold))" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/50">Founder-reviewed · Sample content only</p>
              </div>
            </div>
          </motion.div>

          {/* Message Strategy */}
          <SectionCard title="Message Strategy" color="hsl(var(--brand-rose))">
            <div className="space-y-3">
              {[
                {
                  type: "Opening message",
                  text: `"I see you also have strong feelings about walk-and-talks vs bars for a first date — what's your case for the bar?"`,
                  note: "Reference something specific from their profile. Turn it into a question that has a real answer.",
                  color: "hsl(var(--brand-indigo))",
                },
                {
                  type: "Follow-up (day 2 silence)",
                  text: `"Still thinking about the [thing they mentioned] — did you end up going?"`,
                  note: "One specific callback. One question. Three sentences max. No 'just checking in'.",
                  color: "hsl(190 55% 60%)",
                },
                {
                  type: "The ask",
                  text: `"I'm free Wednesday or Thursday — the walk-and-talk route is yours to pick."`,
                  note: "Specific days. Acknowledge the previous conversation. Let them choose the detail.",
                  color: "hsl(var(--brand-green))",
                },
              ].map(m => (
                <div key={m.type} className="glass border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between"
                    style={{ background: withAlpha(m.color, 0.08) }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: m.color }}>{m.type}</p>
                    <CopyBtn text={m.text} />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-foreground mb-2 italic">{m.text}</p>
                    <p className="text-xs text-muted-foreground/50">{m.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Compatibility Compass */}
          <SectionCard title="Compatibility Compass" color="hsl(var(--brand-gold))">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55%_60%)] mb-2">High compatibility</p>
                <ul className="space-y-1.5">
                  {[
                    "Someone who values directness without coldness",
                    "Curious, interested in ideas — not just events",
                    "Comfortable with independence in a relationship",
                    "Able to name what they actually want (not just what sounds good)",
                  ].map(t => (
                    <li key={t} className="text-xs text-muted-foreground/60 flex items-start gap-1.5">
                      <span className="text-[hsl(142_55%_60%)] mt-0.5 flex-shrink-0">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(348_55%_65%)] mb-2">Friction points</p>
                <ul className="space-y-1.5">
                  {[
                    "High emotional urgency early on",
                    "Needs constant validation or reassurance",
                    "Treats ambition as a personality",
                    "Can't handle directness — reads it as coldness",
                  ].map(t => (
                    <li key={t} className="text-xs text-muted-foreground/60 flex items-start gap-1.5">
                      <span className="text-[hsl(348_55%_65%)] mt-0.5 flex-shrink-0">·</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>

          {/* Compatibility Profile preview */}
          <motion.div {...fadeUp(0.09)} className="glass border border-[hsl(248_62%_52%/0.2)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[hsl(248_62%_52%)]" />
                <p className="font-semibold text-foreground text-sm">Compatibility Profile Snapshot</p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[hsl(43_65%_65%/0.3)] bg-[hsl(43_65%_65%/0.1)] text-[hsl(43_65%_65%)]">
                Dating Reset Add-on
              </span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                With the Dating Reset, your compatibility profile gets analysed alongside your audit — surfacing how your communication style, conflict approach, and lifestyle dimensions either support or work against your stated dating goals.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { dim: "Communication", pct: 92, note: "Direct, prefers face-to-face", color: "hsl(228 50% 68%)" },
                  { dim: "Conflict",      pct: 78, note: "Repair-focused, gives space first", color: "hsl(15 65% 62%)" },
                  { dim: "Values",        pct: 85, note: "Values-aligned first",              color: "hsl(var(--brand-gold))" },
                  { dim: "Lifestyle",     pct: 70, note: "Routine-driven, early riser",       color: "hsl(35 65% 62%)" },
                  { dim: "Intimacy",      pct: 60, note: "Builds slowly · approved for matching", color: "hsl(305 45% 62%)" },
                  { dim: "Future vision", pct: 88, note: "Family-oriented, location-flexible", color: "hsl(190 55% 60%)" },
                ].map(d => (
                  <div key={d.dim} className="rounded-xl bg-white/3 border border-white/5 p-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{d.dim}</p>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: d.color }}>{d.pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/8 mb-2">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.color }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{d.note}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                <Shield className="w-3.5 h-3.5 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  All dimensions are coaching-only by default. Matching-approved dimensions are explicitly unlocked by you.{" "}
                  <Link href="/wellness" className="text-[hsl(248_62%_52%)] hover:text-[hsl(248_62%_62%)] transition-colors">Build your profile →</Link>
                </p>
              </div>
            </div>
          </motion.div>

          {/* 7-Day Plan */}
          <SectionCard title="7-Day Action Plan" color="hsl(190 55% 60%)">
            <div className="space-y-2">
              {ACTION_PLAN.map((item, i) => (
                <div key={item.day} className="flex items-start gap-3 p-3 glass border border-white/5 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(190_55%_60%/0.12)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[hsl(190_55%_65%)]">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">{item.day}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* FAQ collapsed */}
          <motion.div {...fadeUp(0.12)} className="mt-5 space-y-2">
            <Collapsible title="What happens after I submit for a real Dating Reset?">
              <div className="space-y-2 pt-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Instantly:</strong> You get your AI-generated report — Signal Score, Blueprint, profile rewrite, message strategy, and 7-day plan.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Within 24 hours (beta):</strong> During the founding beta, your report gets a personal review note from the founder — a short, direct note on the 1-2 things that'll make the biggest difference for you specifically.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Your privacy:</strong> You choose what you submit. Nothing is stored beyond what you share. You can export or delete your data at any time.
                </p>
              </div>
            </Collapsible>
            <Collapsible title="Is this real AI or template content?">
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                The AI coaching engine generates output specific to what you share, not a template fill-in. The deterministic engine ships with every account by default: built in-house, no external calls, no rate limits, always available. If Deep AI lane is on in Settings, Anthropic Claude is layered on top for tools that benefit from semantic depth (bio rewrites, message coaching, Compatibility Compass, imports), processed under their zero-retention API policy. The founder review note is written by a human. The sample report above was written by hand for illustration.
              </p>
            </Collapsible>
            <Collapsible title="Is this for everyone — not just straight/cis daters?">
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                Yes — built for every dating context: straight, gay, lesbian, queer, bi, pan, trans, non-binary, monogamous, non-monogamous, casual, serious. The sample below uses one fictional profile for illustration; the engine adapts to your actual identity, who you're dating, and the platform you're on. See <a href="/gallery" className="underline text-foreground hover:text-primary">the gallery</a> for queer, sapphic, gay-male, and ENM rewrites. Platform-specific modes cover Hinge, Tinder, Bumble, Feeld, Grindr, HER, OkCupid, Lex, and more.
              </p>
            </Collapsible>
          </motion.div>

          {/* CTA */}
          <motion.div {...fadeUp(0.15)} className="mt-8 glass border border-white/8 rounded-2xl p-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.08)] text-xs text-[hsl(248_62%_62%)] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse" />
              Live beta · First 25 users · Personal founder review included
            </div>
            <h2 className="text-xl font-bold text-foreground">Get your own report</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This is what we'd produce for your actual profile. Start free — 3 minutes, no credit card, no account required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/start"
                className="px-7 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] text-white">
                Start Free Audit <ArrowRight className="inline ml-1 w-3.5 h-3.5" />
              </Link>
              <Link href="/pricing"
                className="px-7 py-3 rounded-full text-sm font-semibold border border-white/10 hover:border-white/20 transition-colors text-muted-foreground">
                See Dating Reset pricing →
              </Link>
            </div>
            <p className="text-xs text-muted-foreground/40">Free forever · no credit card · no account required to start</p>
            <div className="pt-2 flex items-center justify-center">
              <ShareButton
                surface="sample-report"
                title="What MatchLab Club's profile report looks like"
                text="Found this sample dating-profile audit on MatchLab Club — Signal Score, blueprint, AI rewrite, message strategy. Worth a look."
                path="/sample"
                ref="sample-report"
                variant="pill"
                label="Share this sample"
                testId="button-share-sample"
              />
            </div>
          </motion.div>

          {/* Trust promise */}
          <motion.div {...fadeUp(0.18)} className="mt-6 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">You control what is saved.</strong>{" "}
              Private content is not sold. Future connections are opt-in. You choose what becomes part of your profile — and you can export or delete everything at any time.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}