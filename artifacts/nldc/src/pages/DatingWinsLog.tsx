import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Trash2, Calendar, MessageSquare, Sparkles, Eye, Star, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type WinCategory = "got-a-date" | "great-convo" | "sent-it" | "noticed-something" | "personal-win";

interface Win {
  id: string;
  category: WinCategory;
  text: string;
  date: string;
}

const CATEGORIES: { id: WinCategory; label: string; icon: React.ElementType; color: string; prompt: string }[] = [
  { id: "sent-it",           label: "Sent It",            icon: Sparkles,       color: "hsl(43 65% 65%)",  prompt: "You hit send. What were you proud of?" },
  { id: "great-convo",       label: "Great Convo",        icon: MessageSquare,  color: "hsl(268 52% 68%)", prompt: "What made the conversation different?" },
  { id: "got-a-date",        label: "Got a Date",         icon: Calendar,       color: "hsl(142 55% 60%)", prompt: "What made it feel like a win?" },
  { id: "noticed-something", label: "Noticed a Pattern",  icon: Eye,            color: "hsl(190 55% 60%)", prompt: "What did you see about yourself or how you were showing up?" },
  { id: "personal-win",      label: "Personal Win",       icon: Star,           color: "hsl(348 55% 65%)", prompt: "What felt different about how you showed up today?" },
];

const STORAGE_KEY = "nldc_dating_wins";

function loadWins(): Win[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Win[]) : [];
  } catch { return []; }
}

function saveWins(wins: Win[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wins)); } catch {}
}

const DEMO_WINS: Win[] = [
  { id: "demo-1", category: "sent-it",           text: "Sent a follow-up I'd been overthinking for 3 days. Kept it to one sentence. She replied in 20 minutes.", date: new Date(Date.now() - 2 * 864e5).toISOString() },
  { id: "demo-2", category: "noticed-something", text: "Realised I always wait for the other person to suggest meeting. Decided to just ask this time.", date: new Date(Date.now() - 5 * 864e5).toISOString() },
  { id: "demo-3", category: "great-convo",       text: "Conversation went 45 minutes and felt like 10. We covered the same weird topic from completely different angles.", date: new Date(Date.now() - 8 * 864e5).toISOString() },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function DatingWinsLog() {
  useMeta("Dating Wins Log", "Log small wins, moments of courage, and patterns you notice — they compound more than you think.");

  const [wins, setWins] = useState<Win[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<WinCategory>("sent-it");
  const [text, setText] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && isDemo;

  useEffect(() => {
    const stored = loadWins();
    if (stored.length > 0) { setWins(stored); } else { setIsDemo(true); }
  }, []);

  const displayed = isDemo ? DEMO_WINS : wins;

  const addWin = () => {
    if (!text.trim()) return;
    const newWin: Win = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      category,
      text: text.trim(),
      date: new Date().toISOString(),
    };
    const updated = [newWin, ...wins];
    setWins(updated);
    saveWins(updated);
    setIsDemo(false);
    setText("");
    setShowForm(false);
  };

  const deleteWin = (id: string) => {
    const updated = wins.filter(w => w.id !== id);
    setWins(updated);
    saveWins(updated);
    if (updated.length === 0) setIsDemo(true);
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
              Small wins compound. Log moments of courage, good conversations, things you noticed — anything that felt like forward movement.
              Stored locally in your browser. Private to you.
            </p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div {...fadeUp(0.03)} className="mb-6" data-testid="wins-empty-state">
              <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Welcome to Dating Wins Log</p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-2">Log your first win</h2>
                <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                  Small wins compound. Capture a moment of courage, a good conversation, or anything that felt like forward movement — and watch the pattern build.
                </p>
              </div>
            </motion.div>
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
                            ? { background: cat.color.replace(")", " / 0.18)"), borderColor: cat.color.replace(")", " / 0.45)"), color: cat.color }
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
                      disabled={!text.trim()}
                      size="sm"
                      className="rounded-lg bg-[hsl(43_65%_60%)] text-foreground hover:opacity-90 border-0"
                    >
                      Save win
                    </Button>
                    <Button
                      onClick={() => { setShowForm(false); setText(""); }}
                      variant="ghost" size="sm"
                      className="rounded-lg text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Demo label */}
          {isDemo && displayed.length > 0 && (
            <motion.p {...fadeUp(0.08)} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-3 px-0.5">
              Sample wins — your log starts the moment you add one
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
                      style={{ background: cat.color.replace(")", " / 0.12)") }}>
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
              <strong className="text-muted-foreground/60">Stored locally in your browser.</strong>{" "}
              Nothing here is synced, shared, or sent anywhere. It's a private note to yourself — you control it and can clear it any time.
            </p>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
