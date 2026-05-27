import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListMySessions,
  getListMySessionsQueryKey,
  useRevokeOneSession,
  useRevokeOtherSessions,
} from "@workspace/api-client-react";
import type { MySession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Globe,
  Loader2,
  LogIn,
  Monitor,
  Shield,
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Unknown";
  const diff = Date.now() - then;
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function formatExact(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ChannelIcon({ channel }: { channel: MySession["channel"] }) {
  if (channel === "mobile") return <Smartphone className="w-4 h-4" />;
  if (channel === "web") return <Monitor className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

export default function Sessions() {
  useMeta(
    "Devices & sign-ins",
    "See where you're currently signed in to MatchLab Club and sign out any device you don't recognize."
  );

  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionsQuery = useListMySessions({
    query: {
      queryKey: getListMySessionsQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const revokeOne = useRevokeOneSession();
  const revokeOthers = useRevokeOtherSessions();
  const [pendingSid, setPendingSid] = useState<string | null>(null);

  const sessions = sessionsQuery.data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  const handleRevokeOne = async (session: MySession) => {
    setPendingSid(session.sid);
    try {
      await revokeOne.mutateAsync({ sid: session.sid });
      toast({
        title: session.current ? "Signed out of this device" : "Sign-in revoked",
        description: session.current
          ? "You'll be returned to the home page."
          : "That device has been signed out.",
      });
      await queryClient.invalidateQueries({
        queryKey: getListMySessionsQueryKey(),
      });
      if (session.current) {
        // Reload so the unauthed state is reflected everywhere.
        window.location.assign("/");
      }
    } catch (err) {
      toast({
        title: "Couldn't revoke that sign-in",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingSid(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const result = await revokeOthers.mutateAsync();
      toast({
        title:
          result.revoked === 0
            ? "Nothing to sign out"
            : `Signed out ${result.revoked} other ${result.revoked === 1 ? "device" : "devices"}`,
        description:
          result.revoked === 0
            ? "There were no other active sign-ins."
            : "Only this device is still signed in.",
      });
      await queryClient.invalidateQueries({
        queryKey: getListMySessionsQueryKey(),
      });
    } catch (err) {
      toast({
        title: "Couldn't sign out other devices",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-sessions-back"
          >
            <ArrowLeft className="w-4 h-4" /> Back to account
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] mb-6">
            <Shield className="w-3.5 h-3.5" />
            Devices & sign-ins
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            Where you&rsquo;re <span className="gradient-text-violet">signed in</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Every browser or app currently signed in to your account. If you
            don&rsquo;t recognize one, sign it out right away.
          </p>
        </div>

        {isAuthLoading ? (
          <div className="space-y-3" data-testid="sessions-loading">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : !isAuthenticated ? (
          <div
            className="glass rounded-2xl p-8 md:p-10 text-center space-y-5"
            data-testid="sessions-signed-out"
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl font-bold text-foreground">
                Sign in to manage your devices
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                Once signed in, you&rsquo;ll see every active session and can
                sign out any device you don&rsquo;t recognize.
              </p>
            </div>
            <Button
              onClick={() => login()}
              className="rounded-full px-6 h-10 text-sm font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 hover:opacity-90"
              data-testid="button-sessions-login"
            >
              <LogIn className="w-4 h-4 mr-2" /> Sign in
            </Button>
          </div>
        ) : sessionsQuery.isLoading ? (
          <div className="space-y-3" data-testid="sessions-list-loading">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : sessionsQuery.isError ? (
          <div
            className="glass rounded-2xl p-6 text-center"
            data-testid="sessions-error"
          >
            <ShieldAlert className="w-8 h-8 text-[hsl(348_55%_78%)] mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Couldn&rsquo;t load your active sessions. Please refresh and try
              again.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="sessions-list">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {sessions.length}{" "}
                {sessions.length === 1 ? "active sign-in" : "active sign-ins"}
              </div>
              <Button
                onClick={handleRevokeOthers}
                disabled={otherCount === 0 || revokeOthers.isPending}
                variant="outline"
                className="rounded-full text-sm font-medium border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_65%/0.08)] hover:text-[hsl(348_55%_82%)]"
                data-testid="button-revoke-others"
              >
                {revokeOthers.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Sign out everywhere else
              </Button>
            </div>

            <ul className="space-y-3">
              {sessions.map((s) => {
                const busy = pendingSid === s.sid;
                return (
                  <li
                    key={s.sid}
                    className={`glass rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 ${
                      s.current
                        ? "border border-[hsl(248_62%_52%/0.4)]"
                        : ""
                    }`}
                    data-testid={`session-row-${s.sid}`}
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.25)] flex items-center justify-center text-[hsl(248_62%_62%)]">
                      <ChannelIcon channel={s.channel} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-semibold text-foreground"
                          data-testid={`session-device-${s.sid}`}
                        >
                          {s.deviceLabel ?? "Unknown device"}
                        </span>
                        {s.current ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[hsl(248_62%_52%/0.18)] text-[hsl(248_62%_65%)] border border-[hsl(248_62%_52%/0.35)]"
                            data-testid={`session-current-badge-${s.sid}`}
                          >
                            This device
                          </span>
                        ) : null}
                        {s.channel === "mobile" ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                            Mobile app
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        <div>
                          Last active{" "}
                          <span
                            title={formatExact(s.lastSeenAt)}
                            data-testid={`session-last-seen-${s.sid}`}
                          >
                            {formatRelative(s.lastSeenAt)}
                          </span>
                          {s.ipLocation ? (
                            <>
                              {" "}
                              ·{" "}
                              <span
                                title={s.ip ?? undefined}
                                data-testid={`session-location-${s.sid}`}
                              >
                                {s.ipLocation}
                              </span>
                            </>
                          ) : s.ip ? (
                            <>
                              {" "}
                              ·{" "}
                              <span data-testid={`session-ip-${s.sid}`}>
                                {s.ip}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div>
                          Signed in {formatRelative(s.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRevokeOne(s)}
                      disabled={busy}
                      variant="outline"
                      className="rounded-full text-sm font-medium md:ml-auto border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_65%/0.08)] hover:text-[hsl(348_55%_82%)]"
                      data-testid={`button-revoke-session-${s.sid}`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      {s.current ? "Sign out" : "Revoke"}
                    </Button>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Revoked sessions stop working immediately on the next request.
              Sessions you don&rsquo;t use automatically expire after a week.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
