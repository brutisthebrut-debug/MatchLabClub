import { useState } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Users, Shield, Check, Heart } from "lucide-react";
import {
  useGetWingmanInvitePublic,
  useAnswerWingmanInvite,
  getGetWingmanInvitePublicQueryKey,
} from "@workspace/api-client-react";

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

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} of 5`}
          className={`h-9 w-9 rounded-lg border text-sm font-semibold transition-all ${
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

export default function WingmanRespond() {
  const [, params] = useRoute("/wingman/r/:token");
  const token = params?.token ?? "";

  useMeta(
    "Rate a friend",
    "A friend asked for your honest read on five quick traits. No account needed, and your answer is only ever shown to them as part of an average.",
  );

  const {
    data: invite,
    isLoading,
    isError,
  } = useGetWingmanInvitePublic(token, {
    query: {
      queryKey: getGetWingmanInvitePublicQueryKey(token),
      enabled: token.length > 0,
      retry: false,
    },
  });
  const answer = useAnswerWingmanInvite();

  const [draft, setDraft] = useState<Record<TraitKey, number>>({
    warmth: 0,
    humor: 0,
    drive: 0,
    openness: 0,
    steadiness: 0,
  });
  const [submitted, setSubmitted] = useState(false);

  const inviterName = invite?.inviterName ?? "your friend";
  const alreadyAnswered = invite?.answered ?? false;
  const complete = TRAITS.every((t) => draft[t.key] >= 1);

  const submit = () => {
    if (!complete || answer.isPending) return;
    answer.mutate(
      {
        token,
        data: {
          warmth: draft.warmth,
          humor: draft.humor,
          drive: draft.drive,
          openness: draft.openness,
          steadiness: draft.steadiness,
        },
      },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-12 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-lg mx-auto relative z-10">{children}</div>
      </div>
    </AppLayout>
  );

  if (isLoading) {
    return (
      <Shell>
        <div className="glass border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading your invite...</p>
        </div>
      </Shell>
    );
  }

  if (isError || !invite) {
    return (
      <Shell>
        <motion.div
          {...fadeUp(0)}
          className="glass border border-white/10 rounded-2xl p-8 text-center"
          data-testid="wingman-respond-invalid"
        >
          <h1 className="text-xl font-bold text-foreground mb-2">
            This link is not working
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            It may have expired or already been used. Ask your friend to send you
            a fresh one.
          </p>
        </motion.div>
      </Shell>
    );
  }

  if (submitted || alreadyAnswered) {
    return (
      <Shell>
        <motion.div
          {...fadeUp(0)}
          className="glass border border-white/10 rounded-2xl p-8 text-center"
          data-testid="wingman-respond-done"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {submitted ? "Thank you" : "This one is already answered"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {submitted
              ? `Your read on ${inviterName} is in. They will only ever see it as part of an average, never tied back to you.`
              : "This invite has already been filled in. Nothing more to do here."}
          </p>
        </motion.div>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.div {...fadeUp(0)} className="mb-8 text-center">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center mx-auto mb-4 shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
          <Users className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          How do you see {inviterName}?
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {inviterName} is working on showing up well in dating and asked for
          your honest read. Five quick traits, one to five each. No account
          needed.
        </p>
      </motion.div>

      <motion.div
        {...fadeUp(0.05)}
        className="glass border border-white/10 rounded-2xl p-6 mb-6"
      >
        <div className="space-y-4">
          {TRAITS.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{t.label}</span>
              <Stars
                value={draft[t.key]}
                onChange={(v) => setDraft((prev) => ({ ...prev, [t.key]: v }))}
              />
            </div>
          ))}
        </div>
        {answer.isError && (
          <p className="text-xs text-[hsl(20_85%_65%)] mt-4">
            Something went wrong saving that. Please try again.
          </p>
        )}
        <button
          onClick={submit}
          disabled={!complete || answer.isPending}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          data-testid="wingman-respond-submit"
        >
          Send my read
        </button>
      </motion.div>

      <motion.div
        {...fadeUp(0.1)}
        className="glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
      >
        <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground/45 leading-relaxed">
          <strong className="text-muted-foreground/60">
            Your answer stays anonymous.
          </strong>{" "}
          {inviterName} only ever sees an average across everyone they asked,
          never your individual scores. There is no free text to fill in.
        </p>
      </motion.div>

      <div className="mt-6 text-center">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/40">
          <Heart className="w-3 h-3" />
          Powered by MatchLab
        </p>
      </div>
    </Shell>
  );
}
