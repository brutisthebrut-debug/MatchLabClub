import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  type MatchingState,
} from "@workspace/api-client-react";

// Shared "watch the meter climb" helper, generalising the snapshot pattern from
// onboarding so every signal-feeding tool can show the same before->after
// readiness reveal. Call snapshot() the instant before recording a signal to
// freeze the current score, then render ReadinessClimbReveal with `before` and
// `current`. It never computes readiness; it only reads the live matching state
// the rest of the app already shares, so the score climbs after the tool
// invalidates getGetMatchingStateQueryKey on success.
export function useReadinessClimb(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const matchingState = useGetMatchingState({
    query: { queryKey: getGetMatchingStateQueryKey(), enabled },
  });
  const current = matchingState.data?.readiness?.score ?? 0;

  // Null until a tool takes its before-snapshot, so a view that never fed a
  // signal shows no celebratory delta (matching onboarding's pure-skip case).
  const [before, setBefore] = useState<number | null>(null);

  const snapshot = useCallback(() => {
    const cached = queryClient.getQueryData<MatchingState>(
      getGetMatchingStateQueryKey(),
    );
    setBefore(cached?.readiness?.score ?? 0);
  }, [queryClient]);

  const reset = useCallback(() => setBefore(null), []);

  return { before, current, snapshot, reset };
}
