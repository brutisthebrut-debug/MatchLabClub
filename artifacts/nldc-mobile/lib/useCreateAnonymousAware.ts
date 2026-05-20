import {
  useCreateInsight,
  useCreateProfile,
} from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";

/**
 * Wrapper around `useCreateInsight` that automatically tags the returned
 * insight id as an anonymous-owned row in local storage, so that when the
 * user later signs in `useClaimAnonymousOnLogin` can reassign it to their
 * account. Mobile screens that create email insights should use this hook
 * (rather than `useCreateInsight` directly) so the claim-on-login flow works
 * end-to-end without each caller having to remember the bookkeeping.
 */
export function useCreateInsightWithAnonClaim(): ReturnType<
  typeof useCreateInsight
> {
  return useCreateInsight({
    mutation: {
      onSuccess: (insight) => {
        if (insight && typeof insight.id === "number") {
          void rememberAnonymousId("insights", insight.id);
        }
      },
    },
  });
}

/**
 * Wrapper around `useCreateProfile` that automatically tags the returned
 * saved-profile id as anonymous-owned, mirroring `useCreateInsightWithAnonClaim`.
 */
export function useCreateProfileWithAnonClaim(): ReturnType<
  typeof useCreateProfile
> {
  return useCreateProfile({
    mutation: {
      onSuccess: (profile) => {
        if (profile && typeof profile.id === "number") {
          void rememberAnonymousId("profiles", profile.id);
        }
      },
    },
  });
}
