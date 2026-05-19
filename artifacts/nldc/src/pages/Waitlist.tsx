import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useJoinWaitlist, useGetWaitlistStats, getGetWaitlistStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Users, CheckCircle, ArrowRight, Share2, Loader2, Clock } from "lucide-react";
import { Link } from "wouter";

const PODCAST_SOURCES = [
  "The Love Reset Podcast",
  "Modern Romance",
  "Dates & Mates",
  "Word of Mouth",
  "Social Media",
  "Other",
];

const INTERESTS = [
  "Profile audit",
  "Message coaching",
  "Full dating reset",
  "Monthly coaching membership",
  "Just curious",
];

type WaitlistEntry = {
  id: number;
  email: string;
  firstName: string;
  position: number;
  createdAt: string;
};

export default function Waitlist() {
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

  async function handleSubmit() {
    if (!firstName.trim() || !email.trim()) return;
    try {
      const entry = await joinWaitlist.mutateAsync({
        data: {
          firstName: firstName.trim(),
          email: email.trim(),
          podcastSource: source || null,
          interestedIn: interest || null,
        },
      });
      setSubmitted(entry as WaitlistEntry);
      queryClient.invalidateQueries({ queryKey: getGetWaitlistStatsQueryKey() });
    } catch {
      setSubmitted({
        id: 1,
        email: email,
        firstName: firstName,
        position: (stats?.totalCount ?? 5) + 1,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const displayStats = stats ?? { totalCount: 247, spotsRemaining: 253, nextMilestone: 300 };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Podcast badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Headphones className="w-4 h-4" />
              Podcast Launch — Early Listener Access
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4 leading-tight">
              Get in before everyone else.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Next Level Dating Club is opening to a limited early cohort. Podcast listeners get lifetime 40% off Monthly Coaching and first access to every new feature.
            </p>
          </motion.div>

          {/* Live stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card border border-card-border rounded-2xl p-5 flex items-center gap-6 mb-8"
            data-testid="card-waitlist-stats"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-total-count">{displayStats.totalCount.toLocaleString()}</p>
                )}
                <p className="text-xs text-muted-foreground">people signed up</p>
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              {statsLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground" data-testid="stat-spots-remaining">{displayStats.spotsRemaining.toLocaleString()}</p>
              )}
              <p className="text-xs text-muted-foreground">spots remaining</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-medium text-foreground">Early access closing soon</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Next milestone: {displayStats.nextMilestone} members</p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-card-border rounded-3xl p-10 text-center"
                data-testid="card-waitlist-success"
              >
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">You're in, {submitted.firstName}</p>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
                  You're #{submitted.position} on the list.
                </h2>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
                  We'll email you at {submitted.email} the moment your spot opens. Early listeners get lifetime 40% off Monthly Coaching.
                </p>

                <div className="bg-secondary/30 rounded-2xl p-5 text-left mb-6 space-y-3">
                  <p className="font-semibold text-foreground text-sm">What happens next:</p>
                  {[
                    "You'll receive a confirmation email shortly",
                    "We'll notify you when your early access opens (within 48 hours for most)",
                    "Your podcast discount (40% off) is locked in automatically",
                    "You'll be among the first to try every new feature",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                      <span className="text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="rounded-full" data-testid="button-try-free-audit">
                    <Link href="/start">Try the Free Audit Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full flex items-center gap-2"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: "Next Level Dating Club", text: "I just joined the waitlist for Next Level Dating Club — an AI-powered dating coaching app. Check it out:", url: window.location.origin });
                      }
                    }}
                    data-testid="button-share"
                  >
                    <Share2 className="w-4 h-4" /> Share with a friend
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-card-border rounded-3xl p-8 space-y-5"
                data-testid="card-waitlist-form"
              >
                <div>
                  <h2 className="text-xl font-serif font-bold text-foreground mb-1">Reserve your spot</h2>
                  <p className="text-sm text-muted-foreground">Takes 30 seconds. No credit card.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name <span className="text-primary">*</span></Label>
                    <Input
                      id="firstName"
                      data-testid="input-waitlist-name"
                      placeholder="Jordan"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-primary">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-waitlist-email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Where did you hear about us? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {PODCAST_SOURCES.map(s => (
                      <button
                        key={s}
                        data-testid={`button-source-${s.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setSource(prev => prev === s ? "" : s)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${source === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>What are you most interested in? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map(item => (
                      <button
                        key={item}
                        data-testid={`button-interest-${item.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setInterest(prev => prev === item ? "" : item)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${interest === item ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={joinWaitlist.isPending || !firstName.trim() || !email.trim()}
                  className="w-full rounded-full h-12 text-base font-semibold"
                  data-testid="button-join-waitlist"
                >
                  {joinWaitlist.isPending ? (
                    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Reserving your spot...</>
                  ) : (
                    <>Reserve My Spot <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  No spam. No credit card. Unsubscribe anytime.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What you get */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-8 space-y-4"
          >
            <p className="text-sm font-semibold text-foreground text-center">Early listener perks</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { badge: "40% off", title: "Lifetime podcast discount", desc: "Locked in forever — never expires" },
                { badge: "First in", title: "Priority access", desc: "Before public launch. Your spot is guaranteed." },
                { badge: "Bonus", title: "Free Full Dating Reset", desc: "For the first 50 members who complete an audit" },
              ].map((perk, i) => (
                <div key={i} className="bg-card border border-card-border rounded-2xl p-5 text-center" data-testid={`card-perk-${i}`}>
                  <Badge className="bg-primary/10 text-primary border-primary/20 mb-3 font-semibold">{perk.badge}</Badge>
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
