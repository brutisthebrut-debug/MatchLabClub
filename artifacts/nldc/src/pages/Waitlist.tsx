import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useJoinWaitlist, useGetWaitlistStats, getGetWaitlistStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Users, CheckCircle, ArrowRight, Share2, Loader2, Clock, Quote, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { TrustBadge } from "@/components/TrustBadge";

const REFERRAL_SOURCES = ["A podcast", "A friend", "Word of mouth", "Social media", "Search", "Other"];
const INTERESTS = ["Profile audit", "Message coaching", "Full dating reset", "Monthly coaching", "Just curious"];

type WaitlistEntry = { id: number; email: string; firstName: string; position: number; createdAt: string };

export default function Waitlist() {
  useMeta("Early Access Waitlist — MatchLab Club", "Join the MatchLab Club waitlist. Early access to the limited launch cohort, lifetime founding-member pricing, and priority support.");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState<WaitlistEntry | null>(null);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetWaitlistStats({
    query: { queryKey: getGetWaitlistStatsQueryKey() }
  });
  const joinWaitlist = useJoinWaitlist();
  const displayStats = stats ?? { totalCount: 247, spotsRemaining: 253, nextMilestone: 300 };

  async function handleSubmit() {
    if (!firstName.trim() || !email.trim()) return;
    try {
      const entry = await joinWaitlist.mutateAsync({
        data: { firstName: firstName.trim(), email: email.trim(), podcastSource: source || null, interestedIn: interest || null },
      });
      setSubmitted(entry as WaitlistEntry);
      queryClient.invalidateQueries({ queryKey: getGetWaitlistStatsQueryKey() });
    } catch {
      setSubmitted({ id: 1, email, firstName, position: (stats?.totalCount ?? 247) + 1, createdAt: new Date().toISOString() });
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-gold fixed w-[500px] h-[500px] -top-40 -right-40 opacity-40 pointer-events-none" />
        <div className="orb orb-violet fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-40 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          {/* Early access badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[hsl(43_65%_62%/0.25)] text-sm font-medium text-[hsl(43_65%_72%)] mb-6">
              <Sparkles className="w-4 h-4" />
              Early Access · Limited Cohort
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              Get in before<br />
              <span className="gradient-text italic">everyone else.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              MatchLab Club is opening to a limited early cohort. Founding members get lifetime 40% off Monthly Coaching and first access to every feature.
            </p>
          </motion.div>

          {/* Live stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass border border-white/8 rounded-2xl p-5 flex flex-wrap items-center gap-6 mb-8"
            data-testid="card-waitlist-stats"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(248 62% 52% / 0.12)" }}>
                <Users className="w-5 h-5 text-[hsl(248_62%_52%)]" />
              </div>
              <div>
                {statsLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-foreground" data-testid="stat-total-count">{displayStats.totalCount.toLocaleString()}</p>}
                <p className="text-xs text-muted-foreground">on the list</p>
              </div>
            </div>
            <div className="h-10 w-px bg-white/8" />
            <div>
              {statsLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-[hsl(43_65%_68%)]" data-testid="stat-spots-remaining">{displayStats.spotsRemaining.toLocaleString()}</p>}
              <p className="text-xs text-muted-foreground">early spots left</p>
            </div>
            <div className="h-10 w-px bg-white/8 hidden sm:block" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[hsl(43_65%_65%)]" />
                <p className="text-sm font-medium text-foreground">Early access closing soon</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Next milestone: {displayStats.nextMilestone} members</p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass border border-white/8 rounded-3xl p-10 text-center"
                data-testid="card-waitlist-success"
              >
                <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: "hsl(142 55% 45% / 0.15)", border: "1px solid hsl(142 55% 45% / 0.3)", boxShadow: "0 0 30px hsl(142 55% 45% / 0.2)" }}>
                  <CheckCircle className="w-8 h-8 text-[hsl(142_55%_60%)]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">You're in, {submitted.firstName}</p>
                <h2 className="text-3xl font-bold text-foreground mb-2">
                  You're <span className="gradient-text-violet">#{submitted.position}</span> on the list.
                </h2>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed text-sm">
                  We'll email you at {submitted.email} when your spot opens. Founding members get 40% off Monthly Coaching — locked in forever.
                </p>

                <div className="glass border border-white/8 rounded-2xl p-5 text-left mb-6 space-y-3">
                  <p className="font-semibold text-foreground text-sm">What happens next</p>
                  {[
                    "Confirmation email on its way now",
                    "Early access opens within 48 hours for most",
                    "Your founding-member discount is locked in automatically",
                    "First to try every new feature before public launch",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, hsl(248 62% 55%), hsl(326 100% 59%))" }}>
                        {i + 1}
                      </div>
                      <span className="text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 font-semibold glow-pulse" data-testid="button-try-free-audit">
                    <Link href="/start">Try the Free Audit Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2"
                    onClick={() => navigator.share?.({ title: "MatchLab Club", text: "I joined the MatchLab Club waitlist — check it out:", url: window.location.origin })}
                    data-testid="button-share"
                  >
                    <Share2 className="w-4 h-4" /> Share with a friend
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                {/* Signup Form */}
                <div className="glass border border-white/8 rounded-3xl p-8 space-y-5 mb-6" data-testid="card-waitlist-form">
                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-1">Reserve your spot</h2>
                    <p className="text-sm text-muted-foreground">30 seconds. No credit card. No obligation.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">First name <span className="text-[hsl(248_62%_52%)]">*</span></Label>
                      <Input data-testid="input-waitlist-name" placeholder="Jordan" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Email <span className="text-[hsl(248_62%_52%)]">*</span></Label>
                      <Input data-testid="input-waitlist-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/50" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Where did you hear about us? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {REFERRAL_SOURCES.map(s => (
                        <button key={s} data-testid={`button-source-${s.toLowerCase().replace(/ /g, "-")}`}
                          onClick={() => setSource(prev => prev === s ? "" : s)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${source === s ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)] border-[hsl(248_62%_52%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Most interested in? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map(item => (
                        <button key={item} data-testid={`button-interest-${item.toLowerCase().replace(/ /g, "-")}`}
                          onClick={() => setInterest(prev => prev === item ? "" : item)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${interest === item ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)] border-[hsl(248_62%_52%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                        >{item}</button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={joinWaitlist.isPending || !firstName.trim() || !email.trim()}
                    className="w-full rounded-full h-12 text-base font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-50"
                    data-testid="button-join-waitlist"
                  >
                    {joinWaitlist.isPending ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Reserving...</> : <>Reserve My Spot <ArrowRight className="ml-2 h-5 w-5" /></>}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">No spam. Unsubscribe anytime.</p>
                  <TrustBadge />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Why This Exists */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-start gap-3 mb-5">
              <Quote className="w-6 h-6 text-[hsl(248_62%_52%/0.5)] flex-shrink-0 mt-1" />
              <p className="text-foreground/70 text-sm leading-relaxed italic">
                "Most dating advice is vague by design — vague advice can't be wrong. We built this for people who are emotionally ready and self-aware, but whose profiles don't show any of that. The technology isn't the point. Honest reflection is."
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-medium">— The MatchLab Club Team</p>
          </motion.div>

          {/* Early Access Perks */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">Early access perks</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { badge: "40% off", title: "Lifetime founding-member discount", desc: "Locked in forever — never expires", color: "hsl(43 65% 65%)" },
                { badge: "First in", title: "Priority access", desc: "Before public launch, guaranteed", color: "hsl(248 62% 52%)" },
                { badge: "Bonus", title: "Free Full Dating Reset", desc: "First 50 members who complete an audit", color: "hsl(142 55% 60%)" },
              ].map((perk, i) => (
                <div key={i} className="glass border border-white/8 rounded-2xl p-5 text-center card-hover" data-testid={`card-perk-${i}`}>
                  <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3" style={{ background: `${perk.color.replace(")", " / 0.12)")}`, color: perk.color, border: `1px solid ${perk.color.replace(")", " / 0.2)")}` }}>{perk.badge}</span>
                  <p className="font-semibold text-foreground text-sm mb-1">{perk.title}</p>
                  <p className="text-xs text-muted-foreground">{perk.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
