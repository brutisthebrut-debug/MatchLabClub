import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

export function TrustBadge({ className, size = "sm" }: TrustBadgeProps) {
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-muted-foreground/50 select-none",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
    >
      <Lock className={cn("flex-shrink-0 opacity-60", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
      Your data stays private — never sold, never shared.
    </p>
  );
}
