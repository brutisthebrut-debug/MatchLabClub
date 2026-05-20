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
        onSuccess: () => {
          clearAnonymousIds();
          queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getListMessageCoachingSessionsQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        },
        onError: () => {
          // Allow retry on next mount/auth change.
          claimedForUserRef.current = null;
        },
      },
    );
  }, [isAuthenticated, isLoading, user?.id, claim, queryClient]);
}
