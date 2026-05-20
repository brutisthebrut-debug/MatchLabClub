import { useCallback, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTrashedAudits,
  useListExpiringTrashedAudits,
  getListExpiringTrashedAuditsQueryKey,
  useRestoreAudit,
  usePurgeAudit,
  getListTrashedAuditsQueryKey,
  getListAuditsQueryKey,
  getGetAuditSummaryQueryKey,
  type Audit,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Trash2,
  Clock,
} from "lucide-react";

function formatDeleted(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted yesterday";
  if (days < 30) return `Deleted ${days} days ago`;
  return `Deleted ${d.toLocaleDateString()}`;
}

function daysUntilPurge(iso: string | null | undefined): number {
  if (!iso) return 30;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 30;
  const elapsed = Math.floor(
    (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(0, 30 - elapsed);
}

export default function Trash() {
  useMeta(
    "Recently deleted",
    "Restore audits you've deleted in the last 30 days, or remove them for good.",
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useListTrashedAudits();
  const { data: expiringData } = useListExpiringTrashedAudits(undefined, {
    query: { queryKey: getListExpiringTrashedAuditsQueryKey() },
  });
  const restore = useRestoreAudit();
  const purge = usePurgeAudit();

  const [confirmAudit, setConfirmAudit] = useState<Audit | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: getListTrashedAuditsQueryKey(),
    });
    void queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getGetAuditSummaryQueryKey(),
    });
  }, [queryClient]);

  const handleRestore = useCallback(
    (audit: Audit) => {
      restore.mutate(
        { id: audit.id },
        {
          onSuccess: () => {
            invalidate();
            toast({
              title: "Restored",
              description: `${audit.firstName ?? "Match"}'s audit is back in your matches.`,
            });
          },
          onError: () =>
            toast({
              title: "Couldn't restore",
              description: "Please try again in a moment.",
              variant: "destructive",
            }),
        },
      );
    },
    [restore, invalidate, toast],
  );

  const handlePurge = useCallback(
    (audit: Audit) => {
      purge.mutate(
        { id: audit.id },
        {
          onSuccess: () => {
            invalidate();
            toast({
              title: "Deleted forever",
              description: `${audit.firstName ?? "This match"} has been permanently removed.`,
            });
          },
          onError: () =>
            toast({
              title: "Couldn't delete",
              description: "Please try again in a moment.",
              variant: "destructive",
            }),
        },
      );
      setConfirmAudit(null);
    },
    [purge, invalidate, toast],
  );

  const audits = (data ?? []) as Audit[];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-12 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
              Recently deleted
            </h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            Items in the trash are kept for 30 days, then permanently deleted.
            Restore one to bring it back to your matches.
          </p>
        </div>

        {expiringData && expiringData.audits.length > 0 && (() => {
          const earliest = expiringData.audits[0]?.deletedAt;
          const left = earliest
            ? Math.max(
                0,
                expiringData.retentionDays -
                  Math.floor(
                    (Date.now() - new Date(earliest).getTime()) /
                      (24 * 60 * 60 * 1000),
                  ),
              )
            : 0;
          const when =
            left <= 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`;
          const count = expiringData.audits.length;
          return (
            <div
              data-testid="banner-trash-expiring"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-[hsl(348_55%_55%/0.5)] bg-[hsl(348_55%_55%/0.08)] p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(348_55%_68%)]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[hsl(348_55%_75%)]">
                  {count === 1
                    ? "1 audit is about to be deleted forever"
                    : `${count} audits are about to be deleted forever`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {count === 1 ? "It" : "The earliest"} purges {when}. Restore
                  anything you want to keep.
                </p>
              </div>
            </div>
          );
        })()}

        {isLoading ? (
          <div className="space-y-3" data-testid="trash-loading">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div
            className="glass rounded-2xl p-8 text-center"
            data-testid="trash-error"
          >
            <p className="text-muted-foreground text-sm mb-4">
              Couldn't load your trash.
            </p>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              data-testid="button-trash-retry"
            >
              Try again
            </Button>
          </div>
        ) : audits.length === 0 ? (
          <div
            className="glass rounded-3xl p-10 text-center"
            data-testid="trash-empty"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-xl font-bold text-foreground mb-2">
              Nothing here
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              Deleted matches show up here for 30 days before they're gone for
              good.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="trash-list">
            {audits.map((audit) => {
              const remaining = daysUntilPurge(audit.deletedAt);
              const busy =
                (restore.isPending && restore.variables?.id === audit.id) ||
                (purge.isPending && purge.variables?.id === audit.id);
              return (
                <div
                  key={audit.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-white/6 bg-white/2 hover:border-[hsl(268_52%_68%/0.25)] transition-all"
                  data-testid={`row-trashed-${audit.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {audit.firstName ?? "Untitled match"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {formatDeleted(audit.deletedAt)}
                      <span aria-hidden="true">·</span>
                      <span>
                        {remaining === 0
                          ? "purges today"
                          : `${remaining} day${remaining === 1 ? "" : "s"} left`}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleRestore(audit)}
                      disabled={busy}
                      className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold"
                      data-testid={`button-restore-${audit.id}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Restore
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmAudit(audit)}
                      disabled={busy}
                      className="p-2 rounded-lg text-muted-foreground hover:text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_55%/0.12)] transition-colors disabled:opacity-50"
                      aria-label={`Permanently delete ${audit.firstName ?? "match"}`}
                      data-testid={`button-purge-${audit.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={confirmAudit !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAudit(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-confirm-purge">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAudit?.firstName ?? "This match"} will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-purge">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAudit) handlePurge(confirmAudit);
              }}
              className="bg-[hsl(348_55%_55%)] hover:bg-[hsl(348_55%_50%)] text-white"
              data-testid="button-confirm-purge"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
