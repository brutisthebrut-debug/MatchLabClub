import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type FallbackNoticeProps = {
  onRetry: () => void;
  loading: boolean;
  label: string;
  testId?: string;
  className?: string;
};

export function FallbackNotice({ onRetry, loading, label, testId, className }: FallbackNoticeProps) {
  return (
    <div
      className={
        "mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-[hsl(43_65%_65%/0.25)] bg-[hsl(43_65%_65%/0.08)] px-4 py-3" +
        (className ? ` ${className}` : "")
      }
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[hsl(43_65%_70%)]" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-[hsl(43_65%_78%)] font-semibold">Using a backup {label}.</span>{" "}
          The AI couldn't return a clean answer this time, so we showed you our coach-written version. You can try again for a fresh take.
        </p>
      </div>
      <Button
        onClick={onRetry}
        disabled={loading}
        variant="outline"
        size="sm"
        className="rounded-full text-xs border-[hsl(43_65%_65%/0.4)] hover:border-[hsl(43_65%_65%/0.6)] hover:bg-[hsl(43_65%_65%/0.1)] flex-shrink-0"
        data-testid={testId ?? "button-retry-fallback"}
      >
        {loading ? <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
        Try again
      </Button>
    </div>
  );
}
