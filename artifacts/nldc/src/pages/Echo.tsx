import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { SignalOfTheDay } from "@/components/SignalOfTheDay";
import { WellnessInferences } from "@/components/WellnessInferences";
import {
  useGetCompanion,
  getGetCompanionQueryKey,
  useGetMatchingState,
  useSayToCompanion,
  useListCompanionNotifications,
  getListCompanionNotificationsQueryKey,
  useMarkCompanionNotificationsRead,
  useUpdateCompanionSettings,
  useCompleteCompanionCommitment,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { CompanionPersona } from "@workspace/api-client-react";
import type { CompanionPersona as Persona } from "@workspace/api-client-react";
import { ArrowRight, Bell, Check, Send, Sparkles, Target } from "lucide-react";

type EchoTurn = {
  role: "you" | "echo";
  text: string;
  followUp?: string;
};

const PERSONA_LABELS: Record<Persona, string> = {
  best_friend: "Honest best friend",
  tough_coach: "Tough coach",
  witty_sibling: "Witty sibling",
  calm_mentor: "Calm mentor",
};

const CANDOR_LABELS = ["Gentle", "Honest", "Blunt"];

function SignInGate({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="mesh-bg min-h-screen px-4 py-16 sm:px-6">
      <section className="glass-strong mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[2rem] p-8 text-center sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Meet Echo</h1>
        <p className="text-muted-foreground">
          Echo is your honest companion across MatchLab. It remembers what you
          choose to share, makes grounded observations, and holds you to what
          you say you will do. It says what it knows, what it does not, and
          challenges you without being cruel. Sign in to meet yours.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Sign in
        </button>
      </section>
    </div>
  );
}

export default function Echo() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const qc = useQueryClient();

  const companion = useGetCompanion({
    query: {
      queryKey: getGetCompanionQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const matching = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const { data: feed } = useListCompanionNotifications({
    query: {
      queryKey: getListCompanionNotificationsQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const say = useSayToCompanion();
  const markRead = useMarkCompanionNotificationsRead();
  const updateSettings = useUpdateCompanionSettings();
  const completeCommitment = useCompleteCompanionCommitment();

  const [turns, setTurns] = useState<EchoTurn[]>([]);
  const [draft, setDraft] = useState("");

  if (!isAuthenticated && !isLoading)
    return (
      <AppLayout>
        <SignInGate onSignIn={login} />
      </AppLayout>
    );
  const data = companion.data;
  const matchingState = matching.data;

  if (isAuthenticated && (companion.isLoading || matching.isLoading)) {
    return (
      <AppLayout>
        <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
          <div className="glass-strong mx-auto max-w-5xl animate-pulse rounded-[2rem] p-8">
            <div className="h-4 w-32 rounded bg-foreground/10" />
            <div className="mt-5 h-9 w-3/4 rounded bg-foreground/10" />
            <div className="mt-3 h-4 w-full rounded bg-foreground/10" />
          </div>
        </div>
      </AppLayout>
    );
  }
  if (
    isAuthenticated &&
    (companion.isError || matching.isError || !data || !matchingState)
  ) {
    return (
      <AppLayout>
        <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
          <section className="glass-strong mx-auto max-w-3xl rounded-[2rem] p-8 text-center">
            <p className="font-semibold text-foreground">
              Echo could not load your conversation.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Refresh in a moment. No sample response is standing in for your
              account.
            </p>
          </section>
        </div>
      </AppLayout>
    );
  }
  if (!data || !matchingState) return null;

  function refresh(): void {
    qc.invalidateQueries({ queryKey: getGetCompanionQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  }

  async function send(message: string): Promise<void> {
    const m = message.trim();
    if (!m || say.isPending) return;
    setTurns((t) => [...t, { role: "you", text: m }]);
    setDraft("");
    try {
      const res = await say.mutateAsync({ data: { message: m } });
      setTurns((t) => [
        ...t,
        { role: "echo", text: res.answer, followUp: res.followUp },
      ]);
      refresh();
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "echo",
          text: "I could not reach my deeper read just now. Try me again in a moment.",
        },
      ]);
    }
  }

  async function saveSettings(
    patch: Partial<{
      persona: Persona;
      candor: number;
      inApp: boolean;
      email: boolean;
      sms: boolean;
      phone: string | null;
    }>,
  ): Promise<void> {
    await updateSettings.mutateAsync({ data: patch });
    qc.invalidateQueries({ queryKey: getGetCompanionQueryKey() });
  }

  const settings = data.settings;
  const searchActive = ["building", "ready", "concierge_only"].includes(
    matchingState.poolStatus ?? "off",
  );
  const searchLabel = searchActive
    ? "Search active"
    : matchingState.poolStatus === "paused"
      ? "Search paused"
      : "Search not started";
  const nearbyMembers = Math.max(0, matchingState.cityDensity ?? 0);
  const marketLabel =
    nearbyMembers > 0
      ? `${nearbyMembers} nearby ${nearbyMembers === 1 ? "member" : "members"}`
      : "Nearby pool still building";

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen overflow-hidden px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <header className="mb-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground backdrop-blur-sm">
              <Sparkles
                className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
                aria-hidden="true"
              />
              Talk with {data.personaLabel}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Echo, with the whole journey in view.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              One companion who travels every page with you, learns from what
              you choose to share, and stays honest about what it knows.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              {/* Echo's current read */}
              <section className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
                <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-gradient-to-br from-[#3D35CC]/15 to-[#FF2D9B]/15 blur-3xl" />
                <div className="relative">
                  <p className="text-sm font-semibold text-[hsl(326_100%_45%)]">
                    {data.greeting}
                  </p>
                  <p className="mt-3 font-serif text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                    {data.read}
                  </p>
                  {data.challenge && (
                    <p className="mt-3 rounded-xl border border-[hsl(326_100%_60%/0.25)] bg-[hsl(326_100%_60%/0.05)] p-3 text-sm font-medium text-foreground">
                      {data.challenge}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5">
                      {matchingState.eligible
                        ? "Profile ready for review"
                        : "Profile evidence still building"}
                    </span>
                    <span className="rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5">
                      {searchLabel}
                    </span>
                    <span className="rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5">
                      {marketLabel}
                    </span>
                  </div>
                  {data.nextMove && (
                    <Link
                      href={data.nextMove.href}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[hsl(326_100%_60%/0.3)] bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground hover:bg-foreground/[0.03]"
                      data-testid="echo-next-move"
                    >
                      <Sparkles
                        className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
                        aria-hidden="true"
                      />
                      {data.nextMove.label}
                    </Link>
                  )}
                </div>
              </section>

              {/* Conversation */}
              <section className="glass-strong rounded-[2rem] p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-foreground">
                  Talk to Echo
                </h2>
                <div className="mt-3 space-y-3">
                  {turns.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Tell Echo what is going on. It answers from what it
                      actually knows about you and says when its confidence is
                      low.
                    </p>
                  )}
                  {turns.map((t, i) => (
                    <div
                      key={i}
                      className={t.role === "you" ? "text-right" : "text-left"}
                    >
                      <div
                        className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                          t.role === "you"
                            ? "bg-foreground text-background"
                            : "border border-foreground/10 bg-foreground/[0.03] text-foreground"
                        }`}
                      >
                        {t.text}
                        {t.followUp && (
                          <button
                            type="button"
                            onClick={() => send(t.followUp as string)}
                            className="mt-2 block text-left text-[12px] font-medium text-[hsl(326_100%_45%)] underline-offset-2 hover:underline"
                          >
                            {t.followUp}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(draft);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Tell Echo what is going on"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm focus:border-foreground/40 focus:outline-none"
                    data-testid="echo-page-input"
                  />
                  <button
                    type="button"
                    onClick={() => send(draft)}
                    disabled={say.isPending || !draft.trim()}
                    className="shrink-0 rounded-xl bg-foreground p-3 text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    aria-label="Send to Echo"
                    data-testid="echo-page-send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <SignalOfTheDay />

              <WellnessInferences />

              {/* Notification history */}
              <section className="glass rounded-2xl border border-foreground/10 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    What Echo has reached out about
                  </h2>
                  {(feed?.unreadCount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await markRead.mutateAsync({ data: {} });
                        qc.invalidateQueries({
                          queryKey: getListCompanionNotificationsQueryKey(),
                        });
                        qc.invalidateQueries({
                          queryKey: getGetCompanionQueryKey(),
                        });
                      }}
                      className="text-xs font-medium text-[hsl(326_100%_45%)] hover:underline"
                      data-testid="echo-mark-all-read"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {(feed?.notifications.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing yet. Echo will reach out when something is worth
                      saying.
                    </p>
                  )}
                  {feed?.notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border p-3 ${
                        n.read
                          ? "border-foreground/10 bg-transparent"
                          : "border-[hsl(326_100%_60%/0.25)] bg-[hsl(326_100%_60%/0.04)]"
                      }`}
                      data-testid={`echo-notification-${n.id}`}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {n.body}
                      </p>
                      {n.ctaHref && n.ctaLabel && (
                        <Link
                          href={n.ctaHref}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[hsl(326_100%_45%)] hover:underline"
                        >
                          {n.ctaLabel}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right rail: commitments + settings */}
            <div className="space-y-6">
              <section className="glass rounded-2xl border border-foreground/10 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Echo is holding you to
                </h2>
                <div className="mt-3 space-y-2">
                  {data.commitments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No open commitments. When you tell Echo you will do
                      something, it writes it down and checks in.
                    </p>
                  )}
                  {data.commitments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2 rounded-xl border border-foreground/10 p-3"
                      data-testid={`echo-page-commitment-${c.id}`}
                    >
                      <p className="min-w-0 flex-1 text-sm text-foreground">
                        {c.body}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await completeCommitment.mutateAsync({ id: c.id });
                          refresh();
                        }}
                        className="shrink-0 rounded-lg border border-foreground/15 p-1.5 text-muted-foreground hover:text-foreground"
                        aria-label="Mark done"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass rounded-2xl border border-foreground/10 p-5">
                <h2 className="text-sm font-semibold text-foreground">
                  How Echo talks to you
                </h2>

                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Persona
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(Object.keys(PERSONA_LABELS) as Persona[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          saveSettings({ persona: CompanionPersona[p] })
                        }
                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                          settings.persona === p
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/15 text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`echo-persona-${p}`}
                      >
                        {PERSONA_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Candor: {CANDOR_LABELS[settings.candor - 1]}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => saveSettings({ candor: c })}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                          settings.candor === c
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/15 text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`echo-candor-${c}`}
                      >
                        {CANDOR_LABELS[c - 1]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t border-foreground/8 pt-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Where Echo can reach you
                  </p>
                  {(
                    [
                      ["inApp", "In-app notifications"],
                      ["email", "Email"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between text-sm text-foreground"
                    >
                      {label}
                      <input
                        type="checkbox"
                        checked={settings[key]}
                        onChange={(e) =>
                          saveSettings({ [key]: e.target.checked })
                        }
                        className="h-4 w-4 accent-[hsl(326_100%_50%)]"
                        data-testid={`echo-channel-${key}`}
                      />
                    </label>
                  ))}

                  <div>
                    <label className="flex items-center justify-between text-sm text-foreground">
                      SMS
                      <input
                        type="checkbox"
                        checked={settings.sms}
                        onChange={(e) =>
                          saveSettings({ sms: e.target.checked })
                        }
                        className="h-4 w-4 accent-[hsl(326_100%_50%)]"
                        data-testid="echo-channel-sms"
                      />
                    </label>
                    <input
                      type="tel"
                      defaultValue={settings.phone ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (settings.phone ?? "")) {
                          saveSettings({ phone: v || null });
                        }
                      }}
                      placeholder="Phone number for SMS"
                      className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                      data-testid="echo-phone-input"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Add a number before turning SMS on. Echo only texts about
                      things you asked it to watch.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
