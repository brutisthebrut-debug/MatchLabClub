import { useState } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BlockedMembersSection } from "@/components/safety/BlockedMembersSection";
import { useAutoRefreshPref } from "@/lib/autoRefreshPref";
import { useTrashReminderPref } from "@/lib/trashReminderPref";
import { useCopyDurationPref, type CopyDuration, COPY_DURATION_LABELS } from "@/lib/copyDurationPref";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListAudits,
  getListAuditsQueryKey,
  exportMyData,
  useDeleteMyAccount,
  useGetAccountSummary,
  getGetAccountSummaryQueryKey,
  useEmailMyDataExport,
  useGetAiContentConsent,
  useSetAiContentConsent,
  getGetAiContentConsentQueryKey,
  useGetDigestPreferences,
  useSetDigestPreferences,
  getGetDigestPreferencesQueryKey,
  type SetDigestPreferencesInputFrequency,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogIn,
  LogOut,
  Mail,
  User as UserIcon,
  FileText,
  ArrowRight,
  Shield,
  Download,
  Send,
  Trash2,
  Loader2,
  Smartphone,
  Brain,
  Sparkles,
} from "lucide-react";

const DIGEST_FREQUENCY_OPTIONS: {
  value: SetDigestPreferencesInputFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "off", label: "Off" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center text-2xl font-bold text-white shadow-[0_4px_20px_hsl(248_62%_52%/0.3)] border border-white/20">
      {initials}
    </div>
  );
}

export default function Account() {
  useMeta(
    "Your Account",
    "Your MatchLab Club account, profile, audit count, and sign-out."
  );

  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { toast } = useToast();
  const auditsQuery = useListAudits(undefined, {
    query: { queryKey: getListAuditsQueryKey(), enabled: isAuthenticated },
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const DELETE_CONFIRM_PHRASE = "delete";
  const isDeleteConfirmed =
    deleteConfirmText.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;
  const deleteAccount = useDeleteMyAccount();
  const summaryQuery = useGetAccountSummary({
    query: {
      queryKey: getGetAccountSummaryQueryKey(),
      enabled: isAuthenticated && confirmDeleteOpen,
    },
  });
  const emailExport = useEmailMyDataExport();
  const queryClient = useQueryClient();
  const aiConsent = useGetAiContentConsent({
    query: { queryKey: getGetAiContentConsentQueryKey(), enabled: isAuthenticated },
  });
  const setAiConsent = useSetAiContentConsent({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetAiContentConsentQueryKey() });
      },
    },
  });
  const consentGranted = Boolean(aiConsent.data?.granted);
  const handleToggleAiConsent = async (next: boolean) => {
    try {
      await setAiConsent.mutateAsync({ data: { granted: next } });
      toast({
        title: next ? "Deep AI lane: on" : "Deep AI lane: off",
        description: next
          ? "Anthropic Claude is now layered on top of the deterministic baseline for tools that benefit from it. Prompts run under Anthropic's zero-retention API policy."
          : "You're back on the deterministic baseline. Every feature still works, just without the Claude layer on top.",
      });
    } catch (err) {
      toast({
        title: "Couldn't update your AI consent",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };
  const digestPrefs = useGetDigestPreferences({
    query: { queryKey: getGetDigestPreferencesQueryKey(), enabled: isAuthenticated },
  });
  const setDigestPrefs = useSetDigestPreferences({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetDigestPreferencesQueryKey() });
      },
    },
  });
  const digestFrequency = digestPrefs.data?.frequency ?? "weekly";
  const handleSetDigestFrequency = async (
    next: SetDigestPreferencesInputFrequency,
  ) => {
    if (next === digestFrequency) return;
    try {
      await setDigestPrefs.mutateAsync({ data: { frequency: next } });
      const label =
        DIGEST_FREQUENCY_OPTIONS.find((o) => o.value === next)?.label ?? "Weekly";
      toast({
        title: next === "off" ? "Mirror digest off" : `Mirror digest: ${label}`,
        description:
          next === "off"
            ? "We'll stop the digest and nudges. Your Mirror still updates whenever you open the app."
            : "We'll email you what changed about you, plus the one signal that moves you next.",
      });
    } catch (err) {
      toast({
        title: "Couldn't update your digest preference",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useAutoRefreshPref();
  const [trashRemindersEnabled, setTrashRemindersEnabled] = useTrashReminderPref();
  const [copyDuration, setCopyDuration] = useCopyDurationPref();

  const auditCount = auditsQuery.data?.length ?? 0;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Friend";

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nldc-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Your data export downloaded as JSON.",
      });
    } catch (err) {
      toast({
        title: "Couldn't export your data",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailExport = async () => {
    try {
      const result = await emailExport.mutateAsync();
      toast({
        title: "Export email sent",
        description: `We sent a single-use download link to ${result.sentTo}. It expires soon.`,
      });
    } catch (err) {
      toast({
        title: "Couldn't email your export",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteAccount.mutateAsync();
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been removed.",
      });
      setConfirmDeleteOpen(false);
      setDeleteConfirmText("");
      logout();
    } catch (err) {
      toast({
        title: "Couldn't delete your account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-4xl relative z-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[hsl(248_62%_52%/0.08)] via-transparent to-transparent pointer-events-none" />
        
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] mb-6 shadow-sm">
            <UserIcon className="w-4 h-4" />
            Your Account
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
            Account <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)]">overview</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Your profile, recent activity, and account controls, all in one place.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="glass-strong rounded-[2rem] p-8 md:p-10 space-y-6 shadow-lg" data-testid="account-loading">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem]" />
              <div className="flex-1 space-y-3 text-center sm:text-left w-full mt-2 sm:mt-0">
                <Skeleton className="h-8 w-3/4 max-w-xs mx-auto sm:mx-0" />
                <Skeleton className="h-5 w-1/2 max-w-[200px] mx-auto sm:mx-0" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-[1.5rem]" />
          </div>
        ) : !isAuthenticated ? (
          <motion.div 
            className="glass-strong rounded-[2rem] p-10 md:p-16 text-center space-y-8 shadow-xl relative overflow-hidden" 
            data-testid="account-signed-out"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
            <div className="w-20 h-20 mx-auto rounded-[2rem] bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center shadow-lg relative z-10">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-4 relative z-10">
              <h2 className="font-serif text-3xl font-bold text-foreground tracking-tight">Sign in to see your account</h2>
              <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
                Your profile, audits, and coaching history live here once you're signed in. It only takes a second.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-10">
              <Button
                onClick={() => login()}
                className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] text-white border-0 hover:opacity-90 shadow-md transition-all hover:scale-105"
                data-testid="button-account-login"
              >
                <LogIn className="w-5 h-5 mr-2" /> Sign in
              </Button>
              <Button asChild variant="ghost" className="w-full sm:w-auto rounded-full h-12 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-black/5">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="space-y-8" 
            data-testid="account-signed-in"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Profile card */}
            <motion.div variants={itemVariants} className="glass-strong rounded-[2rem] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 shadow-md relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent pointer-events-none" />
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={fullName}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] object-cover shadow-lg relative z-10 border border-white/20"
                  data-testid="account-avatar"
                />
              ) : (
                <div className="relative z-10">
                  <Initials name={fullName} />
                </div>
              )}
              <div className="min-w-0 flex-1 text-center md:text-left relative z-10 w-full mt-2 md:mt-0">
                <h2 className="font-serif text-3xl font-bold text-foreground truncate tracking-tight" data-testid="account-name">
                  {fullName}
                </h2>
                <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-base text-muted-foreground">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate font-medium" data-testid="account-email">{user?.email ?? "No email on file"}</span>
                </div>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
              <div className="glass-elevated rounded-[2rem] p-8 flex items-center gap-6 shadow-sm border border-[hsl(248_62%_52%/0.1)]">
                <div className="w-14 h-14 rounded-[1.5rem] bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)] flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-[hsl(248_62%_62%)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-3xl font-bold text-foreground tracking-tight" data-testid="account-audit-count">
                    {auditsQuery.isLoading ? "…" : auditCount}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">
                    {auditCount === 1 ? "Audit completed" : "Audits completed"}
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="glass-elevated rounded-[2rem] p-8 flex items-center gap-6 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all group shadow-sm border border-[hsl(190_55%_60%/0.1)] cursor-pointer"
                data-testid="link-account-dashboard"
              >
                <div className="w-14 h-14 rounded-[1.5rem] bg-[hsl(190_55%_60%/0.1)] border border-[hsl(190_55%_60%/0.2)] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:bg-[hsl(190_55%_60%/0.2)]">
                  <ArrowRight className="w-6 h-6 text-[hsl(190_55%_60%)] group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-foreground tracking-tight group-hover:text-[hsl(190_55%_60%)] transition-colors">Open dashboard</div>
                  <div className="text-sm text-muted-foreground mt-1">Scores, strengths, recent audits</div>
                </div>
              </Link>
            </motion.div>

            {/* Actions */}
            <motion.div variants={itemVariants} className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-border/50 shadow-sm">
              <div>
                <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">Account controls</h3>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  Manage data and approvals from your control center, or sign out below.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 pt-2">
                <Button asChild variant="outline" className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-semibold border-border hover:bg-black/5 hover:text-foreground">
                  <Link href="/user-control" data-testid="link-account-data">Manage your data</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-semibold border-border hover:bg-black/5 hover:text-foreground">
                  <Link href="/account/sessions" data-testid="link-account-sessions">
                    <Smartphone className="w-4 h-4 mr-2" /> Devices & sign-ins
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/5">
                  <Link href="/privacy">Privacy policy</Link>
                </Button>
                <div className="w-full sm:w-auto sm:ml-auto">
                  <Button
                    onClick={() => logout()}
                    variant="outline"
                    className="w-full rounded-full h-11 px-6 text-sm font-semibold border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_55%)] hover:bg-[hsl(348_55%_65%/0.1)] hover:text-[hsl(348_55%_65%)]"
                    data-testid="button-account-logout"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Deep AI lane (account-level consent for Anthropic) */}
            <motion.div variants={itemVariants} className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-[hsl(326_100%_60%/0.15)] shadow-sm" data-testid="card-ai-consent">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="h-14 w-14 rounded-[1.5rem] bg-[hsl(326_100%_60%/0.12)] flex items-center justify-center flex-shrink-0 shadow-sm border border-[hsl(326_100%_60%/0.2)]">
                  <Brain className="h-6 w-6 text-[hsl(326_100%_59%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">Deep AI lane</h3>
                  <p className="text-base text-muted-foreground mt-3 leading-relaxed">
                    Hybrid setup. The deterministic engine is always on. Fast, free, never rate-limited.
                    With this on, Anthropic Claude is layered on top for tools that benefit from semantic depth:
                    bio rewrites, message coaching, Compatibility Compass reads, Hinge import summaries, Instagram tone extraction.
                    Anthropic processes prompts under their zero-retention API policy. We never sell or train on your content.
                    Off means baseline only. Nothing breaks either way.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-[1.5rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] md:ml-[5rem]">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {consentGranted ? "Deep AI lane is active" : "Deep AI lane is inactive"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toggle any time. We log when it changes.
                  </p>
                </div>
                <Switch
                  checked={consentGranted}
                  disabled={aiConsent.isLoading || setAiConsent.isPending}
                  onCheckedChange={handleToggleAiConsent}
                  data-testid="switch-ai-consent"
                  aria-label="Toggle Deep AI lane"
                  className="scale-125 sm:scale-150 origin-left sm:origin-right mt-2 sm:mt-0"
                />
              </div>
            </motion.div>

            {/* Mirror digest (proactive "what changed about you" email) */}
            <motion.div variants={itemVariants} className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-[hsl(248_62%_52%/0.15)] shadow-sm" data-testid="card-mirror-digest">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="h-14 w-14 rounded-[1.5rem] bg-[hsl(248_62%_52%/0.12)] flex items-center justify-center flex-shrink-0 shadow-sm border border-[hsl(248_62%_52%/0.2)]">
                  <Sparkles className="h-6 w-6 text-[hsl(248_62%_62%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">Mirror digest</h3>
                  <p className="text-base text-muted-foreground mt-3 leading-relaxed">
                    A short email on what changed about you: how your Match Readiness moved, the signals
                    the machine started reading, and the single thing that moves you next. If nothing
                    changed, we send one gentle nudge instead. With the Deep AI lane on, the opening is
                    written by Claude from aggregate signal only, never your raw content.
                  </p>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-5 rounded-[1.5rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] md:ml-[5rem]">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">Delivery frequency</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Change any time. Off stops the digest and its nudges.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto" data-testid="digest-frequency-selector">
                  {DIGEST_FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => void handleSetDigestFrequency(opt.value)}
                      disabled={digestPrefs.isLoading || setDigestPrefs.isPending}
                      data-testid={`digest-frequency-${opt.value}`}
                      aria-pressed={digestFrequency === opt.value}
                      className={[
                        "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 sm:flex-none text-center",
                        digestFrequency === opt.value
                          ? "bg-[hsl(248_62%_52%)] text-white shadow-md shadow-[hsl(248_62%_52%/0.3)]"
                          : "bg-white/50 dark:bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-border/50",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Report preferences */}
            <motion.div variants={itemVariants} className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-border/50 shadow-sm">
              <div>
                <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">Report preferences</h3>
                <p className="text-base text-muted-foreground mt-2">
                  Choose how your saved audits behave between visits.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-5 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">Copy confirmation duration</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      How long the "Copied" checkmark stays visible after you copy text on a report.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto mt-2 sm:mt-0" data-testid="copy-duration-selector">
                    {(["short", "default", "long"] as CopyDuration[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setCopyDuration(opt);
                          toast({ title: `Copy confirmation: ${COPY_DURATION_LABELS[opt]}` });
                        }}
                        data-testid={`copy-duration-${opt}`}
                        aria-pressed={copyDuration === opt}
                        className={[
                          "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 capitalize flex-1 sm:flex-none text-center",
                          copyDuration === opt
                            ? "bg-[hsl(248_62%_52%)] text-white shadow-md shadow-[hsl(248_62%_52%/0.3)]"
                            : "bg-white/50 dark:bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-border/50",
                        ].join(" ")}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-5 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">Keep my reports up to date</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      When on, we'll quietly regenerate a few of your oldest saved
                      reports in the background each time you open the app. Failures are silent.
                    </p>
                  </div>
                  <Switch
                    checked={autoRefreshEnabled}
                    onCheckedChange={(v) => {
                      setAutoRefreshEnabled(v);
                      toast({
                        title: v ? "Background refresh on" : "Background refresh off",
                        description: v
                          ? "We'll quietly refresh a few stale reports each session."
                          : "Stale reports will stay as-is until you refresh them.",
                      });
                    }}
                    data-testid="switch-auto-refresh-reports"
                    aria-label="Keep my reports up to date"
                    className="scale-125 sm:scale-150 origin-left sm:origin-right mt-2 sm:mt-0"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-5 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">Recently deleted reminders</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      When on, a banner appears on your dashboard when audits in
                      your trash are close to being permanently deleted.
                    </p>
                  </div>
                  <Switch
                    checked={trashRemindersEnabled}
                    onCheckedChange={(v) => {
                      setTrashRemindersEnabled(v);
                      toast({
                        title: v ? "Recently deleted reminders on" : "Recently deleted reminders off",
                        description: v
                          ? "We'll warn you on the dashboard when audits are about to be purged."
                          : "No banner will show for audits nearing permanent deletion.",
                      });
                    }}
                    data-testid="switch-trash-reminders"
                    aria-label="Recently deleted reminders"
                    className="scale-125 sm:scale-150 origin-left sm:origin-right mt-2 sm:mt-0"
                  />
                </div>
              </div>
            </motion.div>

            {/* Blocked members */}
            <BlockedMembersSection />

            {/* Data ownership */}
            <motion.div variants={itemVariants} className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-border/50 shadow-sm">
              <div>
                <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">Your data</h3>
                <p className="text-base text-muted-foreground mt-2">
                  Download everything we have about you, or permanently remove your account and all associated audits, messages, and insights.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 pt-2">
                <Button
                  onClick={handleDownload}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-semibold border-border hover:bg-black/5 hover:text-foreground"
                  data-testid="button-account-download-data"
                >
                  {isExporting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 mr-2 text-[hsl(248_62%_52%)]" />
                  )}
                  Download my data
                </Button>
                <Button
                  onClick={handleEmailExport}
                  disabled={emailExport.isPending || !user?.email}
                  variant="outline"
                  className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-semibold border-border hover:bg-black/5 hover:text-foreground"
                  data-testid="button-account-email-data"
                  title={!user?.email ? "Add an email to your account to use this option" : undefined}
                >
                  {emailExport.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 mr-2 text-[hsl(190_55%_60%)]" />
                  )}
                  Email me a copy
                </Button>
                <div className="flex-grow hidden sm:block"></div>
                <Button
                  onClick={() => setConfirmDeleteOpen(true)}
                  variant="outline"
                  className="w-full sm:w-auto rounded-full h-11 px-6 text-sm font-semibold border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_55%)] hover:bg-[hsl(348_55%_65%/0.1)] hover:text-[hsl(348_55%_65%)] mt-2 sm:mt-0"
                  data-testid="button-account-delete"
                >
                  <Trash2 className="w-5 h-5 mr-2" /> Delete my account
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(open) => {
            setConfirmDeleteOpen(open);
            if (!open) setDeleteConfirmText("");
          }}
        >
          <AlertDialogContent data-testid="dialog-confirm-delete-account" className="rounded-[2rem] p-8 max-w-md">
            <AlertDialogHeader className="space-y-4">
              <AlertDialogTitle className="font-serif text-2xl tracking-tight text-center">Permanently delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p className="text-base text-center text-muted-foreground">
                    You'll be signed out immediately and the following will be
                    permanently removed. This can't be undone.
                  </p>
                  {summaryQuery.isLoading ? (
                    <div className="space-y-3 p-5 rounded-[1.5rem] bg-muted/50 border border-border" data-testid="delete-summary-loading">
                      <Skeleton className="h-5 w-3/4 rounded-full" />
                      <Skeleton className="h-5 w-2/3 rounded-full" />
                      <Skeleton className="h-5 w-1/2 rounded-full" />
                      <Skeleton className="h-5 w-3/5 rounded-full" />
                    </div>
                  ) : summaryQuery.data ? (
                    <ul className="space-y-3 rounded-[1.5rem] border border-border/80 bg-muted/30 p-5 text-base" data-testid="delete-summary-counts">
                      <li className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Profile audits</span>
                        <span className="font-bold text-foreground bg-background px-3 py-1 rounded-full text-sm border border-border/50" data-testid="delete-summary-audits">
                          {summaryQuery.data.audits}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Saved dating profiles</span>
                        <span className="font-bold text-foreground bg-background px-3 py-1 rounded-full text-sm border border-border/50" data-testid="delete-summary-profiles">
                          {summaryQuery.data.profiles}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Message coaching sessions</span>
                        <span className="font-bold text-foreground bg-background px-3 py-1 rounded-full text-sm border border-border/50" data-testid="delete-summary-messages">
                          {summaryQuery.data.messages}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Email insights</span>
                        <span className="font-bold text-foreground bg-background px-3 py-1 rounded-full text-sm border border-border/50" data-testid="delete-summary-insights">
                          {summaryQuery.data.insights}
                        </span>
                      </li>
                    </ul>
                  ) : summaryQuery.isError ? (
                    <p className="text-base text-[hsl(348_55%_65%)] text-center p-4 bg-[hsl(348_55%_65%/0.1)] rounded-[1.5rem]" data-testid="delete-summary-error">
                      Couldn't load your data summary. Your profile, audits,
                      saved dating profiles, message coaching sessions, and
                      email insights will all be removed.
                    </p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 my-6">
              <Label htmlFor="delete-confirm-input" className="text-base text-center block">
                Type <span className="font-bold text-foreground">delete</span> to confirm
              </Label>
              <Input
                id="delete-confirm-input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={deleteAccount.isPending}
                data-testid="input-account-delete-confirm"
                className="text-center font-medium h-12 rounded-xl text-lg tracking-wider"
              />
            </div>
            <AlertDialogFooter className="flex-col sm:flex-col gap-3">
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleConfirmDelete();
                }}
                disabled={deleteAccount.isPending || !isDeleteConfirmed}
                className="w-full h-12 rounded-full text-base font-bold bg-[hsl(348_55%_55%)] text-white hover:bg-[hsl(348_55%_48%)] shadow-md disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all"
                data-testid="button-account-delete-confirm"
              >
                {deleteAccount.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Yes, delete everything"
                )}
              </AlertDialogAction>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  void handleDownload();
                }}
                disabled={isExporting || deleteAccount.isPending}
                className="w-full h-12 rounded-full text-base font-semibold border-border hover:bg-black/5 hover:text-foreground"
                data-testid="button-account-delete-download"
              >
                {isExporting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Download className="w-5 h-5 mr-2" />
                )}
                Download my data first
              </Button>
              <AlertDialogCancel
                disabled={deleteAccount.isPending}
                data-testid="button-account-delete-cancel"
                className="w-full h-12 rounded-full text-base font-medium border-0 shadow-none hover:bg-black/5 mt-2"
              >
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
