import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, Check, ChevronDown, ChevronUp, Search } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type ScenarioCategory = "first-date" | "re-engaging" | "rejection" | "slow-fade" | "early-conflict" | "exclusivity" | "ghosting" | "vulnerability";

interface ScenarioOption {
  label: string;
  message: string;
  tone: string;
}

interface Scenario {
  id: string;
  category: ScenarioCategory;
  title: string;
  situation: string;
  guidance: string;
  options: ScenarioOption[];
}

const CAT_CONFIG: Record<ScenarioCategory, { label: string; color: string }> = {
  "first-date":    { label: "First Date",         color: "hsl(268 52% 68%)" },
  "re-engaging":   { label: "Re-engaging",         color: "hsl(190 55% 60%)" },
  "rejection":     { label: "After Rejection",     color: "hsl(348 55% 65%)" },
  "slow-fade":     { label: "Slow Fade",           color: "hsl(43 65% 65%)"  },
  "early-conflict":{ label: "Early Friction",      color: "hsl(285 45% 65%)" },
  "exclusivity":   { label: "Exclusivity Talk",    color: "hsl(142 55% 60%)" },
  "ghosting":      { label: "Ghosting",            color: "hsl(228 18% 60%)" },
  "vulnerability": { label: "Showing Vulnerability", color: "hsl(43 65% 65%)" },
};

const SCENARIOS: Scenario[] = [
  {
    id: "1", category: "first-date", title: "Suggesting a first date without sounding desperate",
    situation: "You've had a good exchange and want to move things off the app. You're not sure how to suggest it without over-committing or sounding over-eager.",
    guidance: "Keep it light and low-stakes. Make a specific suggestion rather than a vague 'we should meet.' A specific suggestion signals confidence; a vague one puts the work back on them.",
    options: [
      { label: "Direct", tone: "Confident", message: "I've been enjoying this — want to grab coffee this weekend? There's a good place near [neighborhood] if that works for you." },
      { label: "Light", tone: "Easy", message: "We keep talking about [shared topic] — we should probably just meet up and finish this conversation properly." },
      { label: "Warm", tone: "Personal", message: "I'd like to actually meet you. I'm free [day] or [day] — either work for you?" },
    ],
  },
  {
    id: "2", category: "re-engaging", title: "Reaching out after a week of silence",
    situation: "The conversation went quiet — either naturally or awkwardly. You want to re-open it without making the silence the topic.",
    guidance: "Don't reference the gap unless they do. Just pick up where things were interesting. A natural re-entry says you weren't overthinking the silence — which is the energy you want.",
    options: [
      { label: "Reference the thread", tone: "Natural", message: "Still thinking about what you said about [specific thing]. Did you ever [follow up on it]?" },
      { label: "New opener", tone: "Fresh", message: "Saw something that reminded me of that thing you mentioned about [topic]. How's [related thing] going?" },
      { label: "Simple check-in", tone: "Low-stakes", message: "Hey — how's [recent thing they mentioned] going?" },
    ],
  },
  {
    id: "3", category: "rejection", title: "Receiving a 'not feeling it' message with grace",
    situation: "Someone you were interested in has let you know they're not feeling a connection. You want to respond in a way you'll feel good about.",
    guidance: "Short is better. Warmth is not weakness. A graceful response says more about your character than any other message in a conversation — and you'll remember how you handled this.",
    options: [
      { label: "Simple grace", tone: "Clean", message: "Thanks for saying so directly — genuinely, that's harder than going quiet. Good luck out there." },
      { label: "Warm close", tone: "Generous", message: "Appreciate the honesty. Take care." },
      { label: "Grounded", tone: "Easy", message: "All good. Appreciate you letting me know. Hope you find what you're looking for." },
    ],
  },
  {
    id: "4", category: "slow-fade", title: "Naming a slow fade without sounding needy",
    situation: "Someone who was warm is now replying late and briefly. You want to address it without creating drama or sounding insecure.",
    guidance: "Keep it curious, not accusatory. Give them an easy exit. A clean 'let me know if things have changed' often gets either a real conversation or a graceful ending — both are better than a slow fade.",
    options: [
      { label: "Curious", tone: "Neutral", message: "You seem busier lately — totally fine if things have shifted. Just let me know either way." },
      { label: "Direct exit offer", tone: "Clean", message: "Hey — if the vibe has changed, you can just say so. No hard feelings either way." },
      { label: "Light", tone: "Easy", message: "Getting mixed signals lately — happy to just clarify where things are if that's easier." },
    ],
  },
  {
    id: "5", category: "early-conflict", title: "Addressing something that bothered you early on",
    situation: "Something they said or did didn't sit right with you. You want to name it without turning it into a bigger deal than it needs to be.",
    guidance: "Name the specific thing, say how it landed, leave space for their response. Early friction handled well is a sign of compatibility — it shows you can have a real conversation.",
    options: [
      { label: "Specific and open", tone: "Direct", message: "When you said [thing], it landed a bit [awkward / off / confusing]. I might be reading it wrong — what did you mean by it?" },
      { label: "Curious", tone: "Gentle", message: "I've been sitting with something from [recent interaction]. Is this a good time to mention it?" },
      { label: "Clear boundary", tone: "Firm", message: "I want to be honest about something — [specific thing] felt like too much too soon for me. I think I need a bit more [space / time / ease] early on." },
    ],
  },
  {
    id: "6", category: "exclusivity", title: "Bringing up exclusivity for the first time",
    situation: "Things are going well and you want to know if you're on the same page about where this is heading — without forcing a conversation that's too heavy for where you are.",
    guidance: "Keep it future-oriented, not ultimatum-shaped. Express what you want, ask what they're thinking. This isn't a test — it's just information.",
    options: [
      { label: "Open and curious", tone: "Natural", message: "I've really enjoyed how things have been — I've been thinking about what I want this to look like going forward. What are you thinking?" },
      { label: "Direct", tone: "Clear", message: "I'm at a point where I'm not really interested in seeing other people. Is that where you're at too, or is this still more open for you?" },
      { label: "Warm", tone: "Easy", message: "I like where things are going with us. I just want to make sure we're on the same page about what this is." },
    ],
  },
  {
    id: "7", category: "ghosting", title: "Being ghosted after things felt real",
    situation: "Someone who seemed genuinely interested has completely disappeared. You're deciding whether to reach out or let it go.",
    guidance: "One check-in is reasonable. More than one tips into chasing. If you do reach out, say something that's true without being heavy. Then let it rest — their silence after that is its own answer.",
    options: [
      { label: "One check-in", tone: "Grounded", message: "Hey — you've gone quiet and I'm not sure if something happened. If you're still around and things just got busy, I'm here. If not, no worries — just let me know." },
      { label: "Clean close", tone: "Graceful", message: "I'm going to assume this has run its course — which is fine. Take care of yourself." },
      { label: "Brief", tone: "Simple", message: "Just circling back. Let me know if you want to pick this back up." },
    ],
  },
  {
    id: "8", category: "vulnerability", title: "Sharing something real without over-sharing",
    situation: "You want to let someone in a bit — share something real about yourself — without making it too heavy for where you are.",
    guidance: "Match the depth of what they've shared. One real thing, offered simply, is worth more than a careful edited version of yourself. Vulnerability doesn't have to be dramatic — it can be quiet.",
    options: [
      { label: "Specific and brief", tone: "Real", message: "[Share the actual thing briefly] — I don't usually talk about this early on, but it felt relevant to what you said." },
      { label: "Acknowledge the moment", tone: "Warm", message: "I want to be honest about something, even though I usually wait longer to say things like this." },
      { label: "Simple", tone: "Direct", message: "I'll be honest — [thing]. I'd rather say that now than not." },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      {copied ? <><Check className="w-3 h-3 text-[hsl(142_55%_60%)]" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

function ScenarioCard({ scenario, i }: { scenario: Scenario; i: number }) {
  const [open, setOpen] = useState(false);
  const cfg = CAT_CONFIG[scenario.category];

  return (
    <motion.div {...fadeUp(0.04 + i * 0.04)} className="glass border border-white/8 rounded-2xl overflow-hidden hover:border-white/12 transition-all">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between gap-3 p-5 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
          <p className="font-semibold text-sm text-foreground leading-snug">{scenario.title}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/6">
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{scenario.situation}</p>
              <div className="px-3 py-3 rounded-xl border border-white/8 bg-white/3">
                <p className="text-xs font-semibold text-foreground/70 mb-1">Coaching read</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{scenario.guidance}</p>
              </div>
              <div className="space-y-3">
                {scenario.options.map((opt, oi) => (
                  <div key={oi} className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground/80">{opt.label}</span>
                        <span className="text-[11px] text-muted-foreground/50">{opt.tone}</span>
                      </div>
                      <CopyButton text={opt.message} />
                    </div>
                    <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed font-mono text-xs">{opt.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ProgressCompanion() {
  useMeta("Companion Workspace · NLDC", "Scenario cards with copy-ready guidance for common dating situations.");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<ScenarioCategory | null>(null);

  const filtered = SCENARIOS.filter(s => {
    const matchesCat  = catFilter ? s.category === catFilter : true;
    const matchesSearch = search.trim() ? s.title.toLowerCase().includes(search.toLowerCase()) || s.situation.toLowerCase().includes(search.toLowerCase()) : true;
    return matchesCat && matchesSearch;
  });

  const categories = [...new Set(SCENARIOS.map(s => s.category))];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-16 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Companion Workspace</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Common dating situations — with coaching guidance and copy-ready messages for each one. Expand any card to see your options.</p>
          </motion.div>

          {/* Search */}
          <motion.div {...fadeUp(0.04)} className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scenarios…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(268_52%_68%/0.4)]" />
          </motion.div>

          {/* Category filter */}
          <motion.div {...fadeUp(0.06)} className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setCatFilter(null)} className={`text-xs px-3 py-1 rounded-full border transition-all ${catFilter === null ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>All</button>
            {categories.map(cat => {
              const cfg = CAT_CONFIG[cat];
              return (
                <button key={cat} onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${catFilter === cat ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}
                  style={catFilter === cat ? { color: cfg.color } : {}}>
                  {cfg.label}
                </button>
              );
            })}
          </motion.div>

          <div className="space-y-3">
            {filtered.map((scenario, i) => (
              <ScenarioCard key={scenario.id} scenario={scenario} i={i} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground/50 text-sm">No scenarios match your search.</div>
            )}
          </div>

          <motion.div {...fadeUp(0.3)} className="mt-8 text-center">
            <p className="text-xs text-muted-foreground/40">Copy-ready messages are starting points — adapt them to your actual voice and situation.</p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
