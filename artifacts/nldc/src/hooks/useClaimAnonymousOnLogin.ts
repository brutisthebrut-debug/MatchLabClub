import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClaimAnonymousData,
  useRedeemAnonymousClaimHandoff,
  getListAuditsQueryKey,
  getGetAuditSummaryQueryKey,
  getListProfilesQueryKey,
  getListMessageCoachingSessionsQueryKey,
  getListInsightsQueryKey,
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

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function buildClaimedSummary(claimed: {
  audits: number;
  profiles: number;
  messages: number;
  insights: number;
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
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function useClaimAnonymousOnLogin(): void {
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
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
  }

  function toastClaimed(claimed: {
    audits: number;
    profiles: number;
    messages: number;
    insights: number;
  }): void {
    const summary = buildClaimedSummary(claimed);
    if (summary) {
      toast({
        title: "Welcome back",
        description: `We brought your ${summary} with you.`,
      });
    }
  }

  // Cookie-scoped claim — happens when the same browser that created the
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
          clearAnonymousIds();
          invalidateDashboardQueries();
          toastClaimed(result.claimed);
        },
        onError: () => {
          // Allow retry on next mount/auth change.
          claimedForUserRef.current = null;
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, claim, queryClient]);

  // Cross-device handoff claim — happens when this browser arrived via a
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
        },
      },
      {
        onSuccess: (result) => {
          clearPendingHandoff();
          invalidateDashboardQueries();
          toastClaimed(result.claimed);
        },
        onError: () => {
          // The handoff token is short-lived (15 min) and single-use in
          // practice. If the call failed, drop it so we don't keep retrying
          // the same dead token on every render.
          clearPendingHandoff();
          handoffClaimedForUserRef.current = user.id;
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, redeem, queryClient]);
}
