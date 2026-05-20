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
import {
  readAnonymousIds,
  clearAnonymousIds,
  hasAnyAnonymousIds,
} from "@/lib/anonymousIds";
import { useAuth } from "@/lib/auth";

/**
 * Mirror of the web hook `useClaimAnonymousOnLogin`: when the mobile user
 * signs in, reassign every audit / profile / message session / insight that
 * they created anonymously (tracked locally via `rememberAnonymousId`) to
 * the now-authenticated account, then invalidate user-scoped queries so the
 * dashboard, matches list, etc. reflect the claimed rows immediately.
 */
export function useClaimAnonymousOnLogin(): void {
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const claim = useClaimAnonymousData();
  const claimedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user?.id) return;
    if (claimedForUserRef.current === user.id) return;

    const userId = user.id;
    let cancelled = false;

    void (async () => {
      if (!(await hasAnyAnonymousIds())) {
        if (!cancelled) claimedForUserRef.current = userId;
        return;
      }

      const ids = await readAnonymousIds();
      if (cancelled) return;
      claimedForUserRef.current = userId;

      claim.mutate(
        { data: ids },
        {
          onSuccess: () => {
            void clearAnonymousIds();
            queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
            queryClient.invalidateQueries({
              queryKey: getGetAuditSummaryQueryKey(),
            });
            queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
            queryClient.invalidateQueries({
              queryKey: getListMessageCoachingSessionsQueryKey(),
            });
            queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
          },
          onError: () => {
            // Allow retry on the next render/auth change.
            claimedForUserRef.current = null;
          },
        },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, user?.id, claim, queryClient]);
}
