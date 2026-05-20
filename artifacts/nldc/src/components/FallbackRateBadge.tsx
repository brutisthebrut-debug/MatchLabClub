import { useGetAiFallbackRate, getGetAiFallbackRateQueryKey } from "@workspace/api-client-react";

type FallbackRateBadgeProps = {
  toolName: string;
  windowSize?: number;
  minSample?: number;
  className?: string;
  testId?: string;
};

export function FallbackRateBadge({
  toolName,
  windowSize = 20,
  minSample = 5,
  className,
  testId,
}: FallbackRateBadgeProps) {
  const { data } = useGetAiFallbackRate(
    { toolName, windowSize },
    {
      query: {
        queryKey: getGetAiFallbackRateQueryKey({ toolName, windowSize }),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  );

  if (!data) return null;
  if (data.total < minSample) return null;
  if (data.fallbacks <= 0) return null;

  return (
    <p
      className={
        "text-[11px] text-muted-foreground/50 leading-relaxed" +
        (className ? ` ${className}` : "")
      }
      data-testid={testId ?? "text-fallback-rate"}
      title="How often this tool fell back to our coach-written answer recently."
    >
      {data.fallbacks} of the last {data.total} answers used our backup
    </p>
  );
}
