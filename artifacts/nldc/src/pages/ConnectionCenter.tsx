import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Image, MessageSquare, FileText, BookOpen,
  Mail, Calendar, Globe, Wifi, Lock, Eye, Check, Plus, X, ChevronDown, ChevronUp, Shield,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type Sensitivity = "low" | "medium" | "high";

interface ImportCard {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  what: string;
  sensitivity: Sensitivity;
  color: string;
  placeholder: string;
  live: true;
}

interface FutureCard {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  what: string;
  sensitivity: Sensitivity;
  color: string;
  live?: false;
  comingSoon: string;
}

type Card = ImportCard | FutureCard;

const SENSITIVITY_LABELS: Record<Sensitivity, { label: string; color: string }> = {
  low:    { label: "Low sensitivity",    color: "hsl(142 55% 60%)" },
  medium: { label: "Medium sensitivity", color: "hsl(43 65% 65%)"  },
  high:   { label: "High sensitivity",   color: "hsl(348 55% 65%)" },
};

const IMPORT_CARDS: ImportCard[] = [
  {
    id: "screenshots",
    icon: Image,
    title: "Profile Screenshots",
    desc: "Upload screenshots of profiles you've seen — yours or a match's. The app reads what's there and gives you coaching context.",
    what: "Helps with profile comparison, audit context, and coaching prompts.",
    sensitivity: "medium",
    color: "hsl(248 62% 52%)",
    placeholder: "Paste extracted text from a screenshot, or describe what you see in the profile — the app will work with what you share.",
    live: true,
  },
  {
    id: "messages",
    icon: MessageSquare,
    title: "Pasted Messages",
    desc: "Copy and paste a conversation thread. The app can read tone, patterns, and coaching opportunities.",
    what: "Powers Message Coach, Debrief, and Help Me Reply workflows.",
    sensitivity: "high",
    color: "hsl(190 55% 60%)",
    placeholder: "Paste the conversation here — you can include just the parts you want coaching on. No need to share everything.",
    live: true,
  },
  {
    id: "profile-text",
    icon: FileText,
    title: "My Profile Text",
    desc: "Paste your own bio, prompts, and headline. The app reviews it and gives you a personalised improvement plan.",
    what: "Used for Profile Audit, Improve My Profile, and Glow-Up workflows.",
    sensitivity: "medium",
    color: "hsl(43 65% 65%)",
    placeholder: "Paste your current bio, prompts, or anything written on your profile. Rough drafts are fine.",
    live: true,
  },
  {
    id: "reflections",
    icon: BookOpen,
    title: "Reflection Notes",
    desc: "Write a note about a date, a pattern you've noticed, or something you want to process. Your coach uses it as context.",
    what: "Feeds into Blueprint, Debrief, and Weekly Growth Plan.",
    sensitivity: "high",
    color: "hsl(142 55% 60%)",
    placeholder: "Write whatever feels relevant — a date debrief, a pattern you keep noticing, something you want to get clear on.",
    live: true,
  },
];

const FUTURE_CARDS: FutureCard[] = [
  {
    id: "email",
    icon: Mail,
    title: "Email Signals",
    desc: "Connect Gmail or paste email exchanges to surface communication patterns and attachment cues.",
    what: "Powers the Email Insights tool for deeper communication pattern analysis.",
    sensitivity: "high",
    color: "hsl(348 55% 65%)",
    comingSoon: "Manual paste available now in Email Insights. Direct Gmail connection coming later.",
  },
  {
    id: "calendar",
    icon: Calendar,
    title: "Calendar Context",
    desc: "Share your availability and lifestyle rhythm — not your events, just your general bandwidth.",
    what: "Helps Weekly Growth Plan suggest timing that actually fits your life.",
    sensitivity: "low",
    color: "hsl(43 65% 65%)",
    comingSoon: "Coming in a future update. Manual entry available in Life Context.",
  },
  {
    id: "social",
    icon: Globe,
    title: "Social & Public Presence",
    desc: "Link or describe your public-facing presence — what someone Googling you would find.",
    what: "Gives the Profile Audit more complete context about how you show up publicly.",
    sensitivity: "medium",
    color: "hsl(190 55% 60%)",
    comingSoon: "Self-description entry available now. Auto-import coming later.",
  },
  {
    id: "lifestyle",
    icon: Wifi,
    title: "Lifestyle Signals",
    desc: "Share context about your life rhythm — work schedule, social life, what your weeks actually look like.",
    what: "Used for compatibility coaching and Prepare for a Date to personalise advice.",
    sensitivity: "medium",
    color: "hsl(326 100% 65%)",
    comingSoon: "Manual entry available in Life Context Profile.",
  },
];

function SensitivityBadge({ level }: { level: Sensitivity }) {
  const s = SENSITIVITY_LABELS[level];
  const variant = level === "low" ? "status-success" : level === "medium" ? "status-warning" : "status-rose";
  return (
    <span className={`status-pill ${variant}`}>
      <Lock className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function ImportCardUI({ card, index }: { card: ImportCard; index: number }) {
  const [open,   setOpen]   = useState(false);
  const [text,   setText]   = useState("");
  const [saved,  setSaved]  = useState(false);
  const [preview, setPreview] = useState(false);
  const { toast } = useToast();

  function save() {
    if (!text.trim()) return;
    setSaved(true);
    setPreview(true);
    setOpen(false);
    toast({ title: `${card.title} saved`, description: "Your Copilot workflows can now use this context." });
  }

  function clear() {
    setText("");
    setSaved(false);
    setPreview(false);
  }

  const Icon = card.icon;

  return (
    <motion.div {...fadeUp(0.06 + index * 0.04)} className={`glass border rounded-2xl overflow-hidden transition-all ${saved ? "border-[hsl(142_55%_60%/0.25)]" : "border-white/8"}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: card.color.replace(")", " / 0.12)") }}>
              <Icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                {saved && <span className="text-[9px] font-bold uppercase tracking-wider text-[hsl(142_55%_60%)] flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Saved</span>}
              </div>
              <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">{card.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {saved && (
              <button onClick={clear} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Clear">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <SensitivityBadge level={card.sensitivity} />
          <span className="status-pill status-info">
            <Eye className="w-3 h-3" /> Preview before save
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/45 mt-1.5 leading-relaxed">
          <strong className="text-muted-foreground/60">Helps with:</strong> {card.what}
        </p>
      </div>

      {open && (
        <div className="border-t border-white/5 p-5 space-y-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={card.placeholder}
            className="min-h-[120px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/35 text-sm"
          />
          {text.trim() && (
            <div className="rounded-xl bg-white/3 border border-white/8 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-1.5">Preview</p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-3">{text}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={!text.trim()} size="sm"
              className="rounded-full h-8 px-4 text-xs font-semibold border-0"
              style={{ background: card.color }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Save to my context
            </Button>
            <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/35 leading-relaxed">
            Saved only in your browser session. Nothing leaves your device unless you submit it through a coaching workflow.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function FutureCardUI({ card, index }: { card: FutureCard; index: number }) {
  const Icon = card.icon;
  return (
    <motion.div {...fadeUp(0.06 + index * 0.04)} className="glass border border-white/5 rounded-2xl p-5 opacity-60">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 opacity-50"
          style={{ background: card.color.replace(")", " / 0.10)") }}>
          <Icon className="w-4 h-4" style={{ color: card.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-foreground/70">{card.title}</p>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/40">Coming soon</span>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-0.5 leading-relaxed">{card.desc}</p>
          <p className="text-[11px] text-muted-foreground/35 mt-1.5 leading-relaxed">
            <strong className="text-muted-foreground/45">Helps with:</strong> {card.what}
          </p>
          <p className="text-[11px] text-[hsl(43_65%_65%/0.7)] mt-2 leading-relaxed">{card.comingSoon}</p>
        </div>
      </div>
      <div className="mt-3">
        <SensitivityBadge level={card.sensitivity} />
      </div>
    </motion.div>
  );
}

export default function ConnectionCenter() {
  useMeta("Connection Center", "Bring in the context your coach needs — manually, on your terms, with full control over what gets shared.");
  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-10 opacity-20 pointer-events-none" />
        <div className="orb orb-teal   fixed w-[300px] h-[300px] bottom-10 -left-10 opacity-15 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Connection Center</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Bring in the context your coach needs — one piece at a time, on your terms. Everything is opt-in, preview-before-save, and you can remove it any time.
            </p>
          </motion.div>

          {/* Privacy promise */}
          <motion.div {...fadeUp(0.03)} className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/3 border border-white/6">
            <Shield className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground/70">Your data, your control</p>
              <p className="text-xs text-muted-foreground/45 leading-relaxed">
                Nothing here is shared, sold, or sent anywhere automatically. What you save powers your coaching session in this browser. You can clear it any time.
              </p>
            </div>
          </motion.div>

          {/* Manual imports */}
          <motion.div {...fadeUp(0.05)} className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Add now — manual import</p>
          </motion.div>
          <div className="space-y-3 mb-8">
            {IMPORT_CARDS.map((card, i) => <ImportCardUI key={card.id} card={card} index={i} />)}
          </div>

          {/* Future cards */}
          <motion.div {...fadeUp(0.25)} className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Future connections</p>
          </motion.div>
          <div className="space-y-3 mb-8">
            {FUTURE_CARDS.map((card, i) => <FutureCardUI key={card.id} card={card} index={i} />)}
          </div>

          {/* CTA */}
          <motion.div {...fadeUp(0.4)} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Link href="/vault"
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> View Data Vault →
            </Link>
            <span className="hidden sm:inline text-white/15">·</span>
            <Link href="/user-control"
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              Privacy & data settings →
            </Link>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
