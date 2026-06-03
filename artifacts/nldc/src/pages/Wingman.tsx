import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import {
  Users,
  Shield,
  Check,
  Copy,
  Send,
  Clock,
  Scale,
} from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetWingmanState,
  useSetWingmanSelfRating,
  useCreateWingmanInvite,
  getGetWingmanStateQueryKey,
  getGetMatchingStateQueryKey,
  type WingmanState as WingmanStateDto,
  type WingmanRatings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const TRAITS = [
  { key: "warmth", label: "Warm and supportive" },
  { key: "humor", label: "Funny and fun to be around" },
  { key: "drive", label: "Driven and ambitious" },
  { key: "openness", label: "Open and adventurous" },
  { key: "steadiness", label: "Steady and dependable" },
] as const;

type TraitKey = (typeof TRAITS)[number]["key"];

// A pre-filled board so a signed-out visitor sees a real, played example
// instead of an empty one. The demo never writes to the server.
const DEMO_STATE: WingmanStateDto = {
  perspectives: 3,
  selfRatings: { warmth: 4, humor: 3, drive: 5, openness: 3, steadiness: 4 },
  friendAverages: {
    warmth: 4.7,
    humor: 4.3,
    drive: 4,
    openness: 4.3,
    steadiness: 3.7,
  },
  gap: {
    warmth: 0.7,
    humor: 1.3,
    drive: -1,
    openness: 1.3,
    steadiness: -0.3,
    largest: {
      trait: "Funny and fun to be around",
      selfRating: 3,
      friendRating: 4.3,
      delta: 1.3,
    },
  },
  invites: [
    {
      id: -1,
      friendLabel: "Sam from work",
      status: "answered",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      path: null,
    },
    {
      id: -2,
      friendLabel: "Jordan",
      status: "pending",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      path: null,
    },
  ],
};

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(n)}
          aria-label={`Rate ${n} of 5`}
          className={`h-8 w-8 rounded-lg border text-sm font-semibold transition-all disabled:cursor-default ${
            n <= value
              ? "border-transparent bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] text-white"
              : "border-white/10 bg-white/[0.03] text-muted-foreground/60 hover:border-white/20"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Wingman() {
  useMeta(
    "Wingman",
    "Ask the people who know you to rate you on five traits, then see how their view lines up with your own. Outside perspective is a real read the machine cannot get any other way, and every answer feeds your matching readiness.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: stateData } = useGetWingmanState({
    query: {
      queryKey: getGetWingmanStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const setSelf = useSetWingmanSelfRating();
  const createInvite = useCreateWingmanInvite();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  const isDemo = !isAuthenticated;
  const state = isDemo ? DEMO_STATE : stateData;

  const [draft, setDraft] = useState<Record<TraitKey, number>>({
    warmth: 0,
    humor: 0,
    drive: 0,
    openness: 0,
    steadiness: 0,
  });
  const [friendLabel, setFriendLabel] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Seed the rating sliders from any saved self-rating so re-rating starts
  // where the user left off.
  const savedSelf = state?.selfRatings ?? null;
  const effectiveDraft = useMemo(() => {
    const anyDraft = TRAITS.some((t) => draft[t.key] > 0);
    if (anyDraft || !savedSelf) return draft;
    return {
      warmth: savedSelf.warmth,
      humor: savedSelf.humor,
      drive: savedSelf.drive,
      openness: savedSelf.openness,
      steadiness: savedSelf.steadiness,
    };
  }, [draft, savedSelf]);

  const selfComplete = TRAITS.every((t) => effectiveDraft[t.key] >= 1);

  const isBrandNewUser =
    isAuthenticated &&
    !savedSelf &&
    (state?.invites?.length ?? 0) === 0 &&
    (state?.perspectives ?? 0) === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetWingmanStateQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const saveSelf = () => {
    if (!selfComplete || isDemo || setSelf.isPending) return;
    climb.snapshot();
    setSelf.mutate(
      {
        data: {
          warmth: effectiveDraft.warmth,
          humor: effectiveDraft.humor,
          drive: effectiveDraft.drive,
          openness: effectiveDraft.openness,
          steadiness: effectiveDraft.steadiness,
        },
      },
      { onSuccess: invalidate },
    );
  };

  const mintInvite = () => {
    if (isDemo || createInvite.isPending) return;
    createInvite.mutate(
      { data: { friendLabel: friendLabel.trim() || null } },
      {
        onSuccess: () => {
          setFriendLabel("");
          invalidate();
        },
      },
    );
  };

  const copyLink = async (id: number, path: string | null | undefined) => {
    if (!path) return;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard can be blocked; the link text is still selectable below.
    }
  };

  const gap = state?.gap ?? null;
  const friendAverages = state?.friendAverages ?? null;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Users className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Wingman loop
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Wingman</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Rate yourself on five traits, then ask people who know you to do
              the same. Seeing yourself through their eyes is a read you cannot
              give yourself, and every perspective nudges your matching
              readiness.
            </p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Users className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to the Wingman loop"
              title="Start with yourself"
              description="Rate yourself on the five traits first, then send a friend a link. Once they weigh in, you will see where your self-image and how others see you line up or diverge."
              testId="wingman-empty-state"
            />
          )}

          {/* Self rating */}
          <motion.div
            {...fadeUp(0.04)}
            className="glass border border-white/10 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-[hsl(245_70%_72%)]" />
              <p className="text-base font-semibold text-foreground">
                How you see yourself
              </p>
            </div>
            <p className="text-xs text-muted-foreground/60 mb-4">
              One to five on each. This is the baseline your friends are compared
              against.
            </p>
            <div className="space-y-3">
              {TRAITS.map((t) => (
                <div
                  key={t.key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-foreground">{t.label}</span>
                  <Stars
                    value={effectiveDraft[t.key]}
                    disabled={isDemo}
                    onChange={(v) =>
                      setDraft((prev) => ({ ...prev, [t.key]: v }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={saveSelf}
                disabled={!selfComplete || isDemo || setSelf.isPending}
                className="rounded-2xl bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                data-testid="wingman-save-self"
              >
                {savedSelf ? "Update self-rating" : "Save self-rating"}
              </button>
            </div>
            {isDemo && (
              <p className="text-xs text-muted-foreground/50 mt-3">
                Sign in to save your rating and ask your friends.
              </p>
            )}
          </motion.div>

          {/* Gap reveal */}
          {gap && friendAverages && (
            <motion.div
              {...fadeUp(0.06)}
              className="glass border border-white/10 rounded-2xl p-6 mb-6"
              data-testid="wingman-gap"
            >
              <p className="text-base font-semibold text-foreground mb-1">
                You vs the people who know you
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Averaged across {state?.perspectives ?? 0} perspective
                {(state?.perspectives ?? 0) === 1 ? "" : "s"}. No single friend's
                answer is shown, only the average.
              </p>
              <div className="space-y-3">
                {TRAITS.map((t) => {
                  const self = savedSelf?.[t.key] ?? 0;
                  const friend = friendAverages[t.key as keyof WingmanRatings];
                  const delta = Math.round((friend - self) * 10) / 10;
                  return (
                    <div key={t.key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{t.label}</span>
                        <span className="text-muted-foreground/70 tabular-nums">
                          you {self} / friends {friend}
                          {delta !== 0 && (
                            <span
                              className={
                                delta > 0
                                  ? "ml-2 text-[hsl(150_60%_60%)]"
                                  : "ml-2 text-[hsl(20_85%_65%)]"
                              }
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)]"
                          style={{ width: `${(friend / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm text-foreground leading-relaxed">
                  Your widest gap is{" "}
                  <strong className="text-[hsl(245_70%_78%)]">
                    {gap.largest.trait.toLowerCase()}
                  </strong>
                  . You rated yourself {gap.largest.selfRating}; friends put you
                  at {gap.largest.friendRating}.{" "}
                  {gap.largest.delta > 0
                    ? "They see more of it in you than you do."
                    : gap.largest.delta < 0
                      ? "You see more of it in yourself than they do."
                      : "You and they are right in step."}
                </p>
              </div>
            </motion.div>
          )}

          {/* Invite a friend */}
          <motion.div
            {...fadeUp(0.08)}
            className="glass border border-white/10 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-[hsl(245_70%_72%)]" />
              <p className="text-base font-semibold text-foreground">
                Ask a friend
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={friendLabel}
                onChange={(e) => setFriendLabel(e.target.value.slice(0, 60))}
                placeholder="Nickname for you (optional, private)"
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(245_58%_62%/0.5)]"
                data-testid="wingman-friend-label"
              />
              <button
                onClick={mintInvite}
                disabled={isDemo || createInvite.isPending}
                className="rounded-2xl bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                data-testid="wingman-create-invite"
              >
                Create link
              </button>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-3">
              Your friend opens the link, rates you on the same five traits, and
              never needs an account. The nickname is only for you.
            </p>
          </motion.div>

          {/* Invites list */}
          {(state?.invites?.length ?? 0) > 0 && (
            <motion.div {...fadeUp(0.1)} className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3 px-1">
                Your invites
              </p>
              <div className="space-y-3">
                {state!.invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="glass border border-white/8 rounded-2xl p-4"
                    data-testid="wingman-invite"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        {inv.status === "answered" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(150_60%_60%)]">
                            <Check className="w-3.5 h-3.5" />
                            Answered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
                            <Clock className="w-3.5 h-3.5" />
                            Waiting
                          </span>
                        )}
                        {inv.friendLabel && (
                          <span className="text-sm text-foreground">
                            {inv.friendLabel}
                          </span>
                        )}
                      </div>
                      {inv.status === "pending" && inv.path && (
                        <button
                          onClick={() => copyLink(inv.id, inv.path)}
                          disabled={isDemo}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-white/20 disabled:opacity-40"
                          data-testid="wingman-copy-link"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[hsl(150_60%_60%)]" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy link
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {isAuthenticated && climb.before !== null && (
            <motion.div {...fadeUp(0.11)} className="mb-6">
              <ReadinessClimbReveal
                from={climb.before}
                to={climb.current}
                className="glass border border-white/8 rounded-2xl p-5"
              />
            </motion.div>
          )}

          {/* Trust note */}
          <motion.div
            {...fadeUp(0.45)}
            className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Answers are aggregated, never attributed.
              </strong>{" "}
              Friends only ever submit five one-to-five scores, never any
              writing. You see the average and the gap, never who said what, and
              matching sees only how many perspectives you gathered.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
