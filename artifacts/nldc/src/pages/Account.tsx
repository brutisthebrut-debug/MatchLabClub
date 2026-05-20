import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@workspace/api-client-react";
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
} from "lucide-react";

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_24px_hsl(268_52%_68%/0.45)]">
      {initials}
    </div>
  );
}

export default function Account() {
  useMeta(
    "Your Account",
    "Your Next Level Dating Club account — profile, audit count, and sign-out."
  );

  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { toast } = useToast();
  const auditsQuery = useListAudits(undefined, {
    query: { queryKey: getListAuditsQueryKey(), enabled: isAuthenticated },
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const deleteAccount = useDeleteMyAccount();
  const summaryQuery = useGetAccountSummary({
    query: {
      queryKey: getGetAccountSummaryQueryKey(),
      enabled: isAuthenticated && confirmDeleteOpen,
    },
  });
  const emailExport = useEmailMyDataExport();

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
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(268_52%_78%)] border border-[hsl(268_52%_68%/0.3)] mb-6">
            <UserIcon className="w-3.5 h-3.5" />
            Your Account
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            Account <span className="gradient-text-violet">overview</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Your profile, recent activity, and account controls — all in one place.
          </p>
        </div>

        {isLoading ? (
          <div className="glass rounded-2xl p-6 md:p-8 space-y-4" data-testid="account-loading">
            <div className="flex items-center gap-5">
              <Skeleton className="w-20 h-20 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !isAuthenticated ? (
          <div className="glass rounded-2xl p-8 md:p-10 text-center space-y-5" data-testid="account-signed-out">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl font-bold text-foreground">Sign in to see your account</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                Your profile, audits, and coaching history live here once you're signed in. It only takes a second.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => login()}
                className="rounded-full px-6 h-10 text-sm font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 hover:opacity-90"
                data-testid="button-account-login"
              >
                <LogIn className="w-4 h-4 mr-2" /> Sign in
              </Button>
              <Button asChild variant="ghost" className="rounded-full text-sm font-medium text-muted-foreground hover:text-foreground">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6" data-testid="account-signed-in">
            {/* Profile card */}
            <div className="glass rounded-2xl p-6 md:p-8 flex items-center gap-5">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={fullName}
                  className="w-20 h-20 rounded-2xl object-cover shadow-[0_0_24px_hsl(268_52%_68%/0.4)]"
                  data-testid="account-avatar"
                />
              ) : (
                <Initials name={fullName} />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-2xl font-bold text-foreground truncate" data-testid="account-name">
                  {fullName}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate" data-testid="account-email">{user?.email ?? "No email on file"}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[hsl(268_52%_68%/0.12)] border border-[hsl(268_52%_68%/0.25)] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[hsl(268_52%_78%)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-foreground" data-testid="account-audit-count">
                    {auditsQuery.isLoading ? "—" : auditCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {auditCount === 1 ? "Audit completed" : "Audits completed"}
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.04] transition-colors group"
                data-testid="link-account-dashboard"
              >
                <div className="w-11 h-11 rounded-xl bg-[hsl(190_55%_60%/0.12)] border border-[hsl(190_55%_60%/0.25)] flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-[hsl(190_55%_72%)] group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Open dashboard</div>
                  <div className="text-xs text-muted-foreground">Scores, strengths, recent audits</div>
                </div>
              </Link>
            </div>

            {/* Actions */}
            <div className="glass rounded-2xl p-6 md:p-8 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Account controls</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage data and approvals from your control center, or sign out below.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" className="rounded-full text-sm font-medium">
                  <Link href="/user-control" data-testid="link-account-data">Manage your data</Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Link href="/privacy">Privacy policy</Link>
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="rounded-full text-sm font-medium ml-auto border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_65%/0.08)] hover:text-[hsl(348_55%_82%)]"
                  data-testid="button-account-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </Button>
              </div>
            </div>

            {/* Data ownership */}
            <div className="glass rounded-2xl p-6 md:p-8 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Your data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Download everything we have about you, or permanently remove your account and all associated audits, messages, and insights.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleDownload}
                  disabled={isExporting}
                  variant="outline"
                  className="rounded-full text-sm font-medium"
                  data-testid="button-account-download-data"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download my data
                </Button>
                <Button
                  onClick={handleEmailExport}
                  disabled={emailExport.isPending || !user?.email}
                  variant="outline"
                  className="rounded-full text-sm font-medium"
                  data-testid="button-account-email-data"
                  title={
                    !user?.email
                      ? "Add an email to your account to use this option"
                      : undefined
                  }
                >
                  {emailExport.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Email me a copy
                </Button>
                <Button
                  onClick={() => setConfirmDeleteOpen(true)}
                  variant="outline"
                  className="rounded-full text-sm font-medium ml-auto border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_65%/0.08)] hover:text-[hsl(348_55%_82%)]"
                  data-testid="button-account-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete my account
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent data-testid="dialog-confirm-delete-account">
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You'll be signed out immediately and the following will be
                    permanently removed. This can't be undone.
                  </p>
                  {summaryQuery.isLoading ? (
                    <div
                      className="space-y-2"
                      data-testid="delete-summary-loading"
                    >
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                  ) : summaryQuery.data ? (
                    <ul
                      className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm"
                      data-testid="delete-summary-counts"
                    >
                      <li className="flex justify-between gap-4">
                        <span>Profile audits</span>
                        <span
                          className="font-semibold text-foreground"
                          data-testid="delete-summary-audits"
                        >
                          {summaryQuery.data.audits}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span>Saved dating profiles</span>
                        <span
                          className="font-semibold text-foreground"
                          data-testid="delete-summary-profiles"
                        >
                          {summaryQuery.data.profiles}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span>Message coaching sessions</span>
                        <span
                          className="font-semibold text-foreground"
                          data-testid="delete-summary-messages"
                        >
                          {summaryQuery.data.messages}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span>Email insights</span>
                        <span
                          className="font-semibold text-foreground"
                          data-testid="delete-summary-insights"
                        >
                          {summaryQuery.data.insights}
                        </span>
                      </li>
                    </ul>
                  ) : summaryQuery.isError ? (
                    <p
                      className="text-sm text-[hsl(348_55%_78%)]"
                      data-testid="delete-summary-error"
                    >
                      Couldn't load your data summary. Your profile, audits,
                      saved dating profiles, message coaching sessions, and
                      email insights will all be removed.
                    </p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteAccount.isPending}
                data-testid="button-account-delete-cancel"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleConfirmDelete();
                }}
                disabled={deleteAccount.isPending}
                className="bg-[hsl(348_55%_55%)] text-white hover:bg-[hsl(348_55%_48%)]"
                data-testid="button-account-delete-confirm"
              >
                {deleteAccount.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Yes, delete everything"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
