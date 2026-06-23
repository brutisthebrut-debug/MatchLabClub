import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useMeta } from "@/hooks/useMeta";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@workspace/replit-auth-web";
import { useRehearsalTurn } from "@workspace/api-client-react";
import type { RehearsalTurn } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToolHandoff } from "@/components/ToolHandoff";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartHandshake,
  Sparkles,
  Shield,
  Wrench,
  Hand,
  DoorOpen,
  Send,
  Loader2,
  ArrowLeft,
  Lightbulb,
  Theater,
} from "lucide-react";

type ScenarioDef = {
  id: string;
  label: string;
  blurb: string;
  icon: typeof HeartHandshake;
};

const SCENARIOS: ScenarioDef[] = [
  {
    id: "define_the_relationship",
    label: "Define the relationship",
    blurb: "The 'what are we' talk, without the spiral.",
    icon: HeartHandshake,
  },
  {
    id: "first_vulnerable",
    label: "Say something real",
    blurb: "Open up about something that actually scares you.",
    icon: Sparkles,
  },
  {
    id: "set_a_boundary",
    label: "Set a boundary",
    blurb: "Name what you need to feel safe, kindly.",
    icon: Shield,
  },
  {
    id: "repair_after_misstep",
    label: "Repair after a misstep",
    blurb: "Apologize cleanly and rebuild a little trust.",
    icon: Wrench,
  },
  {
    id: "express_a_need",
    label: "Ask for what you need",
    blurb: "Ask directly, without hinting or hoping.",
    icon: Hand,
  },
  {
    id: "end_it_kindly",
    label: "End it kindly",
    blurb: "Close it with honesty and grace.",
    icon: DoorOpen,
  },
];

type CoachMeta = { note: string; tone: string; isFallback: boolean };

export default function RehearsalRoom() {
  useMeta(
    "Rehearsal Room",
    "Practice the conversations that actually decide a relationship. The define-the-relationship talk, the first vulnerable thing, a boundary, a repair. The other person is played back to you so you can rehearse before you live it.",
  );

  const { isAuthenticated } = useAuth();
  const turn = useRehearsalTurn();
  const pending = turn.isPending;

  const [scenario, setScenario] = useState<string | null>(null);
  const [theirStyle, setTheirStyle] = useState("");
  const [transcript, setTranscript] = useState<RehearsalTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [coach, setCoach] = useState<CoachMeta | null>(null);
  const [started, setStarted] = useState(false);

  const selected = SCENARIOS.find((s) => s.id === scenario) ?? null;

  function begin(id: string) {
    setScenario(id);
    setTranscript([]);
    setCoach(null);
    setStarted(true);
    setDraft("");
    trackEvent("rehearsal_started", { scenario: id });
    turn.mutate(
      { data: { scenario: id, theirStyle: theirStyle.trim() || null, transcript: [] } },
      {
        onSuccess: (data) => {
          setTranscript([{ role: "them", text: data.reply }]);
          setCoach({ note: data.note, tone: data.tone, isFallback: data.isFallback });
        },
      },
    );
  }

  function send() {
    const text = draft.trim();
    if (!text || !scenario || pending) return;
    const next: RehearsalTurn[] = [...transcript, { role: "you", text }];
    setTranscript(next);
    setDraft("");
    turn.mutate(
      { data: { scenario, theirStyle: theirStyle.trim() || null, transcript: next } },
      {
        onSuccess: (data) => {
          setTranscript((cur) => [...cur, { role: "them", text: data.reply }]);
          setCoach({ note: data.note, tone: data.tone, isFallback: data.isFallback });
        },
      },
    );
  }

  function restart() {
    setStarted(false);
    setScenario(null);
    setTranscript([]);
    setCoach(null);
    setDraft("");
  }

  return (
    <AppLayout>
      <HubTabs hub="messages" />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Theater className="h-3.5 w-3.5" />
            Rehearsal Room
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Practice the conversation before you live it
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Relationships do not break at the opener. They break at the talks nobody rehearses:
            the "what are we", the first vulnerable thing, the boundary, the repair. Pick one
            below and the other person gets played back to you, so you can practice the hard
            moment with someone who reacts like a real human, and a coach in your ear.
          </p>
        </div>

        {!started && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => begin(s.id)}
                    disabled={pending}
                    className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-60"
                  >
                    <span className="mt-0.5 rounded-lg border bg-background p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-medium">{s.label}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {s.blurb}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <Label htmlFor="their-style" className="text-sm font-medium">
                How does this person communicate? (optional)
              </Label>
              <p className="mb-2 mt-1 text-sm text-muted-foreground">
                A few words, or paste how they text. The more the room knows, the more the other
                person sounds like them.
              </p>
              <Textarea
                id="their-style"
                value={theirStyle}
                onChange={(e) => setTheirStyle(e.target.value)}
                placeholder="Warm but avoids conflict. Goes quiet when things get serious. Texts in short bursts."
                rows={3}
              />
            </div>

            {!isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                You can rehearse right now with the always-on coach. Sign in and turn on the
                Deep AI lane to have the other person played fully in character.
              </p>
            )}
          </div>
        )}

        {started && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selected ? <selected.icon className="h-4 w-4 text-primary" /> : null}
                <span className="font-medium">{selected?.label ?? "Rehearsal"}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={restart} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Switch scenario
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border bg-card p-4">
              <AnimatePresence initial={false}>
                {transcript.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={t.role === "you" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        t.role === "you"
                          ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                          : "max-w-[80%] rounded-2xl rounded-bl-sm border bg-background px-4 py-2.5 text-sm"
                      }
                    >
                      {t.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {pending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-background px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    thinking
                  </div>
                </div>
              )}
            </div>

            {coach && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
                  <Lightbulb className="h-4 w-4" />
                  Coach
                </div>
                <p className="text-sm">{coach.note}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-0.5">Their read: {coach.tone}</span>
                  <span className="rounded-full border px-2 py-0.5">
                    {coach.isFallback ? "Always-on baseline coach" : "Deep AI lane"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type what you would actually say..."
                rows={2}
                className="flex-1 resize-none"
              />
              <Button onClick={send} disabled={pending || !draft.trim()} className="gap-1.5">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Say it
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a rehearsal. Nothing here is saved. The other person is a practice partner,
              not a real read on anyone in your life.
            </p>

            <ToolHandoff
              testId="rehearsal-handoff"
              fedLine="Rehearsal stays private and is never saved. When you are ready for the real conversation, here is where to take it."
              steps={[
                { label: "Coach a real message", href: "/coach", desc: "Turn the practice into a reply that sounds like you." },
                { label: "Read your patterns", href: "/insights", desc: "See the communication style underneath your replies." },
                { label: "Check your readiness", href: "/me", desc: "Watch your Match Readiness climb." },
              ]}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
