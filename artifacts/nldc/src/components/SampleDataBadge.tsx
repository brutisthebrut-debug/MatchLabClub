import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

type SampleDataBadgeTone = "muted" | "rose";
type SampleDataBadgeSize = "xs" | "sm" | "md";

interface SampleDataBadgeProps {
  label?: string;
  tone?: SampleDataBadgeTone;
  size?: SampleDataBadgeSize;
  className?: string;
  testId?: string;
}

const toneClasses: Record<SampleDataBadgeTone, string> = {
  muted: "border-white/20 bg-white/10 text-muted-foreground",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-600",
};

const sizeClasses: Record<SampleDataBadgeSize, string> = {
  xs: "px-2.5 py-1 text-[10px]",
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

const iconSizeClasses: Record<SampleDataBadgeSize, string> = {
  xs: "h-2.5 w-2.5",
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

export function SampleDataBadge({
  label = "Sample data",
  tone = "muted",
  size = "sm",
  className,
  testId,
}: SampleDataBadgeProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      <FlaskConical
        className={cn("flex-shrink-0 opacity-70", iconSizeClasses[size])}
      />
      {label}
    </span>
  );
}
