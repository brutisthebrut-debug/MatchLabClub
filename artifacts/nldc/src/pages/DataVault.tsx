import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield, Lock, Download, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
  Image, MessageSquare, FileText, BookOpen, Activity, Check, Heart, ArrowRight,
  AlertTriangle, Mail, Calendar, Sparkles, Trophy, Instagram, HeartPulse,
  Coffee, Compass, Database, ShieldCheck, X, Award,
} from "lucide-react";
import {
  useListWellnessAnswers,
  useListWellnessTags,
  useDeleteWellnessAnswer,
  useUpdateWellnessAnswerPermissions,
  useDeleteMyAccountConfirmed,
  useGetCurrentAuthUser,
  useGetTrustLedger,
  usePurgeTrustSource,
  useEmailMyDataExport,
  exportMyData,
  getGetTrustLedgerQueryKey,
  getGetMatchingStateQueryKey,
  getGetAccountSummaryQueryKey,
  type TrustLedgerEntry,
} from "@workspace/api-client-react";
import { DIMENSION_META } from "@/lib/wellnessQuestionBank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const SOURCE_STYLE: Record<string, { icon: React.ElementType; color: string }> = {
  wellness: { icon: Heart, color: "hsl(248 62% 60%)" },
  compass: { icon: Compass, color: "hsl(190 55% 60%)" },
  hingeImport: { icon: Database, color: "hsl(326 100% 65%)" },
  postDate: { icon: BookOpen, color: "hsl(142 55% 60%)" },
  journal: { icon: FileText, color: "hsl(43 65% 65%)" },
  wins: { icon: Trophy, color: "hsl(43 80% 62%)" },
  calendar: { icon: Calendar, color: "hsl(210 70% 62%)" },
  audits: { icon: Activity, color: "hsl(248 62% 62%)" },
  coaching: { icon: MessageSquare, color: "hsl(190 55% 60%)" },
  instagram: { icon: Instagram, color: "hsl(326 80% 62%)" },
  lifePulse: { icon: HeartPulse, color: "hsl(348 65% 65%)" },
  taste: { icon: Coffee, color: "hsl(28 70% 60%)" },
  lifestyle: { icon: Sparkles, color: "hsl(270 60% 65%)" },
  quizzes: { icon: Award, color: "hsl(248 62% 60%)" },
};

const FALLBACK_STYLE = { icon: Database, color: "hsl(var(--brand-indigo))" };

// A signed-out, demo view so the page is never empty. Mirrors the live ledger
// shape but is clearly labelled as a sample so nobody mistakes it for real data.
const DEMO_ENTRIES: TrustLedgerEntry[] = [
  {
    id: "wellness", label: "Compatibility Profile", origin: "Answers you give in the Profile Builder",
    noun: "answer", held: true, count: 12, storedCount: 12, coverage: 64,
    summary: "A solid read on what you value, how you handle conflict, and what you want next.",
    dimensions: ["values", "communication"], seen: ["Your written answers to wellness prompts"],
    neverTouched: ["Anything you have not chosen to answer"],
    actionLabel: "Answer more prompts", actionHref: "/wellness", purgeable: true,
  },
  {
    id: "audits", label: "Signal Audits", origin: "Profile audits you run",
    noun: "audit", held: true, count: 3, storedCount: 3, coverage: 48,
    summary: "How your profile reads to others, your score history, and where it can sharpen.",
    dimensions: ["presentation"], seen: ["The bio and prompts you submit for audit"],
    neverTouched: ["Your photos are read in the moment, never stored"],
    actionLabel: "Run an audit", actionHref: "/intake", purgeable: true,
  },
  {
    id: "coaching", label: "Message Coaching", origin: "Threads you bring to Message Coach",
    noun: "session", held: false, count: 0, storedCount: 0, coverage: 0,
    summary: "Nothing here yet. Coach a thread and I learn your conversation style.",
    dimensions: ["communication"], seen: ["The conversation snippet you paste"],
    neverTouched: ["Any names or identifiers of the other person"],
    actionLabel: "Coach a message", actionHref: "/message-coach", purgeable: false,
  },
];

function CoverageBar({ coverage, color }: { coverage: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/6 overflow-hidden w-full">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, coverage))}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function SourceRow({
  entry,
  index,
  onPurge,
  purging,
  readOnly,
}: {
  entry: TrustLedgerEntry;
  index: number;
  onPurge: (entry: TrustLedgerEntry) => void;
  purging: boolean;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const style = SOURCE_STYLE[entry.id] ?? FALLBACK_STYLE;
  const Icon = style.icon;

  return (
    <motion.div {...fadeUp(0.05 + index * 0.04)} className="glass border border-white/8 rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: withAlpha(style.color, 0.12) }}>
            <Icon className="w-4 h-4" style={{ color: style.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{entry.label}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/50 flex-shrink-0">
                {entry.held ? `${entry.storedCount} ${entry.noun}${entry.storedCount !== 1 ? "s" : ""}` : "nothing yet"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/45 mt-0.5">{entry.origin}</p>
            <p className="text-xs text-muted-foreground/60 mt-1.5 leading-relaxed">{entry.summary}</p>
          </div>
        </div>

        {/* Coverage toward Match Readiness */}
        <div className="mt-4 flex items-center gap-3">
          <CoverageBar coverage={entry.coverage} color={style.color} />
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground/45 flex-shrink-0 w-16 text-right">
            {Math.round(entry.coverage)}% read
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {open ? "Hide detail" : "What I see"}
          </button>
          <span className="text-white/15">·</span>
          <Link href={entry.actionHref}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> {entry.actionLabel}
          </Link>
          {entry.purgeable && !readOnly && (
            <>
              <span className="text-white/15">·</span>
              <button onClick={() => setConfirmOpen(true)} disabled={purging}
                className="flex items-center gap-1.5 text-xs text-[hsl(348_55%_65%/0.6)] hover:text-[hsl(348_55%_65%)] transition-colors disabled:opacity-40">
                <Trash2 className="w-3.5 h-3.5" /> {purging ? "Purging..." : "Purge"}
              </button>
            </>
          )}
        </div>

        {/* Detail panel */}
        {open && (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[hsl(142_55%_50%/0.06)] border border-[hsl(142_55%_50%/0.15)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3 h-3 text-[hsl(142_55%_60%)]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(142_55%_62%)]">What I see</p>
              </div>
              <div className="space-y-1.5">
                {entry.seen.map(s => (
                  <div key={s} className="flex items-start gap-2 text-[11px] text-muted-foreground/65 leading-snug">
                    <Check className="w-3 h-3 text-[hsl(142_55%_55%)] flex-shrink-0 mt-0.5" /> {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-[hsl(348_55%_50%/0.06)] border border-[hsl(348_55%_50%/0.15)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="w-3 h-3 text-[hsl(348_60%_68%)]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(348_60%_70%)]">Never touched</p>
              </div>
              <div className="space-y-1.5">
                {entry.neverTouched.map(s => (
                  <div key={s} className="flex items-start gap-2 text-[11px] text-muted-foreground/65 leading-snug">
                    <X className="w-3 h-3 text-[hsl(348_55%_60%)] flex-shrink-0 mt-0.5" /> {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge {entry.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {entry.storedCount} {entry.noun}{entry.storedCount !== 1 ? "s" : ""} from this source. Your Match Readiness will drop by what this source contributed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                onPurge(entry);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Purge this source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function WellnessDataSection() {
  const { data: answersData, refetch } = useListWellnessAnswers({});
  const { data: tagsData } = useListWellnessTags({});
  const { mutate: deleteAnswer } = useDeleteWellnessAnswer();
  const updatePermissions = useUpdateWellnessAnswerPermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const answers = answersData?.answers ?? [];
  const tags = tagsData?.tags ?? [];
  const total = answers.length + tags.length;

  if (total === 0) return null;

  function handleDeleteAnswer(id: number) {
    deleteAnswer({ id }, {
      onSuccess: () => {
        toast({ title: "Answer deleted", description: "Removed from your Compatibility Profile." });
        void refetch();
      },
    });
  }

  function handlePermission(
    id: number,
    purpose: "echo" | "mirror" | "matching" | "research",
    approved: boolean,
  ) {
    const data =
      purpose === "echo"
        ? { echo: approved }
        : purpose === "mirror"
          ? { mirror: approved }
          : purpose === "matching"
            ? { matching: approved }
            : { research: approved };
    updatePermissions.mutate(
      { id, data },
      {
        onSuccess: () => {
          const descriptions = {
            echo: approved
              ? "Echo may use this answer in your conversations."
              : "Echo will no longer use this answer.",
            mirror: approved
              ? "This answer is now confirmed in your Mirror."
              : "Removed from Mirror. Matching use was also turned off.",
            matching: approved
              ? "This answer may now contribute to matching."
              : "This answer will not contribute to matching.",
            research: approved
              ? "Research use is on for this answer."
              : "Research use is off for this answer.",
          };
          toast({
            title: "Permission updated",
            description: descriptions[purpose],
          });
          void refetch();
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetTrustLedgerQueryKey(),
          });
        },
        onError: (err: unknown) => {
          toast({
            title: "Permission not changed",
            description:
              err instanceof Error
                ? err.message
                : "Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  }

  const byDimension = new Map<string, typeof answers>();
  for (const a of answers) {
    const arr = byDimension.get(a.dimension) ?? [];
    arr.push(a);
    byDimension.set(a.dimension, arr);
  }

  return (
    <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-2xl overflow-hidden mb-3">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.12)]">
            <Heart className="w-4 h-4 text-[hsl(248_62%_52%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Compatibility Profile, answer by answer</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/50 flex-shrink-0">
                {answers.length} answer{answers.length !== 1 ? "s" : ""}{tags.length > 0 ? ` · ${tags.length} tag${tags.length !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/55 mt-0.5 leading-relaxed">
              Saving an answer does not quietly approve it for Echo, Mirror,
              matching, or research. You choose each purpose here.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {open ? "Hide" : "Review answers"}
          </button>
          <span className="text-white/15">·</span>
          <Link href="/wellness" className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Manage in Profile Builder
          </Link>
        </div>

        {open && (
          <div className="mt-4 space-y-3">
            {Array.from(byDimension.entries()).map(([dim, dimAnswers]) => {
              const meta = DIMENSION_META[dim];
              return (
                <div key={dim} className="rounded-xl bg-white/2 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: meta?.color ?? "hsl(var(--brand-indigo))" }}>
                    {meta?.label ?? dim}
                  </p>
                  <div className="space-y-2">
                    {dimAnswers.map(a => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-white/5 bg-black/5 p-3 text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground/50 mb-0.5 leading-snug truncate">{a.questionText}</p>
                          <p className="text-foreground/80 leading-relaxed">"{a.answer}"</p>
                          </div>
                          <button
                            onClick={() => handleDeleteAnswer(a.id)}
                            className="flex-shrink-0 p-1 text-[hsl(348_55%_65%/0.5)] hover:text-[hsl(348_55%_65%)] transition-colors"
                            aria-label="Delete answer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[
                            {
                              purpose: "echo" as const,
                              label: "Echo may use it",
                              checked: a.permissions.echo,
                            },
                            {
                              purpose: "mirror" as const,
                              label: "Confirmed in Mirror",
                              checked: a.permissions.mirror,
                            },
                            {
                              purpose: "matching" as const,
                              label: "May inform matching",
                              checked: a.permissions.matching,
                              disabled: !a.permissions.mirror,
                            },
                            {
                              purpose: "research" as const,
                              label: "May support research",
                              checked: a.permissions.research,
                            },
                          ].map((permission) => (
                            <label
                              key={permission.purpose}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white/3 px-2.5 py-2 text-[11px] text-muted-foreground/70"
                            >
                              <span>
                                {permission.label}
                                {permission.purpose === "matching" &&
                                  permission.disabled && (
                                    <span className="block text-[9px] text-muted-foreground/40">
                                      Confirm in Mirror first
                                    </span>
                                  )}
                              </span>
                              <Switch
                                checked={permission.checked}
                                disabled={
                                  permission.disabled ||
                                  (updatePermissions.isPending &&
                                    updatePermissions.variables?.id === a.id)
                                }
                                onCheckedChange={(checked) =>
                                  handlePermission(
                                    a.id,
                                    permission.purpose,
                                    checked,
                                  )
                                }
                                aria-label={permission.label}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {tags.length > 0 && (
              <div className="rounded-xl bg-white/2 border border-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[hsl(43_65%_72%)]">Insight Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.1)] border border-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_72%)]">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DeleteAccountCard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { data: authData } = useGetCurrentAuthUser();
  const accountEmail = authData?.user?.email ?? null;
  const expected = (accountEmail ?? "").trim().toLowerCase();
  const matches = expected.length > 0 && typed.trim().toLowerCase() === expected;

  const { mutate: deleteAccount, isPending } = useDeleteMyAccountConfirmed();

  function handleConfirm() {
    if (!matches || !accountEmail) return;
    deleteAccount(
      { data: { confirmation: accountEmail } },
      {
        onSuccess: () => {
          setOpen(false);
          toast({
            title: "Your account is gone. Take care.",
          });
          navigate("/");
        },
        onError: (err: unknown) => {
          const message =
            err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
              ? (err as { message: string }).message
              : "Couldn't delete your account. Try again in a moment.";
          toast({
            title: "Delete failed",
            description: message,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <motion.div
      {...fadeUp(0.05)}
      className="mt-8 rounded-2xl border border-[hsl(348_55%_55%/0.35)] bg-[hsl(348_55%_30%/0.08)] p-5"
      data-testid="delete-account-card"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(348_55%_55%/0.15)]">
          <AlertTriangle className="w-4 h-4 text-[hsl(348_70%_70%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Delete my account</p>
          <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
            This removes everything I have on you. Audits, coaching sessions, journal entries, wellness answers, compass reads, dating app imports, the lot. This cannot be undone.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setTyped("");
                setOpen(true);
              }}
              disabled={!accountEmail}
              data-testid="open-delete-account-dialog"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete my account
            </Button>
            {!accountEmail && (
              <p className="text-[11px] text-muted-foreground/60 mt-2">
                You need to be signed in with an email on file to delete your account.
              </p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Type your account email <strong className="text-foreground">{accountEmail}</strong> exactly to confirm. This permanently removes every row tied to your account and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={accountEmail ?? ""}
              autoComplete="off"
              spellCheck={false}
              data-testid="delete-account-confirm-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={!matches || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-account"
            >
              {isPending ? "Deleting..." : "Delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default function DataVault() {
  useMeta("Personal Data Vault", "Every source I hold about you, where it came from, what I see versus never touch, with one-tap purge for any of it.");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const { data: authData } = useGetCurrentAuthUser();
  const isAuthed = Boolean(authData?.user?.id);

  const { data: ledger, isLoading } = useGetTrustLedger({
    query: { enabled: isAuthed, queryKey: getGetTrustLedgerQueryKey() },
  });
  const { mutate: purgeSource, isPending: isPurging, variables: purgeVars } = usePurgeTrustSource();
  const emailExport = useEmailMyDataExport();

  const liveEntries = ledger?.entries ?? [];
  const entries = isAuthed ? liveEntries : DEMO_ENTRIES;
  const heldCount = entries.filter(e => e.held).length;

  function handlePurge(entry: TrustLedgerEntry) {
    purgeSource(
      { id: entry.id },
      {
        onSuccess: (result) => {
          toast({
            title: `${entry.label} purged`,
            description: `Removed ${result.removed} ${entry.noun}${result.removed !== 1 ? "s" : ""}. Your readiness has been recalculated.`,
          });
          void queryClient.invalidateQueries({ queryKey: getGetTrustLedgerQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() });
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Couldn't purge that source. Try again in a moment.";
          toast({ title: "Purge failed", description: message, variant: "destructive" });
        },
      },
    );
  }

  async function handleDownloadAll() {
    setIsExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Your full data export downloaded as JSON." });
    } catch (err) {
      toast({
        title: "Couldn't export your data",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleEmailExport() {
    try {
      const result = await emailExport.mutateAsync();
      toast({
        title: "Export email sent",
        description: `I sent a single-use download link to ${result.sentTo}. It expires soon.`,
      });
    } catch (err) {
      toast({
        title: "Couldn't email your export",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <HubTabs hub="connections" />
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-10 opacity-20 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[hsl(248_62%_52%/0.15)] flex items-center justify-center">
                <Lock className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              </div>
              <p className="text-sm font-semibold text-[hsl(248_62%_62%)]">Personal Data Vault</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Everything I know about you.</h1>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              One honest list of every source feeding your readiness, where it came from, exactly what I see versus what I never touch. Purge any source on its own, any time.
            </p>
          </motion.div>

          {/* Demo banner for signed-out */}
          {!isAuthed && (
            <motion.div {...fadeUp(0.02)} className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[hsl(248_62%_52%/0.08)] border border-[hsl(248_62%_52%/0.2)]">
              <ShieldCheck className="w-4 h-4 text-[hsl(248_62%_62%)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                <strong className="text-foreground">This is a sample view.</strong>{" "}
                <Link href="/login" className="text-[hsl(248_62%_62%)] hover:underline">Sign in</Link>{" "}
                to see the real sources I hold about you, with live counts and one-tap purge.
              </p>
            </motion.div>
          )}

          {/* Privacy promise */}
          <motion.div {...fadeUp(0.03)} className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/3 border border-white/6">
            <Shield className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              <strong className="text-muted-foreground/65">No third-party sharing. No selling. No training on your content.</strong>{" "}
              Saving something is not permission to use it everywhere. For
              profile answers, you separately control Echo, Mirror, matching,
              and research use.
            </p>
          </motion.div>

          {/* Export everything */}
          <motion.div {...fadeUp(0.04)} className="mb-5 flex flex-wrap items-center gap-3">
            <button onClick={handleDownloadAll} disabled={!isAuthed || isExporting}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-white/8 hover:border-white/15 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> {isExporting ? "Preparing..." : "Download everything (JSON)"}
            </button>
            <button onClick={handleEmailExport} disabled={!isAuthed || emailExport.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-white/8 hover:border-white/15 disabled:opacity-40">
              <Mail className="w-3.5 h-3.5" /> {emailExport.isPending ? "Sending..." : "Email me a link"}
            </button>
          </motion.div>

          {/* Wellness / Compatibility granular control */}
          {isAuthed && <WellnessDataSection />}

          {/* Live ledger */}
          {isAuthed && isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="glass border border-white/8 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 w-40 bg-white/8 rounded mb-3" />
                  <div className="h-3 w-full bg-white/5 rounded mb-2" />
                  <div className="h-1.5 w-full bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : isAuthed && heldCount === 0 ? (
            <motion.div {...fadeUp(0)} className="glass border border-white/8 rounded-2xl p-8 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-[hsl(248_62%_52%/0.12)] flex items-center justify-center">
                <Database className="w-5 h-5 text-[hsl(248_62%_52%)]" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nothing stored yet</p>
              <p className="text-xs text-muted-foreground/50 leading-relaxed max-w-sm mx-auto">
                I hold nothing about you so far. As you use a tool or connect a source, it appears here with a live count and full controls. Below are the sources waiting for your first signal.
              </p>
              <div className="space-y-3 pt-3 text-left">
                {entries.map((entry, i) => (
                  <SourceRow key={entry.id} entry={entry} index={i} onPurge={handlePurge}
                    purging={isPurging && purgeVars?.id === entry.id} readOnly={false} />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <SourceRow key={entry.id} entry={entry} index={i} onPurge={handlePurge}
                  purging={isPurging && purgeVars?.id === entry.id} readOnly={!isAuthed} />
              ))}
            </div>
          )}

          {/* Footer links */}
          <motion.div {...fadeUp(0.4)} className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/connections" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Add more context
            </Link>
            <span className="text-white/15">·</span>
            <Link href="/user-control" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Privacy settings
            </Link>
            <span className="text-white/15">·</span>
            <Link href="/privacy" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Privacy policy
            </Link>
          </motion.div>

          {isAuthed && <DeleteAccountCard />}
        </div>
      </div>
    </AppLayout>
  );
}
