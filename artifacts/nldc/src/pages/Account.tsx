import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@workspace/replit-auth-web";
import { useListAudits, getListAuditsQueryKey } from "@workspace/api-client-react";
import { LogIn, LogOut, Mail, User as UserIcon, FileText, ArrowRight, Shield } from "lucide-react";

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
  const auditsQuery = useListAudits({
    query: { queryKey: getListAuditsQueryKey(), enabled: isAuthenticated },
  });

  const auditCount = auditsQuery.data?.length ?? 0;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Friend";

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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
