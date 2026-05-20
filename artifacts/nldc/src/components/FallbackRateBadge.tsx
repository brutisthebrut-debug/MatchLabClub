import { useState } from "react";
import { useGetAiFallbackRate, getGetAiFallbackRateQueryKey } from "@workspace/api-client-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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
  const [open, setOpen] = useState(false);

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            "text-[11px] text-muted-foreground/50 leading-relaxed underline decoration-dotted underline-offset-2 cursor-pointer hover:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded" +
            (className ? ` ${className}` : "")
          }
          data-testid={testId ?? "text-fallback-rate"}
          aria-label="What does backup mean?"
        >
          {data.fallbacks} of the last {data.total} answers used our backup
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top" align="start">
        <div className="space-y-2">
          <p className="font-semibold text-popover-foreground">What is the backup?</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Every tool has a library of coach-written answers. When the engine can't produce a fully tailored response, it draws from that library instead.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            This stat covers the last{" "}
            <span className="font-medium text-popover-foreground">{windowSize}</span>{" "}
            uses of this tool.
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed border-t pt-2">
            Backup answers are still written by a real coach — you're in good hands either way.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
