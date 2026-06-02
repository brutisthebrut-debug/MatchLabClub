import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Trash2, Calendar, MessageSquare, Sparkles, Eye, Star, Shield } from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useGetDatingWins,
  useCreateDatingWin,
  useDeleteDatingWin,
  getGetDatingWinsQueryKey,
  getGetMatchingStateQueryKey,
  type DatingWin,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type WinCategory = DatingWin["category"];

interface DisplayWin {
  id: number | string;
  category: WinCategory;
  text: string;
  date: string;
}

const CATEGORIES: { id: WinCategory; label: string; icon: React.ElementType; color: string; prompt: string }[] = [
  { id: "sent-it", label: "Sent It", icon: Sparkles, color: "hsl(var(--brand-gold))", prompt: "You hit send. What were you proud of?" },
  { id: "great-convo", label: "Great Convo", icon: MessageSquare, color: "hsl(var(--brand-indigo))", prompt: "What made the conversation different?" },
  { id: "got-a-date", label: "Got a Date", icon: Calendar, color: "hsl(var(--brand-green))", prompt: "What made it feel like a win?" },
  { id: "noticed-something", label: "Noticed a Pattern", icon: Eye, color: "hsl(190 55% 60%)", prompt: "What did you see about yourself or how you were showing up?" },
  { id: "personal-win", label: "Personal Win", icon: Star, color: "hsl(var(--brand-rose))", prompt: "What felt different about how you showed up today?" },
];

const DEMO_WINS: DisplayWin[] = [
  { id: "demo-1", category: "sent-it", text: "Sent a follow-up I'd been overthinking for 3 days. Kept it to one sentence. She replied in 20 minutes.", date: new Date(Date.now() - 2 * 864e5).toISOString() },
  { id: "demo-2", category: "noticed-something", text: "Realised I always wait for the other person to suggest meeting. Decided to just ask this time.", date: new Date(Date.now() - 5 * 864e5).toISOString() },
  { id: "demo-3", category: "great-convo", text: "Conversation went 45 minutes and felt like 10. We covered the same weird topic from completely different angles.", date: new Date(Date.now() - 8 * 864e5).toISOString() },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function DatingWinsLog() {
  useMeta("Dating Wins Log", "Log small wins, moments of courage, and patterns you notice, they compound more than you think.");

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<WinCategory>("sent-it");
  const [text, setText] = useState("");
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: winsData } = useGetDatingWins({
    query: { queryKey: getGetDatingWinsQueryKey(), enabled: isAuthenticated },
  });
  const createWin = useCreateDatingWin();
  const removeWin = useDeleteDatingWin();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  const wins: DisplayWin[] = (winsData ?? []).map((w) => ({
    id: w.id,
    category: w.category,
    text: w.body,
    date: w.createdAt,
  }));

  // Signed-out visitors and brand-new accounts see sample wins so the page is
  // never empty. The real log starts the moment a signed-in user adds one.
  const isDemo = !isAuthenticated || wins.length === 0;
  const isBrandNewUser = isAuthenticated && wins.length === 0;
  const displayed = isDemo ? DEMO_WINS : wins;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetDatingWinsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  };

  const addWin = () => {
    if (!text.trim() || !isAuthenticated) return;
    // Snapshot readiness before the win is recorded so the page can animate the
    // real climb this win produced.
    climb.snapshot();
    createWin.mutate(
      { data: { category, body: text.trim() } },
      {
        onSuccess: () => {
          setText("");
          setShowForm(false);
          invalidate();
        },
      },
    );
  };

  const deleteWin = (id: number | string) => {
    if (typeof id !== "number") return;
    removeWin.mutate({ id }, { onSuccess: invalidate });
  };

  const selectedCat = CATEGORIES.find(c => c.id === category)!;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-gold fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">

  {/* Hero */}
  <motion.div {...fadeUp(0)} className="mb-8">
  <div className="flex items-center gap-2.5 mb-3">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(43_65%_65%)] to-[hsl(348_55%_65%)] flex items-center justify-center shadow-[0_0_16px_hsl(43_65%_65%/0.4)]">
  <Trophy className="w-4 h-4 text-white" />
  </div>
  <p className="text-sm font-semibold text-[hsl(43_65%_75%)]">Growth Tracker</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground mb-2">Dating Wins Log</h1>
  <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
  Small wins compound. Log moments of courage, good conversations, things you noticed, anything that felt like forward movement.
  Saved to your account and counted as a real signal toward matching.
  </p>
  </motion.div>

  {isBrandNewUser && (
  <WelcomePanel
  icon={<Trophy className="w-6 h-6 text-primary" />}
  eyebrow="Welcome to Dating Wins Log"
  title="Log your first win"
  description="Small wins compound. Capture a moment of courage, a good conversation, or anything that felt like forward movement, and watch the pattern build."
  testId="wins-empty-state"
  />
  )}

  {/* Add Win */}
  <motion.div {...fadeUp(0.06)} className="mb-6">
  <AnimatePresence mode="wait">
  {!showForm ? (
  <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
  <Button
  onClick={() => setShowForm(true)}
  className="rounded-xl bg-gradient-to-r from-[hsl(43_65%_60%)] to-[hsl(348_55%_60%)] text-foreground border-0 font-semibold hover:opacity-90"
  >
  <Plus className="w-4 h-4 mr-2" />
  Log a win
  </Button>
  </motion.div>
  ) : (
  <motion.div
  key="form"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  className="glass border border-white/10 rounded-2xl p-5 space-y-4"
  >
  <p className="font-semibold text-foreground text-sm">What kind of win?</p>
  <div className="flex flex-wrap gap-2">
  {CATEGORIES.map(cat => {
  const Icon = cat.icon;
  const active = category === cat.id;
  return (
  <button
  key={cat.id}
  onClick={() => setCategory(cat.id)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
  style={active
  ? { background: withAlpha(cat.color, 0.18), borderColor: withAlpha(cat.color, 0.45), color: cat.color }
  : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
  }
  >
  <Icon className="w-3 h-3" />
  {cat.label}
  </button>
  );
  })}
  </div>
  <Textarea
  value={text}
  onChange={e => setText(e.target.value)}
  placeholder={selectedCat.prompt}
  className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[90px]"
  maxLength={500}
  />
  <div className="flex gap-2">
  <Button
  onClick={addWin}
  disabled={!text.trim() || !isAuthenticated || createWin.isPending}
  size="sm"
  className="rounded-lg bg-[hsl(43_65%_60%)] text-foreground hover:opacity-90 border-0"
  >
  {createWin.isPending ? "Saving..." : "Save win"}
  </Button>
  <Button
  onClick={() => { setShowForm(false); setText(""); }}
  variant="ghost" size="sm"
  className="rounded-lg text-muted-foreground"
  >
  Cancel
  </Button>
  </div>
  {!isAuthenticated && (
  <p className="text-xs text-muted-foreground/50">Sign in to save wins to your account and count them toward matching.</p>
  )}
  </motion.div>
  )}
  </AnimatePresence>
  </motion.div>

  {isAuthenticated && climb.before !== null && (
  <motion.div {...fadeUp(0.07)} className="mb-6">
  <ReadinessClimbReveal
  from={climb.before}
  to={climb.current}
  className="glass border border-white/8 rounded-2xl p-5"
  />
  </motion.div>
  )}

  {/* Demo label */}
  {isDemo && displayed.length > 0 && (
  <motion.p {...fadeUp(0.08)} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-3 px-0.5">
  Sample wins, your log starts the moment you add one
  </motion.p>
  )}

  {/* Wins list */}
  <div className="space-y-3">
  <AnimatePresence>
  {displayed.map((win, i) => {
  const cat = CATEGORIES.find(c => c.id === win.category)!;
  const Icon = cat.icon;
  const dateStr = new Date(win.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
  <motion.div
  key={win.id}
  {...fadeUp(0.08 + i * 0.04)}
  layout
  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
  className="glass border border-white/8 rounded-2xl p-4 flex items-start gap-3"
  >
  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
  style={{ background: withAlpha(cat.color, 0.12) }}>
  <Icon className="w-4 h-4" style={{ color: cat.color }} />
  </div>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
  <span className="text-[10px] text-muted-foreground/40">{dateStr}</span>
  </div>
  <p className="text-sm text-muted-foreground leading-relaxed">{win.text}</p>
  </div>
  {!isDemo && (
  <button
  onClick={() => deleteWin(win.id)}
  className="text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors flex-shrink-0 p-1"
  aria-label="Delete win"
  >
  <Trash2 className="w-3.5 h-3.5" />
  </button>
  )}
  </motion.div>
  );
  })}
  </AnimatePresence>
  </div>

  {/* Empty state */}
  {!isDemo && displayed.length === 0 && !showForm && (
  <motion.div {...fadeUp(0.1)} className="text-center py-16">
  <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
  <p className="font-semibold text-foreground mb-1">Your wins log is empty</p>
  <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
  Start small. A win can be sending a message you would have normally deleted.
  </p>
  <Button onClick={() => setShowForm(true)} size="sm" className="rounded-xl bg-[hsl(43_65%_60%)] text-foreground border-0">
  Log your first win
  </Button>
  </motion.div>
  )}

  {/* Trust note */}
  <motion.div {...fadeUp(0.45)} className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
  <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground/45 leading-relaxed">
  <strong className="text-muted-foreground/60">Private to your account.</strong>{" "}
  Your wins count toward matching readiness and are never shared with anyone. You can delete any entry, or wipe everything from your account, at any time.
  </p>
  </motion.div>

  </div>
  </div>
  </AppLayout>
  );
}