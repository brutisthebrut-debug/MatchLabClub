import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useClaimAnonymousData,
  useRedeemAnonymousClaimHandoff,
  getListAuditsQueryKey,
  getGetAuditSummaryQueryKey,
  getListProfilesQueryKey,
  getListMessageCoachingSessionsQueryKey,
  getListInsightsQueryKey,
  getListJournalEntriesQueryKey,
  getListPostDateNotesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  readAnonymousIds,
  clearAnonymousIds,
  hasAnyAnonymousIds,
} from "@/lib/anonymousIds";
import {
  capturePendingHandoffFromUrl,
  readPendingHandoff,
  clearPendingHandoff,
} from "@/lib/handoffLink";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { trackEvent } from "@/lib/analytics";

/**
 * Classify a redeem error so the UI can show a specific message instead of a
 * generic failure. The API server returns these exact strings (see
 * `artifacts/api-server/src/routes/claim.ts`), so we match on them.
 */
type RedeemFailureReason = "already_used" | "invalid_or_expired" | "other";

export function classifyRedeemError(error: unknown): RedeemFailureReason {
  if (!error || typeof error !== "object") return "other";
  const e = error as { status?: unknown; data?: unknown };
  if (e.status !== 400) return "other";
  const data = e.data;
  if (!data || typeof data !== "object") return "other";
  const msg = (data as { error?: unknown }).error;
  if (typeof msg !== "string") return "other";
  if (msg === "This handoff link has already been used") return "already_used";
  if (msg === "Invalid or expired handoff token") return "invalid_or_expired";
  return "other";
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function buildClaimedSummary(claimed: {
  audits: number;
  profiles: number;
  messages: number;
  insights: number;
  followUps: number;
  journalEntries?: number;
  postDateNotes?: number;
}): string | null {
  const parts: string[] = [];
  if (claimed.audits > 0) {
    parts.push(pluralize(claimed.audits, "audit", "audits"));
  }
  if (claimed.profiles > 0) {
    parts.push(pluralize(claimed.profiles, "profile", "profiles"));
  }
  if (claimed.messages > 0) {
    parts.push(
      pluralize(claimed.messages, "message session", "message sessions"),
    );
  }
  if (claimed.insights > 0) {
    parts.push(
      pluralize(claimed.insights, "email insight", "email insights"),
    );
  }
  if (claimed.followUps > 0) {
    parts.push(
      pluralize(claimed.followUps, "follow-up answer", "follow-up answers"),
    );
  }
  if ((claimed.journalEntries ?? 0) > 0) {
    parts.push(
      pluralize(claimed.journalEntries ?? 0, "journal entry", "journal entries"),
    );
  }
  if ((claimed.postDateNotes ?? 0) > 0) {
    parts.push(
      pluralize(claimed.postDateNotes ?? 0, "date debrief", "date debriefs"),
    );
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function useClaimAnonymousOnLogin(): void {
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const claim = useClaimAnonymousData();
  const redeem = useRedeemAnonymousClaimHandoff();
  const claimedForUserRef = useRef<string | null>(null);
  const handoffClaimedForUserRef = useRef<string | null>(null);

  // Capture a `?nldc_handoff=...` param on first mount and stash it in
  // sessionStorage so it survives the OIDC login round-trip.
  useEffect(() => {
    capturePendingHandoffFromUrl();
  }, []);

  function invalidateDashboardQueries(): void {
    queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getListMessageCoachingSessionsQueryKey(),
    });
    queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPostDateNotesQueryKey() });
  }

  function toastClaimed(claimed: {
    audits: number;
    profiles: number;
    messages: number;
    insights: number;
    followUps: number;
    journalEntries?: number;
    postDateNotes?: number;
  }): void {
    const summary = buildClaimedSummary(claimed);
    if (summary) {
      toast({
        title: "Welcome back",
        description: `We brought your ${summary} with you.`,
      });
    }
  }

  // Cookie-scoped claim, happens when the same browser that created the
  // anonymous rows is also the one signing in.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user?.id) return;
    if (claimedForUserRef.current === user.id) return;
    if (!hasAnyAnonymousIds()) {
      claimedForUserRef.current = user.id;
      return;
    }

    const ids = readAnonymousIds();
    claimedForUserRef.current = user.id;

    claim.mutate(
      { data: ids },
      {
        onSuccess: (result) => {
          // Detect cookie-loss orphan scenario: the client had insight IDs in
          // localStorage but the server claimed 0 of them. This almost always
          // means the anon_claim cookie was cleared between the insight being
          // created and the sign-in (e.g. "Clear browsing data"). Store a flag
          // in sessionStorage so the Insights page can surface a helpful notice.
          const hadInsightIds = (ids.insightIds?.length ?? 0) > 0;
          if (hadInsightIds && result.claimed.insights === 0) {
            try {
              window.sessionStorage.setItem(
                "nldc:anon:insights_possibly_orphaned",
                "1",
              );
            } catch {
              // sessionStorage may be unavailable, swallow.
            }
          }
          clearAnonymousIds();
          invalidateDashboardQueries();
          toastClaimed(result.claimed);
          trackEvent("signup_claim_success", {
            audits: result.claimed.audits,
            profiles: result.claimed.profiles,
            messages: result.claimed.messages,
            insights: result.claimed.insights,
            follow_ups: result.claimed.followUps,
            journal_entries: result.claimed.journalEntries,
            post_date_notes: result.claimed.postDateNotes,
            channel: "cookie",
          });
        },
        onError: () => {
          // Allow retry on next mount/auth change.
          claimedForUserRef.current = null;
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, claim, queryClient]);

  // Cross-device handoff claim, happens when this browser arrived via a
  // `?nldc_handoff=...` link from another device and is now signed in.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user?.id) return;
    if (handoffClaimedForUserRef.current === user.id) return;

    const pending = readPendingHandoff();
    if (!pending) {
      handoffClaimedForUserRef.current = user.id;
      return;
    }

    handoffClaimedForUserRef.current = user.id;

    redeem.mutate(
      {
        data: {
          handoff: pending.handoff,
          auditIds: pending.auditIds,
          profileIds: pending.profileIds,
          messageSessionIds: pending.messageSessionIds,
          insightIds: pending.insightIds,
          followUpIds: pending.followUpIds,
          journalEntryIds: pending.journalEntryIds,
          postDateNoteIds: pending.postDateNoteIds,
        },
      },
      {
        onSuccess: (result) => {
          clearPendingHandoff();
          invalidateDashboardQueries();
          toastClaimed(result.claimed);
          trackEvent("signup_claim_success", {
            audits: result.claimed.audits,
            profiles: result.claimed.profiles,
            messages: result.claimed.messages,
            insights: result.claimed.insights,
            follow_ups: result.claimed.followUps,
            journal_entries: result.claimed.journalEntries,
            post_date_notes: result.claimed.postDateNotes,
            channel: "handoff",
          });
        },
        onError: (error) => {
          // The handoff token is short-lived (15 min) and single-use in
          // practice. If the call failed, drop it so we don't keep retrying
          // the same dead token on every render.
          clearPendingHandoff();
          handoffClaimedForUserRef.current = user.id;

          const reason = classifyRedeemError(error);
          if (reason === "already_used") {
            toast({
              title: "This link was already used",
              description:
                "This hand-off link has already been redeemed. If your audits didn't arrive, ask the original device to generate a fresh link, or start a new audit here.",
              duration: 12000,
              action: (
                <ToastAction
                  altText="Start a new audit"
                  data-testid="button-handoff-already-used-start"
                  onClick={() => setLocation("/start")}
                >
                  Start fresh
                </ToastAction>
              ),
            });
          } else if (reason === "invalid_or_expired") {
            toast({
              title: "This hand-off link expired",
              description:
                "Hand-off links are good for 15 minutes. Start a fresh audit on this device, or share a new link from the original browser.",
              duration: 10000,
              action: (
                <ToastAction
                  altText="Start a new audit"
                  data-testid="button-handoff-expired-start"
                  onClick={() => setLocation("/start")}
                >
                  Start a new audit
                </ToastAction>
              ),
            });
          } else {
            toast({
              title: "We couldn't bring your audits over",
              description:
                "Something went wrong claiming the hand-off link. Your data is safe on the original device.",
              variant: "destructive",
              duration: 10000,
            });
          }
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, redeem, queryClient]);
}
