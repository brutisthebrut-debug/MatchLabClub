import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClaimAnonymousData,
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
import { toast } from "@/hooks/use-toast";

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function buildClaimedSummary(claimed: {
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
  const claimedForUserRef = useRef<string | null>(null);

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
          queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getListMessageCoachingSessionsQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });

          const summary = buildClaimedSummary(result.claimed);
          if (summary) {
            toast({
              title: "Welcome back",
              description: `We brought your ${summary} with you.`,
            });
          }
        },
        onError: () => {
          // Allow retry on next mount/auth change.
          claimedForUserRef.current = null;
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, claim, queryClient]);
}
